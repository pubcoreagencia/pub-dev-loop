# PUB DEV LOOP - Stability Baseline

**STATUS FINAL:** `READY_FOR_PRODUCTION`

Este documento registra a estabilização crítica do lifecycle de execução de tarefas do motor principal do PUB DEV LOOP (Worker) implementada na versão atual.

## Problema Original
O ciclo de vida das tasks sofria interrupções fatais, resultando em tarefas (Tasks) presas indefinidamente no estado `RUNNING`. Durante uma bateria de E2E, notou-se que mesmo após a inteligência artificial (AG) concluir perfeitamente a sua rotina no provedor, o banco de dados não era atualizado para `COMPLETED` ou `FAILED`, criando um cenário de tasks fantasmas inoperantes.

## Causa Raiz
A investigação revelou dois bugs atuando em cascata:

1. **Concurrency Leak no Worker:** O orquestrador `BaseWorker` executava `worker.executeOnce()` por intermédio de um `setInterval(..., 3000)` cego (sem aguardar o término do ciclo atual). O atraso natural da IA forçava o processo Node.js a iniciar execuções simultâneas concorrentes na mesma instância do worker compartilhando propriedades de classe como a flag `this.active`. Quando a execução mais curta terminava, ela encerrava globalmente o worker (via `this.active = false`). A tarefa demorada que continuava a rodar terminava o seu passo posteriormente, verificava a flag adulterada, interpretava que o sistema estava em desligamento e disparava a exceção de interrupção silenciosa `Error: Worker cancelled`.

2. **Rejeição Silenciosa do PostgreSQL (node-postgres):** Em qualquer erro, seja o cancelamento forçado acima ou falhas de provedor (ex: falha de clonagem no git), o worker tentava forçar o banco para o estado `FAILED`. O objeto de fallback passava para a base de dados como `result: undefined` ou `branch: undefined`. A biblioteca do Postgres (`pg`) não aceita valores `undefined` em arrays de valores parametrizados (`Values cannot be undefined`), estourando uma exceção de formatação local do Node. Dessa forma, a própria query que marcaria a falha falhava, abortando qualquer salvamento no banco de dados e mantendo a Task para sempre congelada como `RUNNING`.

## Correções Aplicadas

### Correção do Worker (`src/worker.ts`)
Substituiu-se o temporizador estático concorrente por um loop recursivo assíncrono serializado utilizando o padrão assíncrono seguro (`runCycle`). Com um `setTimeout` disparando a próxima invocação de forma isolada exclusivamente pelo bloco `finally` após o término integral da anterior (seja por sucesso ou exceção).

### Correção do Repository/PG (`src/repository.ts`)
Inclusão da instrução imperativa `if (v === undefined) continue;` no montador do script relacional no comando de update, isolando o driver local e garantindo uma conversão limpa da modelagem do ORM, omitindo referências sem definição prévia no SQL, mas consolidando os `null` necessários.

## Comportamento Anterior
- Execução interrompia silenciosamente de forma esporádica dependendo do tempo decorrido do agente.
- Falhas na fase preparatória (e.g. clonagem bloqueada) abortavam o Worker.
- O Banco de dados retinha a task perpetuamente no status transacional `RUNNING` exigindo ação humana.

## Comportamento Atual
- Nenhuma execução sofre atropelamentos. `setInterval` foi varrido.
- Se o provisionamento falhar, a Task cai corretamente de forma graciosa e transita garantidamente para `FAILED`.
- Se a execução avançar o ciclo se encerra com a devolução da Task preenchida para a aplicação como `COMPLETED`.
- Zero exceptions em runtime vindos da CLI.

## Lifecycle Oficial (Invariante Crítica)

> **Invariante:** Uma Task **não pode** permanecer indefinidamente em `RUNNING` após o worker encerrar sua execução. Não devem ser criados novos estados artificiais.

Se uma execução falhar:
**QUEUED → ASSIGNED → RUNNING → FAILED**

Se uma execução terminar:
**QUEUED → ASSIGNED → RUNNING → TESTING → COMPLETED**

## Evidências de Validação
Os seguintes comandos foram utilizados na auditoria de congelamento e retornaram sucesso ou 0 ocorrências:

* `docker compose ps` (Nenhum container no estado de restarting ou loop. Postgres, API e Worker = HEALTHY).
* `npm test` (133 passed | 8 skipped (141)).
* `npm run typecheck` (Executou clean).
* `docker exec pubdevloop-postgres-1 psql -U pubdevloop -d pubdevloop -c "SELECT id, status FROM tasks WHERE status = 'RUNNING';"` (Retornou zero tasks).

## Changelog Técnico

### Lifecycle Stability Fix
**Resumo da cadeia de falha:** `setInterval` concorrente → ciclos sobrepostos → conflito em `this.active` → interrupção não rastreada (`Worker cancelled`) → tentativa de `FAILED` sem mapeamento de fallback → valor nativo JS `undefined` repassado diretamente à biblioteca conectora `pg` → método `update` abortado silenciosamente → Task permanecia assinalada para o container como `RUNNING`.

**Correção Integrada:** A serialização do ciclo assíncrono somada a um filtro isolador de preenchimento `undefined` promove transição de estados 100% segura. Nenhuma rotina de polling concorrerá pela memória partilhada do worker e falhas primitivas são formalizadas.

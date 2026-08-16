# PUB DEV LOOP — MASTER CONTEXT

**Version:** V1.0  
**Date:** 2026-08-16  
**Owner:** PUB Core Holding  
**Repository:** `pubcoreagencia/pub-dev-loop`  
**Status:** Architecture defined / V1 implementation pending

---

## 1. VISÃO GERAL

O PUB DEV LOOP é uma infraestrutura interna da PUB Core criada para automatizar o fluxo de vibe coding entre GPT e múltiplos agentes de desenvolvimento distribuídos em Windows e macOS.

Fluxo atual manual:

```text
Usuário
↓
GPT
↓
Prompt de implementação
↓
Agente de desenvolvimento
↓
Implementação
↓
Resposta / resultado
↓
Usuário copia resultado
↓
GPT
↓
Novo prompt
↓
Agente
↓
...
```

Fluxo desejado:

```text
Usuário
↓
GPT
↓
Orchestrator
↓
Task Queue
↓
Workers de desenvolvimento
↓
Implementação
↓
Testes
↓
Resultado
↓
Git
↓
Orchestrator
↓
GPT
↓
Análise
↓
Nova Task
↓
Workers
↓
...
```

O objetivo é eliminar o trabalho manual de copiar e colar entre GPT e os agentes e permitir desenvolvimento paralelo, controlado e auditável.

---

## 2. PRINCÍPIO CENTRAL

### GPT = CÉREBRO

Responsável por:

- entender o objetivo;
- analisar o contexto do projeto;
- decompor projetos em tarefas;
- priorizar tarefas;
- gerar prompts técnicos;
- analisar resultados;
- interpretar erros;
- decidir próximos passos;
- revisar implementações;
- criar novas tarefas;
- determinar quando uma tarefa ou projeto está concluído.

### WORKERS = EXECUTORES

Responsáveis por:

- analisar o código;
- implementar alterações;
- executar comandos;
- executar testes;
- corrigir problemas;
- validar implementação;
- retornar relatório estruturado.

### GIT = ESTADO E HISTÓRICO

Responsável por:

- versionamento;
- branches;
- worktrees;
- histórico;
- sincronização;
- isolamento de tarefas;
- recuperação;
- auditoria das alterações.

---

## 3. WORKERS ATUAIS

### Windows

```text
Windows
├── Hermes
├── Antigravity
└── Codex
```

**3 workers.**

### macOS

```text
macOS
├── Antigravity
└── Codex
```

**2 workers.**

### Total

**5 workers distribuídos em 2 dispositivos.**

Todos devem poder executar tarefas simultaneamente, desde que não exista conflito de arquivos/dependências.

---

## 4. PAPEL DOS AGENTES

Os agentes não possuem funções rígidas. O Orchestrator pode escolher dinamicamente o worker mais adequado.

Sugestões:

```text
Frontend / UI       → Antigravity
Backend / API       → Hermes
Refactoring         → Codex
Testes              → Codex
Debug               → Codex
Full-stack          → qualquer worker disponível
```

Essas regras são heurísticas, não limitações.

---

## 5. ARQUITETURA

```text
                         ┌──────────────────────┐
                         │         GPT          │
                         │                      │
                         │ Planner / Reviewer   │
                         │ Architect            │
                         │ Decision Maker       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │ TASK ORCHESTRATOR│
                           └────────┬────────┘
                                    │
                              TASK QUEUE
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
        WINDOWS                 WINDOWS                 WINDOWS
        HERMES              ANTIGRAVITY                 CODEX
              │                     │                     │
              └─────────────────────┼─────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
             MAC                   MAC
        ANTIGRAVITY               CODEX
              │                     │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
                                   GIT
                                    │
                              RESULT QUEUE
                                    │
                                    ▼
                                   GPT
                                    │
                              REVIEW / NEXT
                                    │
                                    └───────────────┐
                                                    ▼
                                                   LOOP
```

---

## 6. LOOP PRINCIPAL

1. Receber objetivo.
2. GPT analisa contexto.
3. GPT cria plano.
4. GPT cria tarefas.
5. Orchestrator coloca tarefas na fila.
6. Worker recebe tarefa.
7. Worker cria/usa worktree isolado.
8. Worker implementa.
9. Worker executa testes.
10. Worker gera resultado estruturado.
11. Resultado retorna ao Orchestrator.
12. Git registra alterações.
13. GPT recebe resultado.
14. GPT analisa resultado.
15. GPT identifica problemas.
16. GPT cria novas tarefas quando necessário.
17. Novas tarefas entram na fila.
18. Workers executam novamente.
19. O ciclo continua.
20. O projeto termina quando os critérios de aceite forem satisfeitos.

---

## 7. TASK QUEUE

Todas as tarefas devem possuir identificador único.

Exemplo:

```text
TASK-000001
TASK-000002
TASK-000003
```

Cada task deve conter, no mínimo:

```text
TASK ID
PROJECT
REPOSITORY
OBJECTIVE
CONTEXT
REQUIREMENTS
FILES / AREAS
ACCEPTANCE CRITERIA
TEST REQUIREMENTS
PRIORITY
DEPENDENCIES
PREFERRED WORKER
STATUS
CREATED_AT
UPDATED_AT
```

---

## 8. STATUS DAS TAREFAS

Estados mínimos:

```text
QUEUED
ASSIGNED
RUNNING
TESTING
COMPLETED
FAILED
BLOCKED
CANCELLED
NEEDS_REVIEW
```

Fluxo normal:

```text
QUEUED
↓
ASSIGNED
↓
RUNNING
↓
TESTING
↓
COMPLETED
↓
REVIEWED
```

Fluxo de erro:

```text
RUNNING
↓
FAILED
↓
GPT ANALYSIS
↓
NEW TASK
```

Fluxo de bloqueio:

```text
RUNNING
↓
BLOCKED
↓
GPT / HUMAN REVIEW
```

---

## 9. WORKTREES E ISOLAMENTO

Os agentes não devem compartilhar o mesmo diretório de trabalho simultaneamente quando houver possibilidade de conflito.

Estrutura conceitual:

```text
project/
├── main/
├── worker-hermes/
├── worker-antigravity-win/
├── worker-codex-win/
├── worker-antigravity-mac/
└── worker-codex-mac/
```

Branches sugeridas:

```text
worker/hermes/TASK-000001
worker/antigravity-win/TASK-000002
worker/codex-win/TASK-000003
worker/antigravity-mac/TASK-000004
worker/codex-mac/TASK-000005
```

---

## 10. REGRA DE CONCORRÊNCIA

O sistema deve permitir que cinco tasks sejam executadas simultaneamente quando forem independentes.

Exemplo:

```text
TASK-001 → Hermes
TASK-002 → Antigravity Windows
TASK-003 → Codex Windows
TASK-004 → Antigravity Mac
TASK-005 → Codex Mac
```

Não permitir dois workers modificando simultaneamente o mesmo conjunto crítico de arquivos sem coordenação.

Dependências devem ser explícitas. Se `TASK-002` depender de `TASK-001`, ela permanece em `QUEUED` até a conclusão da dependência.

---

## 11. RESULTADOS DOS WORKERS

Cada worker deve retornar um resultado estruturado contendo:

```text
RESULT ID
TASK ID
WORKER
STATUS
SUMMARY
FILES CREATED
FILES MODIFIED
COMMANDS EXECUTED
TESTS RUN
TEST RESULTS
ERRORS
WARNINGS
GIT BRANCH
GIT COMMIT
RECOMMENDATIONS
BLOCKERS
NEXT SUGGESTED ACTION
```

Exemplo:

```text
RESULT-000001

TASK: TASK-000001
WORKER: codex-mac
STATUS: COMPLETED

SUMMARY:
Implementado endpoint de criação de instâncias.

FILES MODIFIED:
src/api/instances.ts
src/services/evolution.ts

TESTS:
npm run lint
npm run test
npm run build

RESULT: PASS
BLOCKERS: none
NEXT ACTION: Implementar interface de gerenciamento.
```

---

## 12. GPT REVIEW LOOP

O GPT recebe:

```text
TASK ORIGINAL
+
CONTEXTO
+
RESULTADO
+
GIT DIFF
+
TEST RESULTS
```

E decide:

```text
COMPLETED
CREATE NEXT TASK
RETRY
BLOCK
HUMAN REVIEW
```

---

## 13. CONTEXTO DO PROJETO

O GPT deve possuir acesso ao contexto relevante antes de criar tarefas.

Fontes possíveis:

```text
MASTER_CONTEXT.md
README
arquitetura
documentação
schema
.env.example
package.json
Git history
issues
PRs
testes
logs
resultados anteriores
```

Segredos nunca devem ser incluídos no contexto.

---

## 14. SEGURANÇA

O sistema deve proteger contra:

- exposição de `.env`;
- exposição de API keys;
- exposição de tokens;
- commits de secrets;
- alterações destrutivas não autorizadas;
- exclusão de banco;
- comandos perigosos;
- alterações fora do escopo;
- loops infinitos;
- workers travados;
- conflitos Git.

Nunca enviar desnecessariamente ao GPT ou a workers:

```text
.env
.env.local
private keys
tokens
passwords
credentials
```

Usar `.env.example` para documentação de configuração.

---

## 15. GUARDRAILS

O loop não deve ser ilimitado sem controle.

Configurações mínimas:

```text
MAX_ITERATIONS
MAX_FAILURES
MAX_RETRIES_PER_TASK
MAX_SAME_ERROR
TASK_TIMEOUT
WORKER_TIMEOUT
REQUIRE_TEST_PASS
REQUIRE_BUILD_PASS
AUTO_COMMIT
AUTO_MERGE
AUTO_PUSH
```

Configuração inicial recomendada:

```text
MAX_ITERATIONS = 20
MAX_RETRIES_PER_TASK = 3
MAX_SAME_ERROR = 2
REQUIRE_TEST_PASS = true
REQUIRE_BUILD_PASS = true
AUTO_COMMIT = true
AUTO_PUSH = false
AUTO_MERGE = false
```

Todos os valores devem ser configuráveis.

---

## 16. HUMAN-IN-THE-LOOP

O sistema deve permitir intervenção humana e pausar quando houver:

- risco alto;
- alteração destrutiva;
- mudança de arquitetura crítica;
- conflito Git complexo;
- falha repetitiva;
- falta de informação;
- mudança de requisito;
- necessidade de credencial;
- alteração financeira;
- alteração de infraestrutura crítica.

Ações humanas:

```text
APPROVE
REJECT
EDIT TASK
RETRY
CANCEL
```

---

## 17. GIT

Git é parte central do sistema.

Cada task deve produzir histórico rastreável:

```text
TASK-000042
↓
branch
↓
implementation
↓
tests
↓
commit
↓
result
```

Commits devem referenciar a task.

Exemplo:

```text
feat(TASK-000042): implement WhatsApp instance management
```

---

## 18. MERGE

Na V1:

```text
AUTO_MERGE = false
```

Workers podem criar commits, mas a integração final deve passar por validação.

No futuro, auto-merge poderá ser habilitado para tarefas de baixo risco após testes e revisão.

---

## 19. DISTRIBUIÇÃO INTELIGENTE

O Orchestrator deve considerar:

```text
worker disponível?
worker ocupado?
capacidade?
tipo de tarefa?
dependências?
prioridade?
histórico de sucesso?
```

Exemplos:

```text
Frontend → Antigravity disponível
Refactor → Codex disponível
API integration → Hermes disponível
```

Se o worker ideal estiver ocupado, a task pode ser encaminhada a outro worker compatível.

---

## 20. PRIORIDADES

```text
CRITICAL
HIGH
MEDIUM
LOW
```

O scheduler deve priorizar tarefas de maior prioridade respeitando dependências.

---

## 21. PROJETOS

O PUB DEV LOOP deve ser genérico e funcionar para qualquer repositório da PUB Core.

Exemplos de projetos potenciais:

```text
PUB CORE
PUB LEADS
PUB MACHINE
PUB IA
PUB GROWTH AI
PUB FOOD
etc.
```

Cada projeto poderá possuir:

```text
PROJECT ID
REPOSITORY
MASTER CONTEXT
TECH STACK
RULES
TEST COMMANDS
BUILD COMMANDS
DEPLOYMENT RULES
```

---

## 22. ESTRUTURA PROPOSTA DO PROJETO

```text
pub-dev-loop/
│
├── README.md
├── MASTER_CONTEXT.md
├── .gitignore
│
├── docs/
│   └── ARCHITECTURE.md
│
├── orchestrator/
│   ├── scheduler/
│   ├── workers/
│   ├── queue/
│   ├── git/
│   ├── context/
│   ├── results/
│   └── safety/
│
├── tasks/
│   ├── queued/
│   ├── running/
│   ├── completed/
│   ├── failed/
│   └── blocked/
│
├── results/
├── projects/
│
├── workers/
│   ├── hermes/
│   ├── antigravity/
│   └── codex/
│
├── configs/
└── logs/
```

---

## 23. V1 — ESCOPO

### Incluir

```text
[ ] Task Queue
[ ] Task IDs
[ ] Worker registration
[ ] Worker status
[ ] GPT task generation
[ ] Worker task execution
[ ] Result collection
[ ] Git branch/worktree isolation
[ ] Git commit
[ ] GPT result analysis
[ ] Next-task generation
[ ] Retry
[ ] Failure handling
[ ] Basic concurrency
[ ] Logs
[ ] Kill switch
```

### Não incluir na V1

```text
[ ] OpenClaw
[ ] Auto deployment
[ ] Auto production deploy
[ ] Complex CI/CD orchestration
[ ] Automatic destructive operations
[ ] Fully autonomous production changes
[ ] Unlimited loop
```

**OpenClaw fica explicitamente fora da V1.**

---

## 24. V2 — EVOLUÇÃO

Após validar a V1:

```text
V2
├── intelligent worker selection
├── automatic merge
├── CI integration
├── GitHub integration
├── project dashboards
├── task analytics
├── worker performance metrics
├── automatic rollback
├── visual monitoring
└── notifications
```

---

## 25. V3 — AUTONOMIA

Visão futura:

```text
User
↓
Business Objective
↓
GPT
↓
Project Planning
↓
Task Generation
↓
5+ Workers
↓
Testing
↓
Review
↓
Merge
↓
Deployment
↓
Monitoring
↓
Feedback
↓
GPT
↓
Continuous Improvement
```

Nesse estágio o PUB DEV LOOP poderá funcionar como uma plataforma interna de engenharia autônoma da PUB Core.

---

## 26. PRINCÍPIO DE OPERAÇÃO

> GPT decide o que deve ser feito.  
> Workers decidem como implementar tecnicamente dentro do escopo.  
> Git registra tudo.  
> Testes validam o resultado.  
> GPT decide o próximo passo.

---

## 27. OBJETIVO FINAL

Transformar:

```text
Prompt
↓
Copiar
↓
Colar
↓
Esperar
↓
Copiar
↓
GPT
↓
Copiar
↓
Colar
```

em:

```text
OBJETIVO
↓
GPT
↓
PLANO
↓
TASK QUEUE
↓
5 WORKERS SIMULTÂNEOS
↓
IMPLEMENTAÇÃO
↓
TESTES
↓
GIT
↓
RESULTADOS
↓
GPT
↓
NOVA RODADA
↓
...
```

O usuário deve atuar principalmente como:

```text
VISION
↓
APPROVAL
↓
STRATEGIC DIRECTION
```

em vez de atuar como transportador manual de prompts.

---

## 28. DEFINIÇÃO DE SUCESSO DA V1

A V1 será considerada funcional quando for possível:

1. fornecer um objetivo ao GPT;
2. GPT gerar múltiplas tasks;
3. Orchestrator distribuir tasks;
4. Windows executar Hermes + Antigravity + Codex;
5. Mac executar Antigravity + Codex;
6. múltiplas tasks serem executadas simultaneamente;
7. cada worker trabalhar isoladamente;
8. resultados serem coletados automaticamente;
9. Git registrar alterações;
10. GPT analisar resultados;
11. GPT gerar novas tasks;
12. o ciclo continuar sem copiar/colar manual;
13. o sistema parar automaticamente em caso de risco ou falha;
14. o usuário conseguir assumir o controle a qualquer momento.

---

## 29. VISÃO FINAL

```text
                    GPT
                 ┌───────┐
                 │ BRAIN │
                 └───┬───┘
                     │
                ORCHESTRATOR
                     │
              ┌──────┴──────┐
              │             │
           WINDOWS          MAC
              │             │
       ┌──────┼──────┐   ┌──┴──────┐
       │      │      │   │         │
     HERMES   AG   CODEX AG      CODEX
       │      │      │   │         │
       └──────┴──────┴───┴─────────┘
                     │
                     ▼
                    GIT
                     │
                     ▼
                   GPT
                     │
                     ▼
              NEXT ITERATION
                     │
                     └──────────→ LOOP
```

O PUB DEV LOOP é uma infraestrutura distribuída de desenvolvimento assistido por IA da PUB Core, projetada para transformar uma intenção de produto em uma sequência contínua de implementação, teste, revisão e evolução, com intervenção humana apenas quando necessária.

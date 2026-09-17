# PDL × HERMES — PARITY AUDIT V1

> **Documento**: Auditoria Técnica de Paridade e Lacunas Arquiteturais  
> **Sistemas Avaliados**: PUB DEV LOOP (PDL) vs. Hermes Agent (`v0.20.1`)  
> **Operador Humano**: **MATHEUS**  
> **Modo**: Estritamente Read-Only (sem commits, sem alterações no motor, sem instalações)  
> **Data**: 2026-09-17  

---

## 1. RESUMO EXECUTIVO

Esta auditoria técnica compara de forma factual e aprofundada as capacidades, arquiteturas e implementações entre o **PUB DEV LOOP (PDL)** e o **Hermes Agent (v0.20.1)**, instalado localmente em `C:\Users\Matheus Paes\AppData\Local\hermes\hermes-agent`.

### Principais Conclusões:
1. **Diferença de Natureza e Propósito de Engenharia**:
   - O **Hermes** é um **Interactive / CLI Autonomous Agent Runtime** (Python 3.11, ~8.000 linhas em `conversation_loop.py`, focado em conversação multi-turn com humano, compressão dinâmica de contexto, sessões SQLite/JSON, TUI/CLI, suporte a ACP e execução interativa de ferramentas com prompts de aprovação humana).
   - O **PDL** é um **Autonomous Software-Delivery Engine / Harness** (Node.js/TypeScript, focado em agendamento contínuo em background, filas transacionais PostgreSQL com `SKIP LOCKED`, leases de worker, DLQ persistente, reaper de tarefas zumbis, selagem de especificações de execução `ExecutionSpec`, portão de persistência remota via Git/GitHub, governança fail-closed corporativa e isolamento estrito de produtos).
2. **Equivalência da Camada de Tool Calling e Provedores**:
   - Ambos consom provedores compatíveis com OpenAI API (OpenRouter, 9Router local/cloud).
   - Ambos implementam loop de ferramentas com esquemas JSON de funções (`read_file`, `write_file`, `exec_command`, `git_status`, `git_diff`).
   - O PDL já possui em `src/providers/openrouter.ts` e `src/tools/runtime.ts` um mini-runtime completo de execução de ferramentas com controle de rodadas, timeout, bloqueio de comandos perigosos e sanitização de variáveis.
3. **A Real Lacuna do PDL NÃO é a Falta do Hermes**:
   - O PDL não sofre de deficiência arquitetural que exija a importação ou acoplamento do Hermes.
   - O PDL possui tudo o que precisa estruturalmente: fila, scheduler, isolamento de workspace, execução de comandos, verificação de testes, governança, DLQ e entrega remota.
   - **O gargalo do PDL é exclusivamente empírico**: o loop do worker (`RouterWorker` / `worker-service.ts`) ainda roda com `MockProvider` em suas baterias de teste e no seu piloto E2E. Falta apenas plugar e validar o `OpenRouterProvider` real em uma tarefa de engenharia real de ponta a ponta sem interferência de mocks.
4. **Hermes NÃO é Dependência do PDL**:
   - Integrar o Hermes ao PDL introduziria uma ponte de processo externo (Python subprocess / JSON-RPC / ACP), duplicaria o gerenciamento de sessões e conflitaria diretamente com as regras de governança estritas do PDL (Regra 1: Free Models Only, Regra 2: Fail Closed, Regra 3: Product Isolation).

---

## 2. MATRIZ DE PARIDADE TÉCNICA

| Capability | PDL | Hermes | Evidência PDL | Evidência Hermes | Diferença Concreta |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Agent Loop** | `FUNCTIONAL` | `PROVEN` | `src/providers/openrouter.ts:202-611` | `agent/conversation_loop.py:run_conversation` | PDL é bounded por tarefa (maxToolRounds=20). Hermes é loop de conversação contínua de turnos. |
| **Multi-turn / Multi-round** | `FUNCTIONAL` | `PROVEN` | `src/providers/openrouter.ts` (`messages.push`) | `agent/conversation_loop.py` & `agent/turn_context.py` | Ambos empilham mensagens `assistant` e `tool`. Hermes suporta sessões interativas multi-turn com usuário; PDL suporta rodadas de tool calling de uma tarefa. |
| **Context Management** | `PARTIAL` | `PROVEN` | `src/providers/openrouter.ts:141-144` | `agent/context_compressor.py` (~7.300 linhas) | Hermes tem compactação automática de contexto com modelo auxiliar. PDL tem apenas concatenação de prompt e histórico de ferramentas da tarefa. |
| **Sessions** | `PARTIAL` | `PROVEN` | `src/office/ceo-conversation-store.ts` (em memória) | `hermes_state.py` (SQLite durável, resume, branch) | Hermes persiste sessões completas no SQLite local. PDL persiste tarefas em PostgreSQL (`tasks`) e histórico do CEO em memória transitória. |
| **OpenRouter** | `PROVEN` | `PROVEN` | `src/providers/openrouter.ts`, `tests/providers/openrouter.test.ts` | `providers/`, `config.yaml` (`provider: openrouter`) | Implementações diretas da API OpenAI Chat Completions via HTTP fetch / SDK. |
| **9router** | `PROVEN` | `PROVEN` | `src/providers/router.ts` | `config.yaml` (`provider: custom:pub-9router-cloud.onrender.com`) | Ambos roteiam para instâncias 9Router. |
| **Dual Gateway / Fallback** | `PROVEN` | `PROVEN` | `src/providers/gateway.ts`, `src/router-worker.ts` | `agent/error_classifier.py`, `fallback_providers` em `config.yaml` | Ambos realizam failover por código HTTP (429, 500, timeout). PDL possui classificação específica de erro 400 da Nvidia (`src/api-error-classifier.ts`). |
| **Model Routing / Policy** | `PROVEN` | `FUNCTIONAL` | `src/providers/model-routing-policy.ts`, `model-registry.ts` | `agent/model_metadata.py` | PDL possui restrição institucional estrita **Rule 1 (FREE MODELS ONLY - 0/0 pricing)**. Hermes suporta qualquer modelo configurado pelo usuário. |
| **Tool Calling** | `FUNCTIONAL` | `PROVEN` | `src/tools/runtime.ts` (`getToolDefinitions`, `executeTool`) | `agent/tool_executor.py`, `tools/` | Ambos emitem formato JSON OpenAI `tools: [...]` e despacham chamadas. |
| **Shell** | `PROVEN` | `PROVEN` | `src/executor.ts` (`AgentExecutor`), `src/tools/runtime.ts` | `tools/terminal_tool.py` | PDL executa via subprocesso com timeout e sanitização estrita de variáveis de ambiente. Hermes possui backend de terminal configurável (local/docker). |
| **Filesystem** | `PROVEN` | `PROVEN` | `src/tools/runtime.ts` (`read_file`, `write_file`, `list_files`) | `tools/file_tools.py` | Ambos confinam caminhos à raiz do projeto/workspace. |
| **Workspace Isolation** | `PROVEN` | `PARTIAL` | `src/worker-service.ts` (`mkdtemp` + git clone isolado) | `hermes --worktree` (git worktree) / local directory | PDL cria workspace temporário independente por tentativa. Hermes opera por padrão no CWD ou cria git worktrees opcionais. |
| **Test Execution** | `PROVEN` | `PARTIAL` | `src/finalizer.ts` (`options.testCommand` com fail-closed) | `agent/verification_stop.py` (nudge passivo de verificação) | PDL exige testes automatizados obrigatórios antes de qualquer commit/push. Hermes apenas sugere ao modelo verificar edições de código antes de parar. |
| **Correction Loop** | `MOCK ONLY` | `PARTIAL` | `src/pdl/correction/correction-loop.ts` | `agent/turn_finalizer.py` (synthetic nudge) | PDL tem lógica formal de injeção de diagnóstico de teste untrusted (testado apenas com Mock). Hermes reinsere prompt no chat para continuar gerando. |
| **Retry / Backoff** | `PROVEN` | `PROVEN` | `src/pdl/retry/`, `src/pdl/dlq/` | `agent/retry_utils.py` | PDL tem política formal de retentativa, fator exponencial, backoff e quarentena em DLQ (`pdl_dead_letters`). Hermes tem retries de chamada de API. |
| **Timeout Handling** | `PROVEN` | `PROVEN` | `src/worker-service.ts`, `src/executor.ts` | `agent/reasoning_timeouts.py` | Ambos possuem timeouts granulares por comando, por chamada de API e por ciclo global. |
| **Git Operations** | `PROVEN` | `PARTIAL` | `src/finalizer.ts`, `src/pdl/persistence/remote-persistence.ts` | `tools/git_tools.py` | PDL gerencia o ciclo Git completo: commit sanitizado, validação de integridade contra trust root, push remoto, verificação de SHA via `git ls-remote`. Hermes trata Git como ferramentas invocáveis. |
| **Long-running / Batch** | `PROVEN` | `PARTIAL` | `src/pdl/scheduler/continuous-scheduler.ts`, `PdlTaskReaper` | `batch_runner.py` | PDL possui agendador contínuo com ciclo de vida boundado, limite de tarefas consecutivas, kill-switch e reaper de tarefas zumbis. Hermes é primariamente interativo. |
| **Permission / Safety** | `PROVEN` | `PROVEN` | `src/tools/security.ts`, `src/pdl/security/trust-boundary.ts` | `agent/file_safety.py`, approval prompts | PDL aplica modelo **fail-closed incondicional** (bloqueia subcomandos git destrutivos, paths protegidos, credenciais). Hermes solicita aprovação interativa (TTY prompt) ou `--yolo`. |
| **Governance** | `PROVEN` | `NOT FOUND` | `src/pdl/governance/policy-engine.ts` (Níveis 0 a 4) | Inexistente (focado em segurança de arquivos/comandos locais) | Exclusividade do PDL: governança corporativa em banco de dados, kill-switch atômico, catálogo de produtos autorizados. |
| **Observability** | `PROVEN` | `PROVEN` | `src/router-worker.ts` (`WorkerExecutionTrace` em PostgreSQL) | `hermes_logging.py`, `agent.log`, dashboard local | PDL armazena rastreabilidade transacional estruturada por tarefa. Hermes gera logs detalhados de rotação e dashboard web opcional. |

---

## 3. O VERDADEIRO AGENT CORE: SEPARAÇÃO DE RESPONSABILIDADES

Para entender onde reside a autonomia em cada sistema:

```text
┌────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
│ Camada                 │ Como o Hermes Resolve            │ Como o PDL Resolve               │
├────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
│ 1. Provider            │ OpenAI SDK / custom HTTP         │ OpenRouterProvider / Router      │
│ 2. Gateway             │ OpenRouter / 9Router / Fallbacks │ DualGatewayProvider / Fallbacks  │
│ 3. Agent (Raciocínio)  │ LLM em conversation_loop.py      │ LLM em OpenRouterProvider        │
│ 4. Runtime (Ferramentas│ ToolExecutor + file/terminal     │ ToolRuntime (read/write/exec)    │
│ 5. Orchestrator        │ CLI / REPL / TUI / batch_runner  │ ContinuousScheduler / Reaper     │
│ 6. Delivery & Governan.│ Manual / Verificação opcional    │ TaskFinalizer / RemotePersist.   │
└────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
```

### Análise:
- No **Hermes**, a autonomia é impulsionada pela **conversa interativa** e pela **tolerância a erros de diálogo**: se o modelo erra a chamada de uma ferramenta ou estoura o contexto, o `context_compressor.py` e o `tool_executor.py` tentam recuperar o diálogo mantendo o usuário informado.
- No **PDL**, a autonomia é impulsionada pela **transacionalidade e governança de entrega**: o sistema assume que a execução do agente é um componente substituível que roda dentro de um workspace estritamente contido. O motor não confia no agente — ele valida o resultado com testes automatizados, inspeciona o `git diff`, verifica se o código alterou apenas o que tinha direito e realiza o push se e somente se todas as regras forem cumpridas.

---

## 4. IDENTIFICAÇÃO DAS LACUNAS REAIS DO PDL

O PDL possui todas as camadas estruturais: fila, scheduler, catálogo de modelos gratuitos, sandbox de workspace, executor de ferramentas, validador de testes e persistência remota.

As diferenças e eventuais lacunas em relação ao Hermes são:

### Lacuna 1: Compressão Automática de Context Window
- *No Hermes*: Possui um subsistema de compressão (`agent/context_compressor.py`) de ~7.300 linhas que resume mensagens antigas quando atinge 50% da janela de contexto.
- *No PDL*: Se uma tarefa exceder a janela de contexto durante as 20 rodadas de ferramentas, a API falhará com erro de context limit e o PDL acionará o fallback de modelo ou marcará a tentativa como falha.
- *É necessária para autonomia básica?*: **NÃO**. Para tarefas de engenharia normais no PDL (que são focadas em um objetivo pontual definido na `ExecutionSpec`), 20 rodadas e orçamentos de arquivo de 1MB são mais que suficientes. A compressão é uma sofisticação para conversas humanas longas.
- *Pode ser feita no PDL se necessária?*: **SIM**, com um truncamento simples do histórico de saídas de ferramentas em `messages`.

### Lacuna 2: Sanitização e Reparo de Argumentos de Tool Calling
- *No Hermes*: Possui `_repair_tool_call_arguments` e parsers tolerantes para modelos que geram JSON quebrado.
- *No PDL*: Em `src/providers/openrouter.ts:577`, o PDL faz `JSON.parse(tc.function.arguments)` e se falhar adiciona um erro no resultado da ferramenta (`'Failed to parse tool arguments as JSON'`), permitindo que o modelo tente corrigir na rodada seguinte.
- *É necessária para autonomia?*: Já existe parcialmente no PDL de forma funcional.

### Lacuna 3: A PROVA DE EXECUÇÃO DO PROVEDOR REAL NO WORKER (A ÚNICA LACUNA CRÍTICA)
- *No Hermes*: O Hermes executa prompts reais contra modelos reais no dia a dia.
- *No PDL*: Embora o código do `OpenRouterProvider` com suporte a `ToolRuntime` esteja 100% escrito e testado unitariamente, o `RouterWorker` nos testes de integração e o script de piloto (`scripts/run-e2e-pilot.ts`) foram executados com `MockProvider`.
- *O Hermes resolve isso?*: **NÃO**. O Hermes não resolveria isso porque a infraestrutura para fazer a chamada real já existe no próprio PDL (`OpenRouterProvider`). O que faltou foi simplesmente executar o worker do PDL apontando para o provedor real.

---

## 5. ANÁLISE DE DUPLICAÇÃO (PDL ↔ HERMES)

Se o Hermes fosse importado ou acoplado ao PDL, ocorreria:

1. **Duplicação Real de Roteamento de LLM**:
   - O PDL já tem `model-registry.ts` com restrição rígida de modelos gratuitos (Rule 1). O Hermes tem seu próprio sistema de resolução em `config.yaml` e `model_metadata.py`. Acoplar os dois criaria conflito de autoridade sobre qual modelo pode ser chamado.
2. **Duplicação Real de Execução de Ferramentas**:
   - O PDL já tem `ToolRuntime` em TypeScript que executa ferramentas no workspace isolado. O Hermes tem `ToolExecutor` em Python. Ter os dois seria redundância sem benefício funcional.
3. **Incompatibilidade de Governança**:
   - O PDL é projetado para operar sem intervenção humana com **governança fail-closed** e níveis estritos (Level 0 a Level 4). O Hermes foi projetado prioritariamente para um operador humano interagindo via terminal ou aprovando comandos interativamente.

---

## 6. CONCLUSÃO OBRIGATÓRIA

### A. O HERMES É NECESSÁRIO?
> **NÃO.**

**Justificativa Técnica**:
O PDL já possui sua própria implementação completa de todas as primitivas necessárias para a execução de agentes de software: cliente de API LLM com tool calling (`OpenRouterProvider`), runtime de ferramentas com restrição de diretório (`ToolRuntime`), executor de subprocessos (`AgentExecutor`), isolamento de workspace temporário, testes automatizados, auto-commit, verificação de branch/SHA e push remoto. Importar o Hermes traria acoplamento cross-language (Python dentro de um backend Node.js), dependências externas pesadas e violaria a integridade da governança fail-closed do PDL.

### B. QUAL É A ÚNICA CAPACIDADE MAIS IMPORTANTE QUE O PDL AINDA PRECISA PROVAR?
> **A execução autônoma de ponta a ponta do seu próprio `OpenRouterProvider` com modelo gratuito real (`0/0` pricing) manipulando um repositório real via `ToolRuntime`, sem intervenção de mocks.**

### C. QUAL É O PRÓXIMO EXPERIMENTO RECOMENDADO?
> **Executar uma tarefa canônica mínima através do próprio `scripts/run-e2e-pilot.ts`, substituindo o `pilotProvider` mock pelo `OpenRouterProvider` nativo do PDL apontando para um modelo gratuito verificado (ex: `nvidia/nemotron-3-super-120b-a12b:free`), permitindo que o modelo leia o arquivo, escreva o código, passe pelo `TaskFinalizer` e realize o push verificado no repositório de teste.**

### D. QUAL ARQUITETURA DEVE SER PRESERVADA?
> **Toda a infraestrutura do PDL deve ser preservada intacta:**
> - `src/pdl/scheduler/` (ContinuousScheduler)
> - `src/pdl/governance/` (PdlGovernanceEngine, Rule 1, Rule 2)
> - `src/pdl/persistence/` (PersistenceGate, PdlRemotePersistence)
> - `src/pdl/retry/` & `src/pdl/dlq/` (PdlRetryPolicy, pdl_dead_letters)
> - `src/pdl/reaper/` (PdlTaskReaper)
> - `src/finalizer.ts` (TaskFinalizer)
> - `src/tools/runtime.ts` & `src/providers/openrouter.ts`

---

## 7. VEREDITO INSTITUCIONAL FINAL

> **"Se removermos o Hermes da equação hoje, nenhuma capacidade essencial do PDL deixa de existir. O PDL possui um motor completo de entrega, agendamento, governança e execução de ferramentas. O Hermes é apenas uma referência externa de runtime interativo. O único passo pendente do PDL para atingir a autonomia real é comprovar seu próprio pipeline nativo contra uma LLM real."**

**HERMES NÃO É DEPENDÊNCIA DO PDL.**

# PUB DEV LOOP — Central de Comando / Escritório Virtual 3D

## Visão Geral

O **Escritório Virtual do PUB DEV LOOP** é a interface de observabilidade e controle operacional em 3D sobre o orquestrador **9Router** e o motor de tarefas e execução do PUB DEV LOOP.

---

## 1. Beta V0.1 — Base de Observabilidade (Validada)

- **Commit de Base**: `ca5ccf04215f3deba7514ab569e31e18571d65a7`
- **Infraestrutura**: PostgreSQL 16 Alpine + 9Router Container + Worker + API Node.js/Express.
- **3D Engine**: React 19 + Three.js + React Three Fiber + Drei + Zustand.
- **Agente Real**: Derivado diretamente do estado de execução do `RouterWorker` e das tarefas registradas no PostgreSQL.
- **Mapeamento de Salas 3D**:
  - `QUEUED` / `ASSIGNED` → **Planejamento** `[-11, 0, 7]`
  - `RUNNING` → **Desenvolvimento** `[0, 0, 7]`
  - `TESTING` → **Testes** `[11, 0, 7]`
  - `NEEDS_REVIEW` → **Revisão** `[-11, 0, -7]`
  - `COMPLETED` / `CANCELLED` → **Lounge** `[0, 0, -7]`
  - `FAILED` / `BLOCKED` → **Bloqueados** `[11, 0, -7]`

---

## 2. Beta V0.2 — Central de Comando Operacional (Atual)

- **Branch**: `feat/virtual-office-v0.2-control`
- **Objetivo**: Permitir ações de controle e gestão de tarefas pelo operador diretamente na interface visual.

### APIs Reais Utilizadas
| Endpoint | Método | Descrição |
|---|---|---|
| `/health` | `GET` | Verificação de disponibilidade da API e do backend. |
| `/tasks` | `GET` | Listagem de todas as tarefas cadastradas, ordenadas por prioridade e data. |
| `/tasks` | `POST` | Criação de nova tarefa de desenvolvimento com projeto, repositório, objetivo, prompt e prioridade. |
| `/tasks/:id` | `GET` | Consulta dos detalhes, branches, commits e resultados de uma tarefa específica. |
| `/tasks/:id/cancel` | `POST` | Cancelamento operacional de uma tarefa em fila ou em execução. |
| `/tasks/:id/retry` | `POST` | Reexecução / reinserção de uma tarefa finalizada ou cancelada de volta à fila de execução. |

### Controles e Ações Disponíveis
1. **Nova Tarefa (`NOVA TAREFA`)**:
   - Modal com formulário validado para envio de novas tarefas ao `POST /tasks`.
   - Campos: Projeto, Repositório Git, Objetivo, Prompt detalhado, Prioridade.
2. **Painel de Controle da Tarefa (`CONTROLE DA TAREFA`)**:
   - Exibição de ID, projeto, repositório, objetivo, estado, agente, provedor, modelo, duração, commit e diagnóstico de erro.
   - **Ver Tarefa**: Modal com todos os dados da tarefa, prompts e branches.
   - **Ver Registros**: Terminal visual com `stdout`, `stderr` e mensagens de erro do agente.
   - **Ver Resultado**: Diagnóstico completo com modelo, duração e objeto de execução.
   - **Ver Commit**: Exibição do commit SHA gerado pelo auto-commit.
   - **Atualizar**: Botão de recarregamento manual sob demanda.
   - **Cancelar Tarefa**: Ação com diálogo modal de confirmação antes de chamar `/tasks/:id/cancel`.
   - **Reexecutar Tarefa**: Ação com diálogo modal de confirmação antes de chamar `/tasks/:id/retry`.

---

## 3. Segurança Operacional

- **Zero Exposição de Segredos**: Não há trânsito de `ROUTER_API_KEY`, senhas de banco, `DATABASE_URL` ou credenciais para o frontend.
- **Confirmação Visual de Ações**: Cancelamento e reexecução exigem confirmação explícita do operador em modal.
- **Isolamento de Runtime**: O backend/worker permanece isolado com permissões estritas de workspace.

---

## 4. Limitações Conhecidas no V0.2

- **Polling Controlado**: A interface utiliza polling a cada 3 segundos para sincronização de estado com o backend.
- **Single Worker Visual**: O agente no escritório representa a tarefa ativa em execução ou a última tarefa operada pelo 9Router Worker.

---

## 5. Plano de Arquitetura para o Beta V0.3 (Realtime)

1. **Server-Sent Events (SSE) / WebSocket Gateway**:
   - Criar um canal de streaming na API (`/events` ou WebSocket) publicando eventos do `PostgresTaskRepository` (via `LISTEN/NOTIFY` do PostgreSQL ou EventEmitter interno).
2. **Eventos em Tempo Real**:
   - `TASK_CREATED`, `TASK_CLAIMED`, `TASK_HEARTBEAT`, `TASK_STEP`, `TASK_COMPLETED`, `TASK_FAILED`.
3. **Animação Contínua de Agentes**:
   - Interpolação de movimento tridimensional (`useFrame` lerp) entre as salas conforme os eventos SSE chegam.
4. **Múltiplos Workers Concorrentes**:
   - Suporte visual a múltiplos agentes simultâneos navegando pelas salas do escritório virtual.

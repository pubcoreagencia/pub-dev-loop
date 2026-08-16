# PUB DEV LOOP — Master Context

## Objetivo
Plataforma de desenvolvimento automatizado de loops de publicação para PUB DEV LOOP.

## Arquitetura Atual

```
TASK → 9Router → tool calls → agent COMPLETED → BaseWorker.executeOnce() → TaskFinalizer → validation → auto-commit → working tree clean → COMPLETED
```

### Fluxo Principal
1. **TASK** — `Task` é criada e colocada na fila
2. **9Router** — `RouterProvider` roteia para modelo via 9Router proxy (`ag/gemini-3-flash`, etc.)
3. **Tool calls** — Modelo usa `ToolRuntime` tools (`write_file`, `read_file`, `list_files`, `git_status`, `git_diff`, `git_commit`, `run_command`)
4. **Agent COMPLETED** — Modelo termina com `finish_reason: stop`
5. **BaseWorker.executeOnce()** — Clona repo, cria branch, executa agent, **verifica status**
6. **TaskFinalizer** — Valida mudanças, roda testes (opcional), comita automaticamente
7. **Auto-commit** — `git add -A`, `git commit`, SHA retornado
8. **Working tree clean** — Validado via `git status --short`

### Context Bootstrap
`src/context/agent-context.ts` — carrega e valida contexto operacional de `.agent/`.
Antes de qualquer task: `git fetch`, verificar HEAD vs origin/main, ler `.agent/*.md`.

### Agentes
- **Hermes** — Agente principal (este)
- **Codex** — Agente secundário (via CLI, `codex`)

### Componentes

| Component | File | Descrição |
|-----------|------|-----------|
| `RouterProvider` | `src/providers/router.ts` | Integração com 9Router proxy (OpenAI-compatible) |
| `ToolRuntime` | `src/tools/runtime.ts` | Executa tools solicitadas pelo modelo |
| `WorkspaceSecurity` | `src/tools/security.ts` | Contém filesystem ao workspace root |
| `AgentExecutor` | `src/executor.ts` | Executa comandos via `spawn` (shell: false) |
| `BaseWorker` | `src/worker-service.ts` | Worker abstrato: clone → executeTask → finalize |
| `TaskFinalizer` | `src/finalizer.ts` | Valida + auto-commit (bloca push/reset/clean) |
| `CodexWorker` | `src/worker-service.ts` | Worker concreto para Codex CLI |
| `AgentContext` | `src/context/agent-context.ts` | Carrega/valida contexto operacional |
|| `RouterWorker` | `src/router-worker.ts` | Worker permanente usando AgentProvider (RouterProvider) |

### Security Policies
- `git_commit` tool: **modelo NÃO deve chamar** — system prompt instrui "Do NOT use git_commit"
- TaskFinalizer bloqueia: `push`, `remote`, `reset`, `clean`, `checkout --`, `restore`, `fetch`, `pull`, `merge`, `branch -D`/`-d`
- `sanitizeCommitMessage()`: trunca a 200 chars, remove controlchars
- `WorkspaceSecurity`: resolvePath valida paths dentro do workspace

### Decisões Arquiteturais
- Commit final é responsabilidade do **Worker/Runtime**, não do modelo
- `BaseWorker.executeOnce()` verifica `result.status`:
  - `FAILED` → não chama finalizer, não comita, preserva error
  - `COMPLETED` → chama `TaskFinalizer.finalize()` → auto-commit
- `FAILED_UNEXPECTED_CHANGES`: NOT YET IMPLEMENTED (limitation documentada)
- `.agent/` é fonte canônica do contexto operacional; Git é fonte canônica do código
- `CURRENT_STATE.md` uses `LAST_KNOWN_STABLE_COMMIT` (not volatile HEAD) to avoid bootstrap loop

### Limitations Conhecidas
1. `CODEX_CLI_UNAVAILABLE` — CLI Codex não instalado no Windows
2. `FAILED_UNEXPECTED_CHANGES` — IMPLEMENTADO ✅ (WorkspaceValidator + baseline); CODEX_CLI_UNAVAILABLE (environmental)
3. `RouterWorker` permanente — não implementado (a usar `TestRouterWorker`)
4. Retry, fallback, parallel tasks, auto-push/PR/merge — não implementados

### Testes
- `tests/e2e-auto-commit.test.ts` — 4 testes (simulação)
- `tests/e2e-real-worker.test.ts` — 5 testes (9Router real)
- `tests/finalizer.test.ts` — 11 testes (unit)
- `tests/git-tool.test.ts` — 13 testes (integration)
- `tests/executor.test.ts` — 6 testes (1 environmental: CODEX_CLI_UNAVAILABLE)
- `tests/context/` — 3 arquivos, 23 testes (context loading, git state, handoff)
- `src/context/cli.ts` — CLI de validação

### Comandos Oficiais
```bash
npm run build        # tsc -p tsconfig.json
npm test             # vitest run
# E2E real (necessita 9Router proxy rodando):
RUN_9ROUTER_E2E=1 ROUTER_MODEL=ag/gemini-3-flash npx vitest run tests/e2e-real-worker.test.ts
# Context validation:
npx tsx src/context/cli.ts --validate
npx tsx src/context/cli.ts --summary
npx tsx src/context/cli.ts --git-state
```

### Estado Atual
- Branch: `main` @ `e65e814` (synced)
- Origin: `pubcoreagencia/pub-dev-loop`
- Build: ✅ exit 0
- Tests: 78/87 pass (1 environmental: CODEX_CLI_UNAVAILABLE), 8 skipped
- Context: ✅ bootstrapped + validated (23 unit tests)
- RouterWorker: ✅ permanente implementado (`fe37d6c`)

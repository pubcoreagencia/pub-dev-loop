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

### Limitations Conhecidas
1. `CODEX_CLI_UNAVAILABLE` — CLI Codex não instalado no Windows
2. `FAILED_UNEXPECTED_CHANGES` — `allowUnexpectedFiles` não aplicado; `git add -A` cometa tudo
3. RouterWorker permanente — não implementado ainda
4. Retry, fallback, parallel tasks, auto-push/PR/merge — não implementados

### Testes
- `tests/e2e-auto-commit.test.ts` — 4 testes (simulação)
- `tests/e2e-real-worker.test.ts` — 5 testes (9Router real)
- `tests/finalizer.test.ts` — 11 testes (unit)
- `tests/git-tool.test.ts` — 13 testes (integration)
- `tests/executor.test.ts` — 6 testes (1 environmental failure: CODEX_CLI_UNAVAILABLE)

### Comandos Oficiais
```bash
npm run build        # tsc -p tsconfig.json
npm test             # vitest run
# E2E real (necessita 9Router proxy rodando):
RUN_9ROUTER_E2E=1 ROUTER_MODEL=ag/gemini-3-flash npx vitest run tests/e2e-real-worker.test.ts
```

### Estado Atual
- Branch: `main` @ `a3ef616`
- Origin: `pubcoreagencia/pub-dev-loop`
- Build: ✅ exit 0
- Tests: 47/48 pass (1 environmental)
- E2E 9Router: ✅ 5/5 pass

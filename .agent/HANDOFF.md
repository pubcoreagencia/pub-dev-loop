# HANDOFF.md — Operacional: Transição entre Executores (Codex → Hermes)

## Visão Geral
Este documento fornece ao próximo executor (Agent B / Hermes) todo o contexto necessário para continuar o trabalho sem depender de histórico de conversa anterior.

## Estado Git Atual
|| Campo | Valor |
||-------|-------|
|| **Branch** | `main` |
|| **LOCAL HEAD** | `8b0589d0ee00733612282a5d4f5ffb593410663e` |
|| **REMOTE HEAD** | `8b0589d0ee00733612282a5d4f5ffb593410663e` |
|| **HEAD == origin/main** | **SIM** |
|| **Working Tree** | Clean (only `.agent/` files added) |
|| **CURRENT_TASK** | `TASK-000006` |
|| **NEXT_TASK** | `TASK-000008` |

## Operações Concluídas (último executor)
### 12.1 — Self-Correcting Prototype Worker ✅
- Commit: `f6ee11a`

### 12.2A — Workforce Contract Audit ✅
- Commit: `aa77bdd`

### 12.2B — Type Reconciliation ✅
- Commit: `ba9aa62`

### 12.2B-FIX — SpecializedAgent Source Typing ✅
- Commit: `fbc9e42`

### 12.2C — Test Schema Reconciliation ✅
- Commit: `43ff6fa`

### 12.2D — `.agent/` Context + Handoff + Governance Foundation ✅
- **Status**: COMPLETE ✅
- **Commit**: `8b0589d0ee00733612282a5d4f5ffb593410663e`
- **Baseline**: `43ff6fa`
- **Typecheck**: EXIT_CODE=0 ✅
- **Testes Office**: 41/41 PASS ✅
- **Context/handoff tests**: 23/23 PASS ✅
- **DO_NOT_REPEAT**: não re-run 12.1, não reescrever histórico, não usar --force

## Operação Atual (a ser continuada)

### 12.2D — `.agent/` Context + Handoff + Governance Foundation ✅
- **Status**: COMPLETE ✅
- **Commit**: `8b0589d0ee00733612282a5d4f5ffb593410663e`
- **Baseline**: `43ff6fa`
- **Typecheck**: EXIT_CODE=0 ✅

## Known Limitations

1. CODEX_CLI_UNAVAILABLE — Codex CLI not available on this Windows environment
2. HERMES_DESKTOP_ONLY — Only Hermes desktop is available; no Codex/CLI alternative
3. WINDOWS_SCHEDULER_DEPENDENCY — PDL Supervisor uses Windows Task Scheduler
4. FULL_SUITE_29_PREEXISTING_FAILURES — 29 preexisting failures (out of scope)
5. DO_NOT_REPEAT — Never repeat completed operation; never rewrite Git history

## DO_NOT_REPEAT

- **Nunca** refazer operação 12.1 já concluída
- **Nunca** reescrever histórico Git (reset, force-push, rebase sobre main)
- **Nunca** alterar `FIFTY_SPECIALIZED_AGENTS` tipo ou conteúdo
- **Nunca** introduzir `as any` em produção
- **DO_NOT_REPEAT: do not re-run; não recriar; 9router**
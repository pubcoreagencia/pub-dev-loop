# CURRENT_STATE

| **REPOSITORY** | C:/Users/Matheus Paes/Documents/ChatGPT/PUB DEV LOOP |
| **CURRENT_BRANCH** | main |
| **LOCAL HEAD** | `9cb2be1386483ddead9dce63d386ae4673692471` |
| **REMOTE HEAD** | `9cb2be1386483ddead9dce63d386ae4673692471` |
| **SYNC** | YES |
| **WORKTREE** | clean |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente; 2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200; 3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo |

## Task Status
| **CURRENT_TASK** | TASK-000041 — OpenRouter Primary / 9Router Secondary Two-Tier Fallback Gateway |
| **NEXT_TASK** | TASK-000042 |
| **LAST_COMPLETE** | TASK-000041 |
| **LAST_COMMIT_STABLE** | `9cb2be1` |

## Validation
| **TYPECHECK** | PASS |
| **BUILD** | PASS |
| **GATEWAY_HARDENING_TESTS** | 16 passed (14 unit + 2 E2E simulation) |
| **FULL_TESTS** | 191 passed, 10 skipped, 0 failed |
| **DEVLOOP_VALIDATE** | PASS |

## Inference Gateways & Two-Tier Fallback
| Primary Gateway | OpenRouter (https://openrouter.ai/api/v1) — Commercial / Free + Paid |
| Secondary Gateway | 9Router (http://127.0.0.1:20128/v1) — Local / OAuth / Free providers |
| Two-Tier Fallback | Tier 1: OpenRouter modelo interno -> retry / fallback de modelos (`OPENROUTER_FALLBACK_MODELS`); Tier 2: `GATEWAY_EXHAUSTED` / `ALL_PROVIDERS_FAILED` -> 9Router (`ROUTER_FALLBACK_MODELS`) |
| Partial Execution Guard | Falha após mutação de workspace retorna `PARTIAL_EXECUTION_REQUIRES_REVIEW` e BLOQUEIA fallback automático para evitar corrupção de workspace |

## Implementation
- `src/providers/gateway.ts`: `hasMutableEffects` + bloqueio com `PARTIAL_EXECUTION_REQUIRES_REVIEW`
- `tests/gateway.test.ts`: 10 testes cobrindo permissão pré-mutação, bloqueio pós-mutação e observabilidade
- `tests/gateway-e2e.test.ts`: 2 testes realistas de simulação com filesystem e ToolRuntime
- `tests/integration/openrouter-e2e.integration.test.ts`: E2E condicional

## Environment
- 9Router: instância única em 127.0.0.1:20128
- Banco: C:\Users\Matheus Paes\AppData\Roaming\9router\db\data.sqlite
- Docker: postgres healthy, api healthy, worker healthy

## Known Limitations
1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente
2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200
3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo

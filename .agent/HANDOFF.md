# HANDOFF

| **CURRENT_TASK** | TASK-000038 — Hardening do Dual Gateway (Partial Execution & Mutation Guard) |
| **NEXT_TASK** | TASK-000039 |
| **CURRENT_AGENT** | Hermes |
| **BRANCH** | main |
| **LOCAL HEAD** | `a4b5577` |
| **REMOTE_HEAD** | `a4b5577` |
| **SYNC** | YES |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente; 2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200; 3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo |

## State
- Hardening do Dual Inference Gateway concluído e validado com 187 testes passando sem falhas.
- `DualGatewayProvider` avalia `hasMutableEffects` (verificando `changedFiles`, `toolCalls`, `toolRounds`) antes de decidir fallback.
- Se o gateway primário falhar após criar/modificar arquivos ou executar tool calls, o fallback é BLOQUEADO e é retornado `errorCode: 'PARTIAL_EXECUTION_REQUIRES_REVIEW'` com status `FAILED`.
- Se o gateway primário falhar antes de qualquer efeito mutável (infra/rede/429/500 pré-start), o fallback ocorre com total segurança.

## DO_NOT_REPEAT
- Não permitir fallback automático quando o workspace já tiver sofrido mutações
- Não colocar OpenRouter dentro do 9Router nem 9Router dentro do OpenRouter
- Não forçar merge/reset/rebase para resolver divergência Git
- Nunca commitar API keys ou credenciais

# HANDOFF

| **CURRENT_TASK** | TASK-000041 — OpenRouter Primary / 9Router Secondary Two-Tier Fallback Gateway |
| **NEXT_TASK** | TASK-000042 |
| **CURRENT_AGENT** | Hermes |
| **BRANCH** | main |
| **LOCAL HEAD** | `9cb2be1` |
| **REMOTE_HEAD** | `9cb2be1` |
| **SYNC** | YES |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente; 2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200; 3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo |

## State
- Arquitetura de fallback em duas camadas (Two-Tier Fallback) implementada e validada com 191 testes unitários/E2E passando.
- Camada 1: OpenRouter executa como gateway primário tentando seus modelos internos configurados (`OPENROUTER_MODEL` + `OPENROUTER_FALLBACK_MODELS`).
- Camada 2: Somente após esgotamento terminal do OpenRouter (`GATEWAY_EXHAUSTED` / `ALL_PROVIDERS_FAILED`) e sem efeitos mutáveis prévios (`changedFiles == 0 && toolCalls == 0`), o fallback é acionado para o 9Router secundário (`ROUTER_MODEL` + `ROUTER_FALLBACK_MODELS`).
- Proteção `PARTIAL_EXECUTION_REQUIRES_REVIEW` preservada intacta.

## DO_NOT_REPEAT
- Não permitir fallback automático quando o workspace já tiver sofrido mutações
- Não colocar OpenRouter dentro do 9Router nem 9Router dentro do OpenRouter
- Não forçar merge/reset/rebase para resolver divergência Git
- Nunca commitar API keys ou credenciais

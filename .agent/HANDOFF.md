# HANDOFF

| **CURRENT_TASK** | TASK-000037 — Dual Gateway de Inferência Independente: 9Router + OpenRouter |
| **NEXT_TASK** | TASK-000038 |
| **CURRENT_AGENT** | Hermes |
| **BRANCH** | main |
| **LOCAL HEAD** | `009bd38` |
| **REMOTE_HEAD** | `eb8c8fe` |
| **SYNC** | NO |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente; 2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200; 3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo; 4. devloop:validate falha quando LOCAL HEAD != REMOTE HEAD |

## State
- Dual Inference Gateway implementado: 9Router (Gateway A) e OpenRouter (Gateway B) operando como gateways irmãos independentes
- `OpenRouterProvider` com suporte a OpenAI tools chat completions e modelos customizáveis (`OPENROUTER_MODEL`)
- `DualGatewayProvider` com política bidirecional de fallback (`PRIMARY_GATEWAY` e `FALLBACK_GATEWAY`)
- 183 testes passando sem falhas (incluindo testes unitários e de integração de gateway)

## DO_NOT_REPEAT
- Não colocar OpenRouter dentro do 9Router nem 9Router dentro do OpenRouter
- Não recriar mapeamento provider/alias do 9Router sem confirmação de source oficial
- Não repetir diagnóstico OpenCode/oc sem nova evidência
- Não forçar merge/reset/rebase para resolver divergência Git
- Nunca commitar API keys ou credenciais

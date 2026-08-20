# HANDOFF

| **CURRENT_TASK** | TASK-000042 — Deploy do PP (PUB Prototype) no Cloudflare em Produção |
| **NEXT_TASK** | TASK-000043 |
| **CURRENT_AGENT** | Antigravity |
| **BRANCH** | main |
| **LOCAL HEAD** | `a472fd9` |
| **REMOTE_HEAD** | `a472fd9` |
| **SYNC** | YES |
| **KNOWN_LIMITATIONS** | 1. CODEX_CLI_UNAVAILABLE — CLI do Codex não disponível neste ambiente local Windows (disponível no container Linux de produção); 2. 9Router OpenCode provider retorna conteúdo vazio para oc/laguna-s-2.1-free apesar de HTTP 200; 3. Hermes desktop não recarrega config.yaml automaticamente; requer restart manual para troca de routing/modelo |

## State
- **PP no Cloudflare em Produção:** `https://pub-dev-loop-api.contato-pubcore.workers.dev/prototype`
- Worker API expõe todas as rotas do PP (UI HTML com marca/timeline/iframe/histórico de versões/diff, sessões, prompts, checkpoints, promoções e SSE streaming).
- PostgreSQL no Neon (`ep-calm-river-ace0secf.sa-east-1.aws.neon.tech`) com Hyperdrive ID `73070556ffde4aaea7cbbde327387f70` (com cache SQL desabilitado para consistência imediata de escrita/leitura).
- Worker Container empacotado e otimizado com Debian bookworm slim, Node 22, Git, Cloudflared 2026.7.3 e Codex CLI 0.148.0.
- Validação ponta a ponta em produção 100% verde (`scripts/verify-prod.ts`).

## DO_NOT_REPEAT
- Não permitir fallback automático quando o workspace já tiver sofrido mutações
- Não colocar OpenRouter dentro do 9Router nem 9Router dentro do OpenRouter
- Não forçar merge/reset/rebase para resolver divergência Git
- Nunca commitar API keys ou credenciais


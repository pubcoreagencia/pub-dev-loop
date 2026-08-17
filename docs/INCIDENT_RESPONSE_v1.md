# PUB DEV LOOP — INCIDENT RESPONSE PLAN v1.0.0

Plano de resposta a incidentes e mitigação para o **PUB DEV LOOP**.

---

## 1. Router Failure (Falha do Provedor de LLM)
- **Sintoma:** Tarefas falham imediatamente com `ROUTER_CONNECTION_ERROR` ou erro de timeout da API de LLM.
- **Diagnóstico:** A URL `ROUTER_BASE_URL` ou chave `ROUTER_API_KEY` está inválida, expulsa por rate-limit ou o endpoint de destino está inacessível.
- **Mitigação:**
  1. Testar o endpoint do 9router com cURL externo.
  2. Caso a API do 9router esteja indisponível, alternar temporariamente para o provedor `mock` em `src/api-worker.ts` ou ajustar a variável `ROUTER_BASE_URL` no Cloudflare Secrets:
     ```bash
     npx wrangler secret put ROUTER_BASE_URL
     ```

---

## 2. Database Failure (Falha no Neon PostgreSQL)
- **Sintoma:** Chamadas HTTP `/tasks` retornam erro `500 Internal Server Error` ou `Connection refused`.
- **Diagnóstico:** Exaustão do pool de conexões do Neon PostgreSQL ou indisponibilidade no Hyperdrive binding.
- **Mitigação:**
  1. Verificar o status do projeto no Neon Console Dashboard.
  2. Verificar se o binding `HYPERDRIVE` no `wrangler.jsonc` possui a string de conexão atualizada.
  3. Reiniciar a conexão recriando a secret de `DATABASE_URL` se necessário.

---

## 3. Container Crash (Queda ou Falha de Inicialização do Firecracker VM)
- **Sintoma:** O alarme do Durable Object tenta acionar `getContainer().start()` e lança exceção.
- **Diagnóstico:** Imagem Docker ausente no registro interno da Cloudflare ou erro de sintaxe no `Dockerfile.worker`.
- **Mitigação:**
  1. Recompilar a imagem do container e re-implantar via `npx wrangler deploy`.
  2. Validar se o Docker Desktop local está funcional para build das imagens durante o deploy.

---

## 4. Worker Failure (Falha Geral do Cloudflare Worker)
- **Sintoma:** Requisições para a API pública `pub-dev-loop-api.workers.dev` retornam erro 522/502 Cloudflare.
- **Diagnóstico:** Exceção não capturada no boot do Worker ou erro de sintaxe no bundle JS compilado.
- **Mitigação:**
  1. Executar rollback imediato para a versão estável anterior:
     ```bash
     npx wrangler rollback
     ```
  2. Consultar `npx wrangler tail` para extrair o stack trace do erro.

---

## 5. Stuck Task Recovery (Recuperação de Tarefas Presas)
- **Sintoma:** Fila estagnada com tarefas presas no status `ASSIGNED` ou `RUNNING`.
- **Diagnóstico:** Instância do container foi desligada forçadamente antes de concluir a escrita de estado no banco.
- **Mitigação:**
  1. O Durable Object reciclará a tarefa automaticamente após a expiração do `leaseDeadline` (+30s).
  2. Para liberação forçada imediata de todas as tarefas presas:
     ```sql
     UPDATE tasks SET status = 'QUEUED', worker = NULL WHERE status IN ('ASSIGNED', 'RUNNING');
     ```

---

## 6. Secret Rotation (Rotação de Credenciais e Segredos)
- **Sintoma:** Necessidade de rotação periódica ou em resposta a vazamentos de `GITHUB_TOKEN`, `ROUTER_API_KEY` ou `DATABASE_URL`.
- **Procedimento de Rotação:**
  1. Atualizar o secret no Cloudflare Worker de produção:
     ```bash
     npx wrangler secret put GITHUB_TOKEN
     npx wrangler secret put ROUTER_API_KEY
     npx wrangler secret put DATABASE_URL
     ```
  2. Atualizar o secret no Cloudflare Worker de staging:
     ```bash
     npx wrangler secret put GITHUB_TOKEN --env staging
     npx wrangler secret put ROUTER_API_KEY --env staging
     npx wrangler secret put DATABASE_URL --env staging
     ```
  3. Fazer deploy do Worker para que os novos segredos sejam repassados na inicialização dos containers.

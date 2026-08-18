# PUB DEV LOOP — OPERATIONS RUNBOOK v1.0.0

Guia operacional de manutenção, monitoramento e procedimentos padrão do **PUB DEV LOOP**.

---

## 1. Como Monitorar Produção
Para visualizar logs em tempo real das chamadas API e execução de containers em produção:
```bash
npx wrangler tail pub-dev-loop-api --format=json
```

Para monitorar logs do ambiente de staging:
```bash
npx wrangler tail pub-dev-loop-api-staging --format=json
```

---

## 2. Como Interpretar Estados de Tasks

| Estado | Significado | Ação Operacional |
| :--- | :--- | :--- |
| `QUEUED` | Tarefa inserida no Neon PostgreSQL aguardando claim. | Comum. Caso acumule, verificar se o container worker está ativo. |
| `ASSIGNED` | Reivindicada por um worker via `FOR UPDATE SKIP LOCKED`. | Transição rápida para `RUNNING` (< 5s). |
| `RUNNING` | Container inicializado, workspace criado e agente em execução. | Monitorar `heartbeatAt` a cada 10s. |
| `TESTING` | Suite de validação / testes em execução no container. | Aguardar conclusão dos testes. |
| `COMPLETED` | Tarefa concluída com sucesso, alterações commitadas e workspace limpo. | Nenhuma ação (estado terminal de sucesso). |
| `FAILED` | Execução falhou (erro de provider, timeout ou exceção). | Consultar o campo `error` ou `result.trace` para diagnóstico. |

---

## 3. Como Recuperar Tasks Presas (Stuck Tasks)
Caso uma tarefa permaneça em `ASSIGNED` ou `RUNNING` por mais de 30 segundos devido ao desligamento repentino de uma VM container:
1. **Recuperação Automática:** O alarme periódico de +35s do Durable Object executa `reclaimStuck()`, redefinindo o status de tarefas expiradas para `QUEUED`.
2. **Recuperação Manual (via consulta SQL no Neon PostgreSQL):**
   ```sql
   UPDATE tasks
   SET status = 'QUEUED', worker = NULL, lease_owner = NULL, lease_deadline = NULL
   WHERE status IN ('ASSIGNED', 'RUNNING')
     AND lease_deadline < NOW();
   ```

---

## 4. Como Executar Rollback
Em caso de regressão em produção após deploy:
1. Listar versões recentes implantadas:
   ```bash
   npx wrangler deployments list
   ```
2. Reverter para a versão estável desejada (ex: Versão ID da v1.0.0):
   ```bash
   npx wrangler rollback [VERSION_ID]
   ```
3. Alternativamente, realizar o checkout e deploy do commit tag da release baseline:
   ```bash
   git checkout v1.0.0-production-ready
   npm run build
   npx wrangler deploy
   ```

---

## 5. Como Validar Saúde do Worker
Testar o endpoint público de saúde:
```bash
curl.exe -s https://pub-dev-loop-api.contato-pubcore.workers.dev/health
```
**Retorno Esperado:**
```json
{
  "status": "ok",
  "runtime": "cloudflare-worker"
}
```

---

## 6. Como Validar Neon PostgreSQL (`HYPERDRIVE`)
Consultar tarefas na fila via API pública do worker:
```bash
curl.exe -s https://pub-dev-loop-api.contato-pubcore.workers.dev/tasks
```
Se a lista JSON for retornada sem erro HTTP 500, a conexão do Hyperdrive com o banco PostgreSQL está 100% funcional.

---

## 7. Como Validar RouterProvider (`9router`)
Para validar a integração com o provedor de modelos e chamada de ferramentas:
1. Verificar no secret da Cloudflare se `ROUTER_API_KEY` e `ROUTER_BASE_URL` estão configurados.
2. Em tarefas executadas, auditar se o campo `worker` no registro da task indica `"9router"`.

---

## 8. Como Investigar Falhas de Provider
Se uma tarefa falhar com status `FAILED`:
1. Fazer GET na task específica:
   ```bash
   curl.exe -s https://pub-dev-loop-api.contato-pubcore.workers.dev/tasks/[TASK_ID]
   ```
2. Inspecionar o objeto `result.trace.attempts`:
   - `status: "ROUTER_CONNECTION_ERROR"` -> Endpoint em `ROUTER_BASE_URL` inacessível.
   - `status: "TIMEOUT"` -> Provedor excedeu o limite `ROUTER_TIMEOUT_MS`.
   - `status: "MAX_ROUNDS_REACHED"` -> Excedido o limite `ROUTER_MAX_TOOL_ROUNDS`.

---

## 9. Como Fazer Release Futura (v1.x)
Fluxo padrão de publicação de novas releases:
1. Fazer alterações e validar localmente: `npm run test && npm run build`.
2. Deploy em staging primeiro:
   ```bash
   npx wrangler deploy --env staging
   ```
3. Executar tarefas de validação em staging.
4. Após aprovação em staging, deploy em produção:
   ```bash
   npx wrangler deploy
   ```
5. Criar tag anotada de release:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

---

## 10. Como Criar e Gerenciar API Keys
O endpoint de criação de tarefas é protegido pela chave de API `PUB_DEV_LOOP_API_KEY`. Para criar ou definir uma chave:
1. Gere um string seguro e longo.
2. Defina o segredo de produção via Wrangler:
   ```bash
   npx wrangler secret put PUB_DEV_LOOP_API_KEY
   ```
3. O Cloudflare exigirá a entrada manual do valor gerado no console interativo.

---

## 11. Como Rotacionar Secrets
Caso suspeite de vazamento do Token do GitHub, Banco de Dados, Router ou API Key:
1. Gere a nova credencial nos provedores correspondentes.
2. Execute o update via Wrangler (ele sobrescreve automaticamente o secret antigo):
   ```bash
   npx wrangler secret put [NOME_DO_SECRET]
   ```
   *(Ex: `npx wrangler secret put ROUTER_API_KEY`)*
3. As alterações entram em vigor imediatamente nas novas execuções de workers sem necessidade de deploy.

---

## 12. Como Consumir o Endpoint Público (POST /tasks)
Para agendar tarefas na fila de execução externa:
```bash
curl -s -X POST https://pub-dev-loop-api.contato-pubcore.workers.dev/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUACHAVEAQUI" \
  -d '{
    "project": "Meu Projeto",
    "repository": "https://github.com/exemplo/repo.git",
    "objective": "Objetivo em português",
    "prompt": "Instrução detalhada"
  }'
```

**Erros Comuns:**
- `401 Unauthorized`: Header ausente ou chave incorreta.
- `429 Too Many Requests`: Limite de picos excedido (máx 10/min por IP).
- `400 Bad Request`: Payload ausente ou com campos não listados permitidos.

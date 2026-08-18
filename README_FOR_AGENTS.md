# README FOR AGENTS

## START HERE
Se você é um novo agente assumindo este repositório, execute estes passos exatamente nesta ordem para restabelecer e compreender o estado operacional:

1. **Atualize o repositório local**:
   ```bash
   git pull origin main
   ```
2. **Execute o comando de verificação e resumo do estado de continuidade**:
   ```bash
   npm run devloop:resume
   npm run devloop:validate
   npm run devloop:checkpoint
   ```
3. **Leia a documentação canônica de estado e contexto**:
   - [PUB_DEV_LOOP_HANDOFF.md](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/PUB_DEV_LOOP_HANDOFF.md) (Resumo canônico da última atividade, baseline validado e a próxima ação exata)
   - [PUB_DEV_LOOP_STATE.md](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/PUB_DEV_LOOP_STATE.md) (Estado detalhado das tasks, métricas dos gates de validação e blockers)
   - [PUB_DEV_LOOP_CONTEXT.md](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/PUB_DEV_LOOP_CONTEXT.md) (Arquitetura, fluxos e regras operacionais)
   - [.agent/MASTER_CONTEXT.md](file:///C:/Users/Matheus%20Paes/Documents/ChatGPT/PUB%20DEV%20LOOP/.agent/MASTER_CONTEXT.md) (Contexto canônico de bootstrap)
4. **Verifique o estado do Git**:
   ```bash
   git status --short
   ```
5. **Execute a próxima ação especificada no campo `NEXT ACTION` de `PUB_DEV_LOOP_HANDOFF.md`**.

---

## Como Operar neste Ambiente

### Descobrir Branch Atual e Estado
```bash
git branch --show-current
git log -n 5 --oneline
```

### Inicializar o Ambiente Staging
Para subir o ambiente local de testes/staging:
```bash
docker compose -f docker-compose.staging.yml up -d
```
Verifique o status dos serviços:
```bash
docker compose -f docker-compose.staging.yml ps
```

### Executar Testes
Para rodar a suíte inteira de testes:
```bash
npm test
```
Para rodar testes específicos do fallback/retry:
```bash
npx vitest run tests/router_fallback.test.ts
npx vitest run tests/worker-retry.test.ts
```

### Acessar Logs do Worker
```bash
docker logs pubdevloop-worker-1
```

### Validar Contexto Operacional
O repositório possui uma validação de integridade do contexto que impede execuções inconsistentes. Execute antes de propor alterações significativas:
```bash
npx tsx src/context/cli.ts --validate
```

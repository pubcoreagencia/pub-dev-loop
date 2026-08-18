# PUB DEV LOOP Operational Context

This document outlines the operational and architectural context of the PUB DEV LOOP project.

## 1. Identidade & Objetivo
O **PUB DEV LOOP** é uma plataforma automatizada de desenvolvimento voltada a loops de publicação autônomos. Ele executa tasks de codificação usando agentes autônomos integrados a LLMs através de um gateway local/proxy denominado **9Router**.

## 2. Arquitetura Geral
O fluxo de execução segue uma ordem estrita e isolada:
```text
Task API (submit)
   ↓
Queue (PostgreSQL / ASSIGNED)
   ↓
Worker (RouterWorker / Claims Task)
   ↓
Provider (RouterProvider / loads config / setup attempts)
   ↓
9Router (Proxy gateway local at port 20128)
   ↓
Model (gemini/gemini-3.7-flash, fallback models)
   ↓
Provider Result (Unified AttemptResult)
   ↓
Task Finalizer (Verify files, run testCommand)
   ↓
Git Commit (Auto-commit via TaskFinalizer / no push)
   ↓
SHA Update & Terminal State (COMPLETED / FAILED)
```

## 3. Componentes-Chave
- **RouterProvider (`src/providers/router.ts`)**: Estabelece comunicação com o 9Router usando a API compatível com OpenAI. Implementa a lógica interna de retry em falhas transitórias (429, 5xx) e o fluxo sequencial passando para o fallback em caso de esgotamento/erro permanente do modelo atual.
- **RouterWorker (`src/router-worker.ts`)**: Worker que gerencia a fila de tasks, cria workspaces temporários isolados para cada tentativa de execução, monitora o budget global de tempo (`ROUTER_TIMEOUT_TOTAL_MS`), e delega a finalização.
- **TaskFinalizer (`src/finalizer.ts`)**: Garante que apenas as alterações declaradas pelo agente sejam comitadas, bloqueando comandos perigosos do Git e realizando o commit automático pós-validação.

## 4. Integração com o 9Router
- O **9Router** está operacional e persistente.
- As rotas `/v1/models` e `/v1/chat/completions` estão validadas.
- O modelo primário homologado e desejável é o `gemini/gemini-3.7-flash`.
- Em testes reais, o modelo primário pode retornar `HTTP 429` (Quota Exceeded), necessitando a transição transparente para o fallback `gemini/gemini-3.6-flash`.

## 5. Regras de Segurança
- Nenhuma chave de API ou segredo deve ser gravada em arquivos de configuração commitados, logs de execução ou arquivos de diagnóstico.
- O token do GitHub deve ser configurado apenas em runtime através do helper de credenciais de Git ou interpolação do docker-compose.
- O TaskFinalizer rejeita operações destrutivas como push forçado ou resets no histórico do repositório.

## 6. Comandos e Validação
```bash
npm run build      # Compila o código TypeScript para dist/
npm test           # Executa a suite de testes unitários via Vitest
npx tsx src/context/cli.ts --validate   # Valida a consistência do contexto operacional
```

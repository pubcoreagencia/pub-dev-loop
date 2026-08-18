# Release Notes v1.1.0 — API Security Hardening

**Status:** STABLE  
**Data:** 18 de Agosto de 2026  

A versão v1.1.0 consolida os aprimoramentos de segurança do endpoint público da API do Worker em produção, garantindo controle de abusos, validação rigorosa de carga útil (payload) e proteção da infraestrutura de banco de dados e Workers Internos.

## O que mudou

- **Autenticação Obrigatória:** O endpoint público (`POST /tasks`) passou a exigir a chave configurada pelo header `Authorization: Bearer <API_KEY>` ou `X-API-Key: <API_KEY>`. Requisições não assinadas ou com tokens incorretos serão respondidas imediatamente com `401 Unauthorized`.
- **Validação de Corpo Restrita (Strict Payload):** Campos desconhecidos submetidos no payload JSON agora resultam na recusa da requisição inteira (`400 Bad Request`), e campos vitais (`project`, `repository`, `objective`, `prompt`) têm checagem explícita de tipos string.
- **Isolamento de Workers e Banco de Dados:** A checagem de API Key e Rate Limit agora precede a invocação do repositório (`getRepository`) e do gatilho Container, blindando os limites de taxa de consultas do DB do Neon PostgreSQL.
- **Log de Eventos:** Novas tags de observabilidade (ex.: `RATE_LIMITED`, `AUTH_FAILED`, `TASK_REQUEST_REJECTED`, `TASK_REQUEST_ACCEPTED`) foram introduzidas, contendo IP de origem (`cf-connecting-ip`) para varredura simplificada e auditoria.

## Segredos Adicionados

Para a plena operação da v1.1.0, o seguinte segredo deve ser estabelecido no Cloudflare Secrets da aplicação:

- **`PUB_DEV_LOOP_API_KEY`**: Chave unificada para permissão de escrita e submissão de código à esteira.

> **Observação:** Durante a bateria de testes de Produção, observou-se também que o secret `ROUTER_BASE_URL` ainda demanda registro no ambiente para reabilitar o ciclo de tarefas pelo provedor configurado.

## Limites Estabelecidos

A API passa a ter governança por In-Memory Map Bucket para mitigar ataques de Flood/Spam:

- **Frequência Máxima:** 10 requisições por IP a cada 60.000 milissegundos (1 minuto).
- **Tratativa de Excedentes:** Quando a cota de submissões é ultrapassada, o worker recusa a conexão via `429 Too Many Requests`, devolvendo a resposta em memória com latência inferior a 15ms.

---
**Componentes Não Afetados:** O ciclo de vida de `TaskFinalizer`, `Container.start()`, `RouterWorker` (via `POST /tasks/:id/retry` / gatilhos alarm) ou infraestruturas do Docker permaneceram inalterados.

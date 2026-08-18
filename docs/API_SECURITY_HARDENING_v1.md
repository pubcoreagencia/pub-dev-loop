# PUB DEV LOOP API SECURITY HARDENING v1.1

## Objetivo
Adicionar autenticação e proteção contra abuso no endpoint público de criação de tarefas (`POST /tasks`), garantindo que apenas clientes autorizados possam submeter trabalho à fila. O fluxo interno, alarmes e Container Workers operam protegidos no backend sem interrupções.

## Mecanismos Implementados

### 1. Autenticação Obrigatória
O endpoint `POST /tasks` agora exige a presença de um token de autenticação válido configurado no Cloudflare Secrets (`PUB_DEV_LOOP_API_KEY`).

**Headers Suportados:**
- `Authorization: Bearer <API_KEY>`
- `X-API-Key: <API_KEY>`

Se o secret estiver configurado e o token não for enviado ou for inválido, a resposta será `401 Unauthorized`.

### 2. Rate Limiting (In-Memory)
Proteção contra picos de tráfego (DDoS/Spam) via controle de taxa (Rate Limit) em memória:
- **Limite:** 10 requisições por minuto por IP do cliente.
- **Identificação:** IP via header `cf-connecting-ip` do Cloudflare.
- **Ação:** Bloqueio e retorno de status `429 Too Many Requests`.

### 3. Validação de Payload
O corpo da requisição JSON agora passa por rigorosa validação antes de qualquer consulta ao banco de dados:
- **Campos Obrigatórios:** `project`, `repository`, `objective` e `prompt` são validados quanto ao tipo (string) e conteúdo não-vazio.
- **Prevenção de Abuso:** O payload não pode conter campos arbitrários. Qualquer campo desconhecido enviado no corpo resultará em rejeição imediata (`400 Bad Request`).

### 4. Auditoria Estruturada (Structured Logging)
Eventos críticos de segurança são registrados no `wrangler tail` (stdout) para ingestão futura por ferramentas de monitoramento:
- `TASK_REQUEST_ACCEPTED`: Tarefa criada com sucesso.
- `TASK_REQUEST_REJECTED`: Payload malformado ou campos não autorizados.
- `AUTH_FAILED`: Tentativa de acesso sem chave válida.
- `RATE_LIMITED`: Abuso de uso excedendo a taxa permitida.

### 5. Isolamento do Fluxo Interno
Os componentes de infraestrutura (Durable Objects, `alarm()`, Firecracker MicroVMs) continuam instanciando e consultando o banco de dados diretamente via SDK, ignorando o limitador de API pública.

---

## Validação de Segurança (Staging)

- [x] Requisições sem Token: Falham corretamente com `401 Unauthorized`.
- [x] Requisições de Spam: Bloqueadas pelo in-memory bucket limit (429).
- [x] Injeção de Campos: Omitida e rejeitada pelo parse de chaves permitidas (400).
- [x] Tarefas Válidas: Executadas sem latência extra via RouterWorker (201).

# Git Credential Security — Process-Scoped Runtime Auth

## Resumo
Credenciais de Git são expostas em runtime via variável de ambiente e consumidas por um Git credential helper process-scoped — sem persistência em nenhum arquivo de configuração.

## Invariáveis críticos

| # | Invariante | Onde validado |
|---|-----------|---------------|
| IN-1 | `GITHUB_TOKEN` existe somente no ambiente do processo | worker.ts:27, docker-compose.staging.yml:62 |
| IN-2 | Token não entra em URL de clone/fetch | worker.ts (helper em runtime), clone usa URL padrão |
| IN-3 | Token não é escrito em `.netrc` ou qualquer arquivo | worker.ts:69 |
| IN-4 | Token não é escrito em `~/.gitconfig` ou qualquer arquivo de configuração git | worker.ts:65–66 |
| IN-5 | Não há `git config --global credential.helper` persistente | worker.ts:65–66 |
| IN-6 | Credencial é `process-scoped` — persiste por duração do processo, não de sessão | worker.ts:65–66 |
| IN-7 | O helper lê `operation` e entrada via stdin (protocl/Host em stdin, primeiro arg = operação) | worker.ts:47–51, worker.ts:66–68 |
| IN-8 | Docker staging (`docker-compose.staging.yml`) expõe `GITHUB_TOKEN` via `environment` (não injeta valor em código/.env/URL) | docker-compose.staging.yml:57–62 |
| IN-9 | Token não é emitido em logs — `console.log`/`console.error` não repassam o valor | worker.ts:71–73 |
| IN-10 | Token não é persistido em trace de execução (`WorkerExecutionTrace`, `FinalizeResult`) | worker-service.ts, finalizer.ts |
| IN-11 | Token não é persistido em commits Git ou Git history | .git/ object store (operacional) |

## Mecanismo

**worker.ts — configureGitCredentials() (process-scoped, sem arquivo):**

```
1. Verifica process.env.GITHUB_TOKEN (se não existir, logs "No GITHUB_TOKEN set" e retorna)
2. Se existir, executa `git config --local credential.helper <shell-cmd>` no repositório de trabalho
   → --local escreve em .git/config do repo de trabalho, não em ~/.gitconfig global
   → Isso é process-scoped no nível do repo, não do usuário
```

**Shell credential helper (escrito em worker.ts, consumido em runtime):**

```
!f() {
  read operation
  read protocol
  read host
  if [ "$operation" = "get" ]; then
    echo "protocol=$protocol"
    echo "host=$host"
    echo "username=x-access-token"
    echo "password=$GITHUB_TOKEN"
  fi
}; f
```

- O helper recebe `operation` (get/store/erase) na primeira linha de stdin
- Recebe `protocol` na segunda linha
- Recebe `host` na terceira linha
- Somente em `operation=get` emite as credenciais
- `$GITHUB_TOKEN` é expandido pelo shell do helper em runtime, não no momento da configuração

**clone/fetch:**
- `git clone https://github.com/...` — URL sem token
- Git invoca o credential helper quando precisa autenticar
- Helper emite credenciais em runtime via `$GITHUB_TOKEN` do ambiente

**docker-compose.staging.yml:**
- `GITHUB_TOKEN: ${GITHUB_TOKEN}` — Compose interpola variável de host em runtime
- Worker container recebe o token no environment
- Dentro do container, configureGitCredentials() usa `git config --local` + helper

## Validação (TASK-000034)

### Pré-condição
- GITHUB_TOKEN disponível no ambiente do processo (verificado sem imprimir valor)

### Passos de validação
1. retry_revalidate — testar rota retry + reavaliação de tasks
2. crash_revalidate — testar crash recovery (reclaimStuck, lease, heartbeat)
3. secret_scan — testar redaction (sem token em saída/logs/trace)
4. docker_health — validar containers de staging com GITHUB_TOKEN
5. report — consolidar resultados

## Arquitetura de credencial em runtime

**Fluxo:**
```
GITHUB_TOKEN (env do processo)
  ↓
configureGitCredentials() em worker.ts
  → git config --local credential.helper '<shell helper>'
  → helper lê stdin (operation, protocol, host) + env var em runtime
  ↓
git clone/fetch usa helper para autenticar
  → helper emite username=password em runtime
  → token nunca em arquivo, URL, log, trace, commit
```

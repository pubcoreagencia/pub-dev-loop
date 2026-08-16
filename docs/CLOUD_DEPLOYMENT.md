# Primeiro deployment cloud

Este guia prepara um único host Linux para provar o primeiro loop real. Ele não define provedor, Kubernetes, autoscaling, push, merge ou deployment automático.

## Arquitetura mínima

```text
Linux host
├── Docker Engine
├── PostgreSQL container
├── API container
└── Codex worker container (não-root, efêmero por task)
```

O host precisa de Linux x86_64, Docker Engine com Docker Compose v2, saída HTTPS para GitHub e serviços Codex, Git no container (já instalado pela imagem), e armazenamento local para imagens/volume PostgreSQL. Comece com 2 vCPU, 4 GB RAM e 30 GB de disco; aumente RAM e armazenamento conforme a dimensão dos repositórios e a concorrência futura. Este MVP usa apenas um worker.

## Imagem e configuração

`Dockerfile.worker` usa `node:22-bookworm-slim`, instala Git e o instalador Linux oficial do Codex, valida `codex --version` durante o build e executa como usuário `codex` não-root. O diretório temporário é `/tmp`; cada task ainda recebe um subdiretório temporário exclusivo, removido ao final.

No host, obtenha o repositório e crie um arquivo de ambiente fora do Git, com permissões do administrador do host. Use `.env.example` somente como lista de chaves, nunca como arquivo de secrets. Configure `DATABASE_URL`, `AGENT_MODE=codex`, `AGENT_TIMEOUT_MS` e, opcionalmente, `CODEX_AUTH_SECRET_REF` como referência não secreta para auditoria de deployment.

O comando de subida é `docker compose up --build -d`. Verifique `docker compose ps`, `docker compose logs worker`, `docker compose exec worker npm run worker:health` e `curl http://localhost:3000/health`. O health check do worker valida configuração básica e executabilidade de Git e Codex; ele não valida saldo, permissão de conta ou conectividade de uma task real.

## Autenticação e secrets

Em desenvolvimento, injete a credencial suportada pelo Codex CLI como variável de ambiente ou arquivo de secret local fora do repositório. Em produção, entregue a mesma credencial em runtime por um Secret Manager agnóstico de provedor, montada/injetada diretamente no container. Não coloque valor de secret em Dockerfile, Compose, README, logs, resultado de task ou `CODEX_AUTH_SECRET_REF`; este último é apenas uma referência opcional, não uma credencial. Confirme o método de autenticação suportado pela versão instalada do CLI na [documentação oficial do Codex CLI](https://learn.chatgpt.com/docs/codex/cli).

## GitHub e Git

O worker só requer clone, fetch, branch e commit local neste MVP; push está desabilitado. Prefira uma credencial de GitHub dedicada, de escopo restrito aos repositórios necessários e somente leitura enquanto não houver push. Injete-a pelo mesmo mecanismo de Secret Manager; nunca use uma credencial pessoal ampla nem grave URL com token no banco ou nos logs. O worker cria `worker/codex/TASK-ID`, registra o diff e cria commit local somente quando houver alteração.

## Codex headless

O adapter executa `codex exec --sandbox workspace-write --ask-for-approval never <prompt>` sem shell, no repositório clonado dentro do workspace temporário. `AgentExecutor` captura stdout/stderr, redige valores sensíveis conhecidos, aplica `AGENT_TIMEOUT_MS` e termina o grupo de processos em timeout. Consulte a [documentação de modo não interativo](https://learn.chatgpt.com/docs/non-interactive-mode) antes de atualizar a versão/credencial do CLI.

## Teste controlado `hello.txt`

Crie um repositório descartável separado, clone-o no container autenticado e configure `RUN_CODEX_INTEGRATION=1` e `CODEX_INTEGRATION_REPOSITORY=/caminho/do/repo`. Execute:

```sh
npm test -- tests/integration/codex-hello.integration.ts
```

O teste pede exatamente a criação de `hello.txt` com `PUB DEV LOOP TEST`. Antes de executar, confirme que o repositório está descartável e limpo. Após a execução, verifique exit code, `git diff --stat`, `hello.txt`, branch, commit e o resultado persistido da task. O teste não faz push nem merge.

## Troubleshooting e cleanup

- Se o health check reportar Git/Codex indisponível, reconstrua a imagem e consulte `docker compose logs worker`; não altere o container em execução.
- Para erro de autenticação, confirme somente a montagem/runtime do Secret Manager e a documentação da versão do CLI; não imprima o secret para depuração.
- Para timeout, aumente `AGENT_TIMEOUT_MS` após revisar logs redigidos e o tamanho da task.
- Para falta de espaço, pare os containers e remova apenas imagens/volumes que não contenham dados necessários. Preserve o volume PostgreSQL até haver backup confirmado.
- `docker compose down` remove containers, não o volume nomeado por padrão. Use remoção de volume somente após backup ou quando o ambiente de teste for descartável.

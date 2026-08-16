# GitHub Actions: primeiro worker cloud

O workflow [codex-worker.yml](../.github/workflows/codex-worker.yml) é o primeiro runtime cloud experimental do MVP. Ele executa manualmente (`workflow_dispatch`) em um runner Ubuntu efêmero; não substitui o worker Docker/Linux nem torna GitHub Actions uma dependência da abstração `Worker` ou `AgentExecutor`.

## Configuração

Configure o Secret de repositório `OPENAI_API_KEY` no GitHub. Ele é injetado somente nos passos que verificam autenticação e executam o teste; seu valor não é escrito no YAML, nos resultados ou no summary. O nome corresponde à variável de ambiente de autenticação por API usada pelo Codex CLI. Não use token pessoal do GitHub: o workflow tem `contents: read` e cria commit apenas no sandbox local.

Dispare **Actions → Codex cloud worker proof → Run workflow**. O runner instala Node 22 e Git, instala o Codex pelo instalador Linux oficial, valida `codex --version` e `codex --help`, executa build e testes unitários e cria um repositório Git descartável em `mktemp`.

## Teste real

O workflow roda `npm run test:integration` com `RUN_CODEX_INTEGRATION=1`. O teste cria a branch local `worker/codex/TASK-000005`, pede ao Codex somente `hello.txt` com `PUB DEV LOOP TEST`, confirma que nenhum outro arquivo mudou, cria um commit local e imprime somente branch, commit, arquivos alterados e status. O runner é destruído após o job; não existe push, merge ou credencial persistente.

## Resultado e troubleshooting

O GitHub Actions Summary informa versões de Codex, Node e Git, estado de autenticação sem valor do secret, build, testes, integração, branch e resultado. Se a instalação falhar, veja o passo **Install Codex CLI**. Se autenticação falhar, confira a existência do Secret, sem copiá-lo para logs. Se `codex exec` falhar, o workflow permanece falho e o output redigido do teste mostra a causa; não há mock ou sucesso sintético. A execução não interativa usa o modo explícito `codex exec --sandbox workspace-write --ask-for-approval never`.

GitHub-hosted runners têm uma cota que varia por plano e podem não ser gratuitos para todos os repositórios/organizações. Este workflow é manual para limitar consumo. Consulte a [documentação oficial do Codex CLI](https://learn.chatgpt.com/docs/codex/cli) e o modo [não interativo](https://learn.chatgpt.com/docs/non-interactive-mode) ao atualizar a instalação ou a autenticação.

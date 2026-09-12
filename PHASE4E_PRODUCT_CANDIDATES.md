# PHASE 4E — INVENTÁRIO DE PRODUTOS REAIS CANDIDATOS DA PUB

Auditoria realizada em 2026-09-11 sobre os repositórios reais da organização `pubcoreagencia`.

Critérios de priorização definidos pela governança da Phase 4E:
1. Produto interno útil para a própria PUB;
2. Escopo adequado para iteração e finalização autônoma;
3. Possibilidade de validação e testes automatizados objetivos;
4. Repositório GitHub remoto real;
5. Capacidade de mensurar sucesso de forma determinística e verificável.

---

## CANDIDATO 1: PUB GITHUB MCP

* **PRODUCT**: PUB GitHub MCP (Servidor MCP Remoto de Infraestrutura)
* **REPOSITORY**: `https://github.com/pubcoreagencia/pub-github-mcp.git`
* **CURRENT_BRANCH**: `main`
* **TECH_STACK**: TypeScript 5.7, Cloudflare Workers runtime, `@modelcontextprotocol/sdk`, Zod 3.24, Vitest 3.0
* **CURRENT_STATE**: Servidor MCP de produção com 20 ferramentas implementadas com validação Zod, autenticação Bearer Token e suíte de testes em `tests/worker.test.ts`.
* **OBJECTIVE**: Adicionar ferramenta de introspecção operacional de repositório (ex: `get_repo_rate_limit` ou `validate_org_compliance`) com esquema Zod e teste unitário dedicado.
* **ACCEPTANCE_TESTS**:
  * `npm test` (`vitest run`)
  * `npm run typecheck` (`tsc --noEmit`)
* **RISK**: Médio-Alto. O repositório possui uma rotina autônoma ativa (`neural-kernel-infra-tech-lead`) realizando commits periódicos na branch `main` a cada ~30 minutos, o que pode provocar concorrência de push se a execução do PDL coincidir com um ciclo da holding.
* **WHY_THIS_PRODUCT**: Produto interno crítico utilizado pelos agentes autônomos da PUB (Hermes, OpenClaw, Antigravity) para governança e automação no GitHub.

---

## CANDIDATO 2: PUB SHOPEE SCRAPER

* **PRODUCT**: PUB Shopee Scraper (Serviço de Ingestão de Catálogos E-commerce)
* **REPOSITORY**: `https://github.com/pubcoreagencia/pub-shopee-scraper.git`
* **CURRENT_BRANCH**: `main`
* **TECH_STACK**: TypeScript 5.9, Cloudflare Workers, Node test runner (`tsx --test`), Wrangler
* **CURRENT_STATE**: Microserviço ativo com arquitetura multi-provider (Apify e Cloudflare Playwright fallback), suítes de testes unitários isolados em `tests/` cobrindo normalização, roteamento e contratos de API sem chamadas externas.
* **OBJECTIVE**: Implementar função de sanitização e cálculo de margem operacional de produto (`calculateProductMargin` e normalização de preço promocional) no módulo `src/normalizer/` com testes correspondentes.
* **ACCEPTANCE_TESTS**:
  * `npm test` (`tsx --test tests/**/*.test.ts`)
  * `npm run typecheck` (`tsc --noEmit`)
  * `npm run build` (`wrangler deploy --dry-run`)
* **RISK**: Médio. Há rotina autônoma de otimização (`b2b-growth-leads-tech-lead`) registrando ciclos periódicos no repositório.
* **WHY_THIS_PRODUCT**: Serviço de dados real da holding que alimenta as operações de e-commerce e catálogo da PUB REC HOLDING.

---

## CANDIDATO 3: PUB CORE [SISTEMA]

* **PRODUCT**: PUB Core Sistema (Plataforma Web Principal da Holding)
* **REPOSITORY**: `https://github.com/pubcoreagencia/pubcore.git`
* **CURRENT_BRANCH**: `main`
* **TECH_STACK**: React 18, Vite 5, TypeScript 5, Tailwind CSS, Lucide React, Cloudflare Pages
* **CURRENT_STATE**: Sistema web institucional da holding. Branch `main` estável e sem rotinas autônomas concorrentes ativas (último commit em 06/09/2026).
* **OBJECTIVE**: Adicionar componente ou helper de formatação financeira e telemetria interna da holding com exportação de tipos TypeScript.
* **ACCEPTANCE_TESTS**:
  * `npm run typecheck` / `npx tsc --noEmit`
  * `npm run build` (`vite build`)
* **RISK**: Médio. Repositório frontend de maior porte com dependências densas de UI; tempo de instalação de pacotes e build pode elevar duração dos ciclos do worker.
* **WHY_THIS_PRODUCT**: Interface principal de gestão e consolidação operacional da holding.

---

## CANDIDATO 4: PUB LEADS

* **PRODUCT**: PUB Leads (SaaS B2B de Prospecção e CRM)
* **REPOSITORY**: `https://github.com/pubcoreagencia/pub-leads.git`
* **CURRENT_BRANCH**: `main`
* **TECH_STACK**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase Auth, Turso / libSQL
* **CURRENT_STATE**: Plataforma comercial completa com módulos de pipeline, faturamento (Inter/Utmify) e prospecção.
* **OBJECTIVE**: Implementar validador de payload de webhook de faturamento ou utilitário de sanitização de telefones/CNPJ.
* **ACCEPTANCE_TESTS**:
  * `npm run lint`
  * `npx tsc --noEmit`
* **RISK**: Alto. O build do Next.js depende de variáveis de ambiente do Supabase e Turso; falhas de build fora do ambiente Vercel/Docker configurado são comuns.
* **WHY_THIS_PRODUCT**: Principal SaaS B2B da holding, gerador de receita comercial direta.

---

## CANDIDATO 5: PUB RATE CALCULATOR

* **PRODUCT**: PUB Rate Calculator (Calculadora Interna de Precificação e CPM de Mídia)
* **REPOSITORY**: `https://github.com/pubcoreagencia/pub-rate-calculator.git`
* **CURRENT_BRANCH**: `main`
* **TECH_STACK**: Node.js (ESM), JavaScript ES2022, HTML5, suíte de validação customizada (`node test/validate.mjs`)
* **CURRENT_STATE**: Repositório ativo e operante da holding, com baseline de cálculo de CPM, descontos e taxas corporativas já validado na Phase 4D.1 e publicado na organização.
* **OBJECTIVE**: Expandir o motor de precificação com suporte a cálculo de comissão de agência (`calculateAgencyCommission`), margem líquida e regras de faturamento por volume para campanhas da PUB Media.
* **ACCEPTANCE_TESTS**:
  * `node test/validate.mjs` (suíte de validação automatizada determinística)
  * Validação de integridade de workspace e lint
* **RISK**: Mínimo. Repositório sob controle total do pipeline, sem interferência de cron jobs ou agentes 24h concorrentes, tempo de execução previsível e suíte de testes 100% reproduzível.
* **WHY_THIS_PRODUCT**: Criado especificamente para ser a esteira de validação ágil de ferramentas internas da PUB.

---

## MATRIZ COMPARATIVA E RECOMENDAÇÃO

| Produto | Repositório Real | Utilidade PUB | Concorrência de Push | Risco de Validação | Recomendação |
|---|:---:|:---:|:---:|:---:|:---:|
| **PUB GitHub MCP** | Sim | Alta | Média-Alta (ciclos a cada 30m) | Baixo | Forte candidato (requer cautela com commits simultâneos) |
| **PUB Shopee Scraper** | Sim | Alta | Média (ciclos de tech-lead) | Baixo | Forte candidato |
| **PUB Core [SISTEMA]** | Sim | Alta | Nenhuma (estável) | Médio | Candidato viável (tempo de build mais longo) |
| **PUB Leads** | Sim | Alta | Baixa | Alto (depende de credenciais SaaS) | Não recomendado para o piloto autônomo |
| **PUB Rate Calculator** | Sim | Alta | Nenhuma (isolado) | Mínimo | **CANDIDATO IDEAL (MENOR ATRITO / MÁXIMA PRECISÃO)** |

### PRODUTO SELECIONADO:
Entre os candidatos:
* Se o objetivo for uma ferramenta utilitária interna dedicada sem risco de colisão de push: **`pub-rate-calculator`** (ou expansão em **`pub-github-mcp`** em branch dedicada).
* Se o objetivo for um produto de produção ativo da holding: **`pub-github-mcp`** ou **`pub-shopee-scraper`**.

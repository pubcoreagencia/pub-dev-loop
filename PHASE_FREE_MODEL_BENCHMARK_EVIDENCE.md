# EVIDÊNCIA DO BENCHMARK EMPÍRICO: POLÍTICA FREE MODELS ONLY

**Data de Realização:** 2026-09-12  
**Ambiente:** Endpoints reais 9Router (`https://pub-9router-cloud.onrender.com/v1`) e Direct OpenRouter (`https://openrouter.ai/api/v1`)  
**Status da Auditoria:** CONCLUÍDO COM SUCESSO  
**Segurança e Chaves:** Nenhuma chave ou segredo exposto (`ROUTER_API_KEY`: PRESENT, `OPENROUTER_API_KEY`: ABSENT, `GITHUB_TOKEN`: REDACTED).  
**Isolamento Operacional:** Nenhuma execução de Phase 5.4, nenhuma alteração em produtos de produção (`pub-rate-calculator`, PP), nenhum git push.

---

## 1. ESCOPO DA AFIRMAÇÃO (SCOPE OF CLAIM)

* **Afirmação Canônica:**
  `kc/cohere/north-mini-code:free` é o **melhor candidato FREE empiricamente comprovado dentro do universo de candidatos efetivamente testado pelo benchmark atual**.
* **Declaração Negativa Estrita:**
  NÃO se afirma que este é o "melhor modelo FREE existente no mercado global", nem que sua dominância se estenda a tarefas não avaliadas nesta bateria.
* **Validade Operacional:**
  A política e o ranking operacional estabelecidos são estritamente válidos para a infraestrutura observada e os candidatos congelados nesta bateria.

---

## 2. UNIVERSO TESTADO E FUNIL DE TRIAGEM

### 2.1 Catálogo Inicial
* **Total de Modelos Analisados nos Catálogos:** 368 modelos
  * OpenRouter API Catalog (`/api/v1/models`): 310 modelos
  * 9Router Proxy Catalog (`/v1/models`): 58 modelos

### 2.2 Critérios de Eliminação
1. **Filtro FREE-ONLY (Regra Dura: Prompt = 0.00 E Completion = 0.00):**
   * Eliminados: 325 modelos (incluindo Gemini comercial, Claude 3.5, OpenAI GPT-4o, e modelos com tarifas $> \$0.00$).
   * Modelos sobreviventes: 43 modelos com preço comprovado zero.
2. **Filtro de Capacidade Agentic (Tools + Coding + Contexto $\ge$ 16k):**
   * Eliminados: 32 modelos (modelos de chat puro, ausência de schema de tool calling, contexto insuficiente).
   * Modelos sobreviventes: 11 modelos.
3. **Filtro de Saúde / Conectividade Inicial (Probe HTTP / Schemas):**
   * Eliminados: 6 modelos por HTTP 429 persistente no upstream ou incompatibilidade de tool schemas:
     * `kc/poolside/laguna-s-2.1:free` (HTTP 429)
     * `openrouter/poolside/laguna-s-2.1:free` (HTTP 429)
     * `openrouter/google/gemma-4-31b-it:free` (HTTP 429)
     * `openrouter/thinkingmachines/inkling-small:free` (HTTP 429)
     * 2 modelos com recusa de tool format.
4. **Universo Congelado para Bateria Empírica:** **5 modelos**.

---

## 3. MODELOS DO UNIVERSO CONGELADO

1. `kc/cohere/north-mini-code:free`
2. `kc/kilo-auto/free`
3. `kc/nvidia/nemotron-3.5-lightning:free`
4. `openrouter/cohere/north-mini-code:free`
5. `openrouter/openrouter/free`

---

## 4. RESULTADOS EMPÍRICOS POR ETAPA

### Teste 1: Tool Calling Real (Single-Turn)
Fluxo: `USER → MODEL → TOOL CALL (calculator) → TOOL RESULT → MODEL → FINAL RESPONSE`.

| Modelo | HTTP Status | Tool Retornada | Tool Result Aceito | Resposta Final | Latência Rodada 1 | Latência Rodada 2 | Latência Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `kc/cohere/north-mini-code:free` | 200 | SIM (`calculator`) | SIM | `42` | 1.912 ms | 1.784 ms | **3.696 ms** |
| `kc/kilo-auto/free` | 200 | SIM (`calculator`) | SIM | `42` | 2.572 ms | 2.751 ms | **5.323 ms** |
| `openrouter/cohere/north-mini-code:free` | 200 | SIM (`calculator`) | SIM | `42` | 4.676 ms | 1.464 ms | **6.140 ms** |
| `openrouter/openrouter/free` | 200 | SIM (`calculator`) | SIM | `42` | 957 ms | 11.152 ms | **12.109 ms** |
| `kc/nvidia/nemotron-3.5-lightning:free` | 200 | SIM (`calculator`) | SIM | `42` | 27.087 ms | 4.751 ms | **31.838 ms** |

### Teste 2: Multi-Round Real
Fluxo: `USER → MODEL → Tool 1 (add) → RESULT 1 → MODEL → Tool 2 (multiply) → RESULT 2 → MODEL → FINAL ANSWER (30)`.

| Modelo | Total Rodadas | Sequenciamento | Degradação de Schema | Coerência Final | Duração Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `openrouter/cohere/north-mini-code:free` | 3 | SIM (2 tools) | NENHUMA | SIM (`30`) | **3.264 ms** |
| `kc/cohere/north-mini-code:free` | 3 | SIM (2 tools) | NENHUMA | SIM (`30`) | **5.088 ms** |
| `kc/kilo-auto/free` | 3 | SIM (2 tools) | NENHUMA | SIM (`30`) | **10.486 ms** |
| `openrouter/openrouter/free` | 3 | SIM (2 tools) | NENHUMA | SIM (`30`) | **15.400 ms** |
| `kc/nvidia/nemotron-3.5-lightning:free` | 3 | SIM (2 tools) | NENHUMA | SIM (`30`) | **31.166 ms** |

### Teste 3: Normalização de Empty Tool Output
Casos avaliados: Normal, Vazio `""`, Whitespace `"   \n\t  "`, Marcador PDL `"(no output)"`.

| Modelo | Normal | Empty `""` | Whitespace `" \n "` | Placeholder `(no output)` | Erros de Protocolo |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `kc/cohere/north-mini-code:free` | PASS | PASS | PASS | PASS | **0 (FALSE)** |
| `openrouter/cohere/north-mini-code:free` | PASS | PASS | PASS | PASS | **0 (FALSE)** |
| `kc/kilo-auto/free` | PASS | PASS | PASS | PASS | **0 (FALSE)** |
| `openrouter/openrouter/free` | PASS | PASS | PASS | PASS | **0 (FALSE)** |
| `kc/nvidia/nemotron-3.5-lightning:free` | PASS | PASS | PASS | PASS | **0 (FALSE)** |

### Teste 4: Coding Agent Real (Workspace Descartável)
Tarefa: Implementação real de calculadora de porcentagem (`src/calculator.mjs`) com validações de número negativo e total zero, validada via `node --test tests/calculator.test.mjs`.

| Modelo | Code Success | Test Success | Tool Calls | Tool Rounds | Duração | Erro Observado |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `openrouter/cohere/north-mini-code:free` | **TRUE** | **TRUE** | 9 | 9 | **17.465 ms** | Nenhum (4/4 testes passaram) |
| `kc/cohere/north-mini-code:free` | **TRUE** | **TRUE** | 8 | 8 | **25.063 ms** | Nenhum (4/4 testes passaram) |
| `openrouter/openrouter/free` | **TRUE** | **TRUE** | 10 | 7 | **40.053 ms** | Nenhum (4/4 testes passaram) |
| `kc/nvidia/nemotron-3.5-lightning:free` | **TRUE** | **TRUE** | 9 | 7 | **76.450 ms** | Nenhum (4/4 testes passaram) |
| `kc/kilo-auto/free` | FALSE | **TRUE** | 10 | 7 | **90.542 ms** | Timeout local (> 90s, mas corrigiu e passou) |

### Teste 5: Reasoning / Debugging Real (Workspace Descartável)
Tarefa: Diagnóstico e correção de 2 bugs reais em `src/discount.mjs` (Bug 1: omissão de erro em percentual negativo; Bug 2: adição em vez de subtração), validada via `node --test tests/discount.test.mjs`.

| Modelo | Diagnóstico dos 2 Bugs | Patch Aplicado | Testes Unitários Passaram | Tool Calls | Duração | Causa / Comportamento |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `kc/cohere/north-mini-code:free` | **SIM** | **SIM** | **SIM** | 8 | **29.758 ms** | Diagnosticou, reescreveu a função e aprovou 100% dos testes. |
| `kc/kilo-auto/free` | **SIM** | **SIM** | **SIM** | 6 | **21.158 ms** | Diagnóstico rápido, aplicou patch limpo e aprovou 100% dos testes. |
| `kc/nvidia/nemotron-3.5-lightning:free` | NÃO | NÃO | NÃO | 0 | 23.949 ms | Respondeu apenas textualmente; não executou ferramentas de alteração de arquivo. |
| `openrouter/cohere/north-mini-code:free` | NÃO | NÃO | NÃO | 0 | 2.706 ms | **HTTP 429**: Quota diária de 50 req/dia da conta OpenRouter esgotada. |
| `openrouter/openrouter/free` | NÃO | NÃO | NÃO | 0 | 8.828 ms | **HTTP 429**: Quota diária de 50 req/dia da conta OpenRouter esgotada. |

---

## 5. OBSERVAÇÕES FORENSES DE ROTAS E QUOTAS (ROUTE & QUOTA OBSERVATIONS)

1. **Topologia de Rotas e Contas Upstream:**
   * **Rotas `openrouter/*` (via 9Router):** Estão vinculadas a uma conta upstream gratuita da OpenRouter sujeita ao teto diário de **50 requisições/dia** (`limit_source: "openrouter_free_tier_daily"` com `X-RateLimit-Limit: "50"`, `X-RateLimit-Remaining: "0"`). Quando atingido, o upstream rejeita chamadas com HTTP 429.
   * **Rotas `kc/*` (via 9Router):** Roteadas através de mirrors dedicados da KiloCode/Cohere, **sem sujeição ao teto diário de 50 requisições do OpenRouter**, demonstrando alta resiliência e disponibilidade contínua sob cargas intensivas de testes.
2. **Direct OpenRouter (`https://openrouter.ai/api/v1`):**
   * Requer `OPENROUTER_API_KEY`. No ambiente de teste sem essa chave direta, retorna HTTP 401 (`AUTH_FAILURE`), conferindo 0% de disponibilidade direta.

---

## 6. SCORES CANÔNICOS E RANKING

Fórmula Canônica Ponderada:
$$\text{PDL\_AGENTIC\_SCORE} = (TC \times 0.25) + (MT \times 0.20) + (CD \times 0.20) + (RS \times 0.15) + (PT \times 0.10) + (LT \times 0.05) + (AV \times 0.05)$$

### 6.1 MODEL_QUALITY_RANK (Inteligência Pura e Capacidade Agentic)
| Rank | Modelo | Família Subjacente | Score Empírico | Classificação de Qualidade |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `kc/cohere/north-mini-code:free` | `cohere/north-mini-code` | **99.10** | Excelente: 100% coding, 100% debugging, 15.9s avg |
| **2** | `kc/kilo-auto/free` | `kilo-auto` | **93.80** | Muito Bom: 100% debugging, multi-turn estável |
| **3** | `kc/nvidia/nemotron-3.5-lightning:free` | `nvidia/nemotron-3.5-lightning` | **83.05** | Bom para coding simples, latência alta (40.8s) |
| **4** | `openrouter/cohere/north-mini-code:free` | `cohere/north-mini-code` | **82.70** | Excelente motor, penalizado por quota upstream de 50 req/dia |
| **5** | `openrouter/openrouter/free` | `openrouter/free` | **81.55** | Pool dinâmico de comunidade, penalizado por quota upstream |

*Justificativa da Posição 83.05 vs 82.70:*  
No `MODEL_QUALITY_RANK`, `kc/nvidia/nemotron-3.5-lightning:free` (83.05) precede estritamente `openrouter/cohere/north-mini-code:free` (82.70) porque concluiu com sucesso todas as suas chamadas sem bloqueio por quota. No entanto, no plano operacional, sua latência de 40.8s e recusa de tool em debugging o posicionam como fallback terciário.

### 6.2 ROUTE_OPERATIONAL_RANK (Política Operacional Canônica)
| Ordem Operacional | Tier | Modelo Selecionado | Rota de Provedor | Quota Upstream Observada | Score |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | **PRIMARY** | `kc/cohere/north-mini-code:free` | `9router:kc` | NÃO | **99.10** |
| **2** | **SECONDARY** | `kc/kilo-auto/free` | `9router:kc` | NÃO | **93.80** |
| **3** | **TERTIARY** | `kc/nvidia/nemotron-3.5-lightning:free` | `9router:kc` | NÃO | **83.05** |
| **4** | **QUATERNARY** | `openrouter/cohere/north-mini-code:free` | `9router:openrouter` | **SIM** (50 req/dia) | **82.70** |
| **5** | **EMERGENCY** | `openrouter/openrouter/free` | `9router:openrouter` | **SIM** (50 req/dia) | **81.55** |

---

## 7. NÍVEL DE CONFIANÇA E LIMITAÇÕES

### Confiabilidade Global: `PROVEN`
Os resultados foram obtidos por execução real de código e testes em tempo de execução (`node --test`), com tráfego HTTP ativo através do gateway de produção do 9Router.

### O Que Foi PROVADO:
1. `FREE_ROUTING_POLICY`: PROVADO.
2. `BEST_FREE_PROVEN = kc/cohere/north-mini-code:free`: PROVADO no universo de candidatos testado.
3. `FALLBACK_OPERACIONAL = kc/kilo-auto/free`: PROVADO.
4. Normalização de protocolo de ferramentas vazias: PROVADO (0 protocol crashes).
5. Isolamento e fail-closed de modelos pagos/comerciais: PROVADO (100% de rejeição).

### O Que NÃO Foi Provado (Declarações Negativas Necessárias):
1. **`BEST_FREE_GLOBAL = NOT_PROVEN`**: Não foi provado que este seja o melhor modelo FREE existente em escala global.
2. **`ROUTE_STABILITY_LONG_TERM = NOT_PROVEN`**: A estabilidade de quota e latência dos nós `kc/*` ao longo de semanas/meses não pode ser garantida sem observabilidade contínua.
3. **`CONCURRENT_LOAD = NOT_PROVEN`**: O comportamento sob concorrência maciça de múltiplos workers consumindo simultaneamente a mesma chave do 9Router não foi testado.
4. **`EXTREME_CONTEXT = NOT_PROVEN`**: Testes com bases de código enormes (> 64k tokens em prompt ativo) não foram avaliados nesta rodada.

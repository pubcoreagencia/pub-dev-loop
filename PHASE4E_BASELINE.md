# PHASE 4E — BASELINE OPERACIONAL DO PRODUTO

**Data da Auditoria**: 2026-09-11 21:16 UTC-3  
**Produto**: `pub-rate-calculator`  
**Repositório**: `https://github.com/pubcoreagencia/pub-rate-calculator.git`  

---

## 1. IDENTIDADE GIT E CONTROLE DE VERSÃO

* **HEAD**: `2215130d965c1fea300b73a2ab963d31d3186748`
* **Remote `origin/main`**: `2215130d965c1fea300b73a2ab963d31d3186748`
* **Branch Padrão**: `main`
* **Working Tree**: `clean` (sem modificações locais não rastreadas)
* **Status de Sincronização**: `LOCAL_COMMIT == REMOTE_COMMIT` (verificado via `git ls-remote`)

---

## 2. ESTRUTURA DE ARQUIVOS E DIRETÓRIOS

```text
pub-rate-calculator/
├── .git/
├── config/
│   ├── .gitkeep
│   └── pricing-tier.json
├── public/
│   └── index.html
├── src/
│   └── calculator.js
├── test/
│   └── validate.mjs
└── package.json
```

---

## 3. COMPORTAMENTO ATUAL DO PRODUTO (`src/calculator.js`)

O produto atualmente exporta três funções principais:
1. `calculateRate(baseCpm, impressions, multiplier = 1.0)`:
   - Valida argumentos negativos (`baseCpm < 0 || impressions < 0`).
   - Retorna: `((baseCpm * impressions) / 1000) * multiplier`.
2. `calculateEnterpriseRate(baseCpm, impressions, enterpriseDiscount = 0)`:
   - Valida limites de desconto corporativo (`0 <= enterpriseDiscount <= 100`).
   - Calcula a receita bruta e subtrai o desconto percentual corporativo.
3. `validateEnterpriseConfiguration(config)`:
   - Valida a estrutura do objeto de configuração de precificação corporativa.

Configuração de tier existente em `config/pricing-tier.json`:
```json
{ "enterpriseMultiplier": 1.25 }
```

---

## 4. COMANDO DE VALIDAÇÃO E SUÍTE DE TESTES

* **Comando de Teste**: `node test/validate.mjs` (definido em `package.json` como `"test": "node test/validate.mjs"`)
* **Critérios Atuais de Sucesso**:
  1. `calculateRate(10, 1000) === 10`
  2. Presença e leitura válida de `config/pricing-tier.json`
  3. `config.enterpriseMultiplier === 1.25`
  4. `calculateRate(10, 1000, 1.25) === 12.5`
* **Saída da Execução no Baseline**:
  ```text
  [Validator] Running suite for pub-rate-calculator...
  [Validator] ALL TESTS PASSED (exit 0)
  ```
* **Exit Code**: `0`

---

## 5. OBJETIVO DA EVOLUÇÃO AUTÔNOMA NA PHASE 4E

Expandir o motor de precificação de mídia da **PUB Media** com:
1. **Comissão de Agência** (`calculateAgencyCommission`): cálculo de repasse/comissão sobre receita líquida ou bruta.
2. **Margem Líquida** (`calculateNetMargin`): cálculo de margem operacional após custos de veiculação e comissões.
3. **Regras de Faturamento por Volume** (`calculateVolumeDiscount`): descontos automáticos escalonados por faixas de impressões (< 1M, 1M–5M, > 5M).
4. **Validação Robusta de Entrada**: tratamento defensivo contra valores negativos ou percentuais inválidos.
5. **Retrocompatibilidade Estrita**: preservação integral de `calculateRate`, `calculateEnterpriseRate` e `validateEnterpriseConfiguration`.
6. **Atualização da Suíte de Testes**: expansão em `test/validate.mjs` para validar formalmente todas as novas funções.

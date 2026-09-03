# PDL — PHASE 8.6-A: AUDITORIA DE COMPORTAMENTO E CONTEXTO DOS AGENTES

## 1. Status Executivo & Escopo

A Phase 8.6-A realizou a **auditoria técnica completa, factual e aprofundada** de como os cinco agentes organizacionais do THE OFFICE recebem, processam e utilizam contexto:

1. **Chief of Staff**
2. **Architect**
3. **Developer**
4. **Reviewer**
5. **QA Engineer**

---

## 2. Mapa Detalhado de Contexto por Agente

### 2.1 Chief of Staff (`chief-of-staff`)
* **Funções de Entrada / Enriquecimento:** `enrichChiefOfStaffTaskWithMemory()` em `src/office/memory.ts`, `createOrganizationalPlan()` em `src/office/planning.ts`.
* **Memórias Autorizadas:** `DECISION`, `PLAN`, `PROJECT_CONTEXT`.
* **Lições Institucionais:** `STRATEGIC_GUIDANCE` (+5), `ARCHITECTURE_GUIDANCE` (+4), `OPERATIONAL_GUIDANCE` (+3).
* **Precedência Rastreável:** `CURRENT CEO OBJECTIVE > SECURITY/RUNTIME POLICIES > CURRENT PROJECT/APPROVAL STATE > ORGANIZATIONAL MEMORY`.
* **Garantia:** Memórias históricas nunca substituem novos objetivos do CEO nem alteram estados de aprovação.

### 2.2 Architect (`architect`)
* **Funções de Entrada / Enriquecimento:** `enrichArchitectTaskWithMemory()` em `src/office/memory.ts`.
* **Memórias Autorizadas:** `DECISION`, `PLAN`, `REVIEW_FINDING`, `PROJECT_CONTEXT`.
* **Lições Institucionais:** `ARCHITECTURE_GUIDANCE` (+5), `STRATEGIC_GUIDANCE` (+4).
* **Precedência Rastreável:** `CURRENT TASK > RUNTIME POLICIES > ORGANIZATIONAL MEMORY`.
* **Garantia:** Architecture Guidance é estritamente consultiva e não ordena mutações automáticas.

### 2.3 Developer (`developer`)
* **Funções de Entrada / Enriquecimento:** `enrichDeveloperTaskWithMemory()` em `src/office/memory.ts`.
* **Memórias Autorizadas:** `TASK_RESULT`, `REVIEW_FINDING`, `LESSON`, `PROJECT_CONTEXT`.
* **Lições Institucionais:** `OPERATIONAL_GUIDANCE` (+5), `TESTING_GUIDANCE` (+4).
* **Precedência Rastreável:** `CURRENT TASK > RUNTIME POLICIES > ORGANIZATIONAL MEMORY`.
* **Garantia:** Sem capacidade de alterar políticas de segurança, permissões de ferramentas ou ignorar testes.

### 2.4 Reviewer (`reviewer`)
* **Funções de Entrada / Enriquecimento:** `enrichReviewerTaskWithMemory()` em `src/office/memory.ts`, `evaluateReviewIteration()` em `src/office/review.ts`.
* **Memórias Autorizadas:** `REVIEW_FINDING`, `TASK_RESULT`, `PROJECT_CONTEXT`.
* **Lições Institucionais:** `SECURITY_GUIDANCE` (+5), `OPERATIONAL_GUIDANCE` (+4).
* **Precedência Rastreável:** `CURRENT EXECUTION / REVIEW EVIDENCE > CURRENT TASK > RUNTIME POLICIES > ORGANIZATIONAL MEMORY`.
* **Guardrail Absoluto:** `MAX_REVIEW_ITERATIONS = 3` inalterável por memória.

### 2.5 QA Engineer (`qa-engineer`)
* **Funções de Entrada / Enriquecimento:** `enrichQaTaskWithMemory()` em `src/office/memory.ts`.
* **Memórias Autorizadas:** `TASK_RESULT`, `REVIEW_FINDING`, `LESSON`, `PROJECT_CONTEXT`.
* **Lições Institucionais:** `TESTING_GUIDANCE` (+5), `OPERATIONAL_GUIDANCE` (+4).
* **Precedência Rastreável:** `CURRENT QA / TEST EVIDENCE > CURRENT TASK > RUNTIME POLICIES > ORGANIZATIONAL MEMORY`.
* **Garantia:** Evidências de testes presentes (exitCode, stdout/stderr, erros) prevalecem sobre qualquer lição.

---

## 3. Ordem Rastreável de Montagem de Prompt

$$\text{Task Prompt / Instrução Atual} \rightarrow \text{[GOVERNED INSTITUTIONAL LESSONS]} \rightarrow \text{[ORGANIZATIONAL MEMORY]}$$

1. **Camada Superior:** Prompt da tarefa com instrução imperativa, diffs, arquivos modificados e objetivos imediatos.
2. **Camada Intermediária:** Bloco consultivo de Lições Institucionais Governadas com aviso estatutário de subordinação.
3. **Camada Base:** Bloco histórico de Memórias Organizacionais Verificadas com limites estritos (máx 5 memórias, 500 chars).

---

## 4. Auditoria de Falhas e Isolamento

* **Isolamento de Falha:** Erros em pool PostgreSQL, timeouts ou queries no retrieval são capturados com `try/catch` e nunca abortam o ciclo principal (`provider.execute` continua normalmente com prompt base).
* **Isolamento Multi-Tenant:** Cada busca valida obrigatoriamente `tenantId`; consultas com tenant diferente retornam lista vazia.

---

## 5. Recomendações para Phase 8.6-B

1. Manter os contratos estritos de montagem de prompt.
2. Preservar o isolamento de falha em todas as camadas de retrieval.
3. Avançar na instrumentação e especialização das diretrizes operacionais por papel sem criar autoridade imperativa desgovernada.

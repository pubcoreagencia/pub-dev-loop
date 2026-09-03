# PUB DEV LOOP (THE OFFICE) — UNIFIED MASTER CONTEXT
**Canonical Architectural Source of Truth & Operational Specification**

---

## SUMÁRIO EXECUTIVO

O **PUB DEV LOOP (PDL)** é uma plataforma unificada de desenvolvimento de software em nuvem (Cloud-First Autonomous Engineering Platform) estruturada em torno de uma metáfora organizacional e espacial viva: **THE OFFICE**.

Este documento integra e unifica em um único padrão canônico:
1. **O que era a ideia (A Fundação & Core Engine):** A fila durável de tarefas, execução em workers isolados, gateway de LLMs resiliente, integridade do Git e protocolo estrito de continuidade.
2. **O que se tornou (A Realidade Atual & THE OFFICE):** Uma força de trabalho de 5 agentes especialistas de IA liderados pelo CEO em um escritório virtual 3D, governados por camadas determinísticas de memória, aprendizagem institucional, feedback de resultados reais, inteligência e consciência organizacional.
3. **O que precisa se tornar (O Horizonte Futuro & Compounding Autônomo):** A transformação do aprendizado em skills reutilizáveis (Daily Skill Learning), execução autônoma adaptativa governada, ambiente colaborativo vivo com turntable compartilhado e ecossistema multi-projeto escalável.

---

# PARTE I — A FUNDAÇÃO & O QUE ERA A IDEIA (THE CORE ENGINE)

## 1. Identidade, Filosofia e Escopo Original
O PUB DEV LOOP nasceu com uma premissa inegociável: **Engenharia de software automatizada, auditável, reproduzível e puramente em nuvem (Cloud-First & Cloud-Only)**.
Máquinas locais de desenvolvimento são apenas clientes de visualização; o cérebro operacional e o runtime de execução vivem na nuvem.

### O Ciclo Puro da Engine:
$$\text{Task API} \longrightarrow \text{PostgreSQL Queue} \longrightarrow \text{Isolated Worker} \longrightarrow \text{Provider (LLM)} \longrightarrow \text{Workspace} \longrightarrow \text{Automated Tests} \longrightarrow \text{Git Commit} \longrightarrow \text{Result Persistence}$$

## 2. Invariantes Fundamentais da Engine
1. **Soberania do Worker sobre o Workspace:** O Worker é o proprietário absoluto do workspace temporário, da execução de processos no sistema operacional, do Git e da finalização da tarefa. O modelo/provedor de IA é apenas uma fonte de sugestão de código e *jamais* possui acesso direto ao host ou controle do repositório.
2. **Persistence-First Continuity Protocol:** Sessões de chat, contextos de IA e máquinas locais são voláteis. O **Git** e o **PostgreSQL** são as únicas fontes duráveis de verdade. Qualquer evolução do projeto deve ser materializada no repositório.
   $$\text{READ CONTEXT} \longrightarrow \text{IMPLEMENT} \longrightarrow \text{VALIDATE} \longrightarrow \text{UPDATE CONTEXT} \longrightarrow \text{COMMIT} \longrightarrow \text{PUSH/PR} \longrightarrow \text{VERIFY PERSISTENCE}$$
3. **Segurança & Gestão de Segredos:** Segredos (chaves de API, tokens de autenticação) são injetados exclusivamente em tempo de execução via variáveis de ambiente/Secret Managers. Nunca são gravados em arquivos commitados, logs de execução ou resultados de tarefas.
4. **Proibição Absoluta de Fake Activity:** O sistema jamais deve gerar simulações artificiais de progresso, trabalho falso ou diálogos fictícios. O estado visual e as métricas refletem exclusivamente execuções e dados empíricos reais.

## 3. Arquitetura de Execução e Resiliência
* **Dual Gateway Resiliente:** Roteamento de modelos com fallback automático entre gateways (`PRIMARY_GATEWAY = "openrouter"`, `FALLBACK_GATEWAY = "9router"`), gerenciamento de cotas (HTTP 429) e timeout global (`ROUTER_TIMEOUT_TOTAL_MS`).
* **Ciclos de Worker Serializados (ADR-001):** Execução agendada sequencialmente para evitar condições de corrida em workers concorrentes.
* **Sanitização de Estado (ADR-002):** Proibição estrita de valores `undefined` em queries do PostgreSQL para garantir persistência determinística de falhas e sucessos.
* **Task Finalizer (`src/finalizer.ts`):** Validação automática de syntax/typecheck/build/testes antes de comitar qualquer alteração local no branch do Git.

---

# PARTE II — O QUE SE TORNOU (THE LIVE ARCHITECTURE & THE OFFICE)

## 4. THE OFFICE — A Força de Trabalho Virtual Espacial
O PUB DEV LOOP evoluiu para além de uma simples fila de background: tornou-se **THE OFFICE**, um ambiente virtual interativo onde o CEO lidera uma equipe de 5 funcionários virtuais canônicos.

### Os 5 Papéis Canônicos:
1. **Chief of Staff (CoS) — `chief-of-staff`:** Braço direito do CEO. Desdobra objetivos estratégicos em planos organizacionais estruturados, coordena handoffs e acompanha a execução global.
2. **Arquiteto de Software (Architect) — `architect`:** Responsável pelo design de alto nível, contratos de API, isolamento de dependências, integridade de arquitetura e mitigação de débitos técnicos.
3. **Desenvolvedor Full-Stack (Developer) — `developer`:** Implementador das soluções, refatorações, criação de endpoints e código de aplicação dentro de workspaces isolados.
4. **Revisor de Código (Reviewer) — `reviewer`:** Guardião estrito de qualidade e segurança. Aplica guardrails rigorosos de review, aponta violações de regras e impõe o limite inegociável de **`MAX_REVIEW_ITERATIONS = 3`**.
5. **Engenheiro de QA (QA Engineer) — `qa-engineer`:** Validador empírico de testes unitários, testes de regressão, suites E2E e confirmação de remediações comprovadas.

## 5. Soberania do CEO & Contratos de Decisão Governada
* **Soberania do CEO:** O CEO humano é o árbitro supremo. Decisões de arquitetura crítica, aprovação de desvios de segurança e promoção para produção exigem autorização explícita do CEO.
* **Decision Context Engine (`src/office/decision-context.ts`):** Estrutura o raciocínio operacional dos agentes em contratos estritamente tipados:
  $$\text{OBJETIVO} \longrightarrow \text{RESPONSABILIDADE} \longrightarrow \text{EVIDÊNCIA} \longrightarrow \text{RESTRIÇÕES} \longrightarrow \text{OPÇÕES} \longrightarrow \text{RECOMENDAÇÃO} \longrightarrow \text{PRÓXIMO PASSO} \longrightarrow \text{GOVERNANCE CHECK}$$
* **Governed Context Assembly (`src/office/context-assembly.ts`):** Hierarquia estrita de autoridade na montagem de prompts:
  $$\text{EVIDÊNCIA DO RUNTIME ATUAL} > \text{LIÇÕES INSTITUCIONAIS VALIDADAS} > \text{MEMÓRIA ORGANIZACIONAL HISTÓRICA}$$

## 6. Memória Organizacional e Governança (Phases 8.1 - 8.4)
* **Tipos de Memória:** `DECISION`, `REVIEW_FINDING`, `TASK_RESULT`, `LESSON`, `PROJECT_CONTEXT`, `AGENT_CONTEXT`, `PLAN`.
* **Motor de Governança (`src/office/memory-governance.ts`):** Transições de ciclo de vida (`ACTIVE`, `SUPERSEDED`, `BLOCKED`), desduplicação determinística, cálculo de qualidade e quarentena para memórias contraditórias (`CONTRADICTORY_UNRESOLVED`).

## 7. Pipeline de Aprendizagem Institucional (Phases 8.5-A - 8.5-F)
O THE OFFICE aprende com o trabalho real através de uma esteira determinística de promoção sem dependência de LLM ou bancos vetoriais:
$$\text{Evento Real} \longrightarrow \text{Memória} \longrightarrow \text{Padrão SHA-256} \longrightarrow \text{Candidato a Lição} \longrightarrow \text{Validação pelo CEO} \longrightarrow \text{Lição Institucional} \longrightarrow \text{Recuperação por Papel}$$
* **Detecção de Padrões (`src/office/pattern-detection.ts`):** Identifica recorrências corroboradas por $\ge 3$ tarefas independentes.
* **Validação Governada (`src/office/lesson-validation.ts`):** Aplica a Matriz de Governança, exigindo aprovação do CEO para diretrizes estratégicas e de segurança.
* **Recuperação de Lições (`src/office/lesson-retrieval.ts`):** Injeta heurísticas governadas no contexto de decisão de forma consultiva e subordinada à evidência atual.

## 8. Feedback Loop, Inteligência e Consciência Organizacional (Phases 8.6-A - 8.6-F)
* **Learning Feedback Loop (`src/office/learning-feedback.ts`):** Deriva sinais estruturados a partir dos resultados reais de tarefas, revisões e testes.
* **Organizational Intelligence (`src/office/organizational-intelligence.ts`):** Motor diagnóstica que computa métricas de entrega, qualidade, riscos operacionais, tendências temporais e gargalos.
* **Organizational Awareness (`src/office/organizational-awareness.ts`):** O THE OFFICE enxerga o pulso da organização em tempo real (`GET /office/awareness`, pulso no `OfficeHeader.tsx`, `AwarenessPanel.tsx`).
  * *Invariante Central:* As recomendações são estritamente consultivas (`requiresHumanDecision: true`) e os gargalos refletem fluxos de processos sem linguagem punitiva a funcionários.

## 9. Padrão de Interface & Idioma (Office First / pt-BR First)
* Toda a interface visível do THE OFFICE é padronizada em **Português do Brasil (pt-BR)**.
* A interface primária é o **OfficeFloorMap 3D** (espaço físico, mesas dos agentes, presença do CEO e chat global de comando). Painéis operacionais abrem em overlays/modais discretos para nunca transformar o produto em um dashboard tradicional.

---

# PARTE III — O QUE PRECISA SE TORNAR (THE AUTONOMOUS HORIZON & ROADMAP)

## 10. Phase 8.7 — Daily Skill Learning & Organizational Compounding
Transformação de lições institucionais validadas em **Skills Reutilizáveis Tipadas** (`SkillRecord`):
* **Catálogo de Skills (`src/office/skills.ts`):** `name`, `description`, `capability`, `sourceExperiences`, `confidence`, `version`, `applicableContexts`, `limitations`.
* **Compounding Organizacional:** Agentes consultam e executam skills consolidadas para acelerar rotinas de scaffolding, validação, remediação de bugs comuns e arquitetura.

## 11. Phase 8.8 — Governed Autonomous Execution & Adaptive Task Flow
* Capacidade do Chief of Staff de orquestrar pipelines de tarefas multi-etapas com delegação automática para especialistas e checkpoints de aprovação do CEO em pontos críticos.
* Resolução adaptativa de gargalos com base nos sinais da inteligência organizacional, mantendo a soberania humana intacta.

## 12. Phase 8.9 — Ecossistema Multi-Projeto & Colaboração Global
* Suporte nativo à alternância dinâmica de projetos no escritório, com isolamento estrito de workspaces e herança de lições organizacionais globais homologadas pelo CEO.

## 13. Phase 9.0 — The Living Workplace & Turntable
* **Toca-Discos do Escritório (The Office Turntable):** Sistema virtual de som compartilhado no escritório onde o CEO faz upload e reproduz trilhas musicais para o ambiente, com reações ambientais leves e não-bloqueantes dos agentes.
* **Colaboração Espacial Avançada:** Animações e movimentações físicas autênticas quando houver handoffs de tarefas e reuniões estratégicas entre funcionários.

---

# PARTE IV — MATRIZ DE REGRAS E INVARIANTES ABSOLUTOS

| Invariante / Regra | Definição Canônica |
|---|---|
| **Office First** | O escritório virtual espacial e a colaboração entre funcionários é a experiência central do produto, nunca um dashboard BI tradicional. |
| **Soberania do CEO** | Nenhuma ação autônoma pode aprovar produção, alterar regras de segurança ou ignorar o limite de `MAX_REVIEW_ITERATIONS = 3` sem aprovação do CEO. |
| **Precedência da Verdade** | $\text{RUNTIME ATUAL} > \text{EXECUÇÃO REAL} > \text{REVIEW REAL} > \text{QA REAL} > \text{FEEDBACK} > \text{PADRÕES} > \text{LIÇÕES} > \text{MEMÓRIA HISTÓRICA}$ |
| **Isolamento de Tenant & Projeto** | Nenhuma informação, memória, inteligência ou skill de um Tenant/Projeto pode vazar para outro. |
| **Zero Fake Activity** | Proibição absoluta de animações falsas, conversas fabricadas ou métricas fictícias. Apenas dados empíricos reais. |
| **Decisão Humana em Recomendações** | Todas as recomendações geradas por inteligência organizacional possuem `requiresHumanDecision: true`. |
| **pt-BR First** | Todos os textos visíveis ao usuário no THE OFFICE são em Português do Brasil. |
| **Persistence-First** | O Git e o PostgreSQL são a única fonte durável de verdade da engenharia. |

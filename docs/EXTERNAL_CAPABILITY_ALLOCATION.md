# PDL | External Capability Allocation

**Status:** Canonical direction
**Date:** 2026-09-16

## Purpose

Registrar como o research externo deve alterar o PUB Dev Loop sem transplantar projetos externos e sem duplicar responsabilidades com ACP, PUB Machine ou PUB Neural.

**Princípio:** importar capacidades, não projetos.

## Primary reference: PAUL

Source: https://github.com/ChristopherKahler/paul

PAUL é referência para tornar o ciclo de engenharia verificável e orientado por estado.

### Capabilities to absorb

- acceptance criteria explícitos;
- qualification da tarefa antes da execução;
- diagnóstico antes de agir;
- plan/apply/unify como conceitos de reconciliação;
- estados intermediários além de sucesso/falha;
- handoff/resume;
- reconciliation entre plano, workspace e resultado;
- evidência de conclusão.

### Canonical PDL loop

`Research → Plan → Execute → Test → Correct → Verify → Learn`

Uma tarefa não deve ser considerada concluída apenas porque o agente declarou sucesso. A conclusão deve ser sustentada por critérios de aceitação, testes e evidências.

### Suggested terminal states

- `DONE`
- `DONE_WITH_CONCERNS`
- `NEEDS_CONTEXT`
- `BLOCKED`
- `FAILED`

Esses estados complementam os estados operacionais já existentes no MVP e devem ser introduzidos sem quebrar contratos atuais.

## Secondary references

### OpenHands

Source: https://github.com/openhands

Absorver como referência para sessões de agentes, múltiplos backends, automações e separação entre agente e ambiente de execução. O PDL pode decidir qual capacidade precisa, mas não deve absorver o runtime do OpenHands.

### Browser Use

Source: https://github.com/browser-use/browser-use

Usar como referência de capacidade externa para pesquisa Web e automação browser. A execução concreta pertence ao PUB Machine, acionada por contratos de execução.

### Crawl4AI / Maxun

Sources:
- https://github.com/unclecode/crawl4AI
- https://github.com/getmaxun/maxun

PDL pode solicitar pesquisa/coleta estruturada, mas não deve virar crawler. O resultado chega ao PDL por uma capacidade do PUB Machine e pode ser registrado como evidência/contexto no PUB Neural.

## Non-duplication rules

1. PDL decide, planeja, qualifica, verifica e aprende.
2. ACP executa sob suas próprias regras de segurança e controle.
3. PUB Machine fornece capacidades de browser, crawler, infraestrutura e execução especializada.
4. PUB Neural armazena conhecimento, evidências, relações e lições institucionalizadas.
5. Control Room observa, coordena e expõe operação, mas não substitui o PDL.

## Implementation priority

### P0
- Acceptance criteria como parte do contrato de tarefa.
- Qualification/diagnosis antes da execução.
- Evidence-based completion.
- Correction loop obrigatório.
- Reconciliation entre plano, alterações, testes e resultado.
- Estados `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT` e `BLOCKED` quando aplicáveis.

### P1
- Research stage com integração ao PUB Machine.
- Handoff/resume robusto.
- Lessons/evidence encaminhadas ao PUB Neural.
- Playwright/UX verification quando o tipo de tarefa exigir.

### P2
- Scout/continuous research.
- Governança L0-L5 integrada ao ciclo.
- Aprendizado baseado em histórico de execuções.

## Architectural boundary

PDL continua sendo o cérebro operacional de engenharia. Ele não deve absorver OpenHands, PAUL, Browser Use, Crawl4AI ou Maxun como subprojetos.

O objetivo é que o PDL saiba **quando e por que** usar essas capacidades, enquanto os runtimes especializados permanecem em seus projetos proprietários.

# PUB DEV LOOP — GOVERNANÇA ESTRATÉGICA

## Regra de foco atual: PDL primeiro para a PUB Holding

**Status:** REGRA VIGENTE
**Escopo:** Todas as fases de desenvolvimento, validação, evolução e arquitetura do PUB DEV LOOP enquanto a fase de maturação interna não for encerrada.

### 1. Objetivo principal

O PUB DEV LOOP (PDL) deve ser desenvolvido primeiro como **motor interno de engenharia e autonomia da PUB Holding**.

A prioridade atual não é transformar o PDL em produto comercial. A prioridade é torná-lo suficientemente confiável, autônomo, observável, seguro e resiliente para operar sobre os projetos e necessidades reais da PUB.

### 2. Ordem estratégica obrigatória

A sequência estratégica é:

```text
PDL interno
  -> validação rigorosa
  -> evolução técnica e comportamental
  -> operação real na PUB Holding
  -> maturidade e confiabilidade comprovadas
  -> productização
  -> camada comercial
  -> SaaS do PDL
```

### 3. Regra de não-desvio

Enquanto a maturidade interna do PDL não estiver comprovada:

- Não priorizar interface comercial, pricing, planos, billing de clientes, onboarding comercial ou aquisição de usuários externos.
- Não deixar requisitos de SaaS moldarem ou contaminarem artificialmente os testes de autonomia do núcleo.
- Não criar abstrações comerciais apenas porque seriam úteis para uma futura versão SaaS.
- Priorizar capacidades que aumentem a autonomia real do PDL para compreender objetivos, pesquisar, planejar, executar, testar, corrigir, revisar, persistir estado e continuar trabalho ao longo do tempo.

### 4. Critério de transição

A camada comercial do PDL só deve ser iniciada depois que houver evidência suficiente de que o PDL funciona como **sistema interno de engenharia da PUB**, com validações repetíveis e ausência de bloqueadores críticos conhecidos.

A decisão de iniciar a productização deve ser tratada como uma **nova etapa estratégica**, não como continuação automática das fases de validação do núcleo.

### 5. Princípio de arquitetura

O núcleo de autonomia deve permanecer desacoplado da futura camada comercial sempre que isso melhorar:

- confiabilidade;
- auditabilidade;
- segurança;
- testabilidade;
- portabilidade;
- capacidade de operar a infraestrutura e os projetos da PUB.

A futura camada SaaS poderá consumir o núcleo por meio de interfaces bem definidas, mas não deve ditar sua lógica interna antes da hora.

### 6. Regra de decisão para próximas fases

Antes de criar qualquer nova fase do PDL, responder:

> **"Esta fase aumenta comprovadamente a capacidade do PDL de operar como motor interno da PUB Holding?"**

Se a resposta for **não**, a fase deve ser adiada, redirecionada ou rejeitada até a etapa de productização comercial.

### 7. Estado estratégico

```text
CURRENT MISSION:
Maturar o PDL como sistema interno da PUB Holding.

NOT YET:
Transformar o PDL em SaaS comercial.

LATER:
Productizar o núcleo validado como uma camada comercial independente.
```

Esta regra é normativa para o planejamento do PDL e deve ser considerada contexto obrigatório para futuras decisões de roadmap, priorização e criação de fases.

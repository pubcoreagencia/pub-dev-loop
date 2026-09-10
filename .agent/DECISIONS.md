# DECISIONS.md — Arquitetura & Decisões Vinculantes do PDL
Decisions recorded here.

## Decisões Confirmadas (até 12.2C)

### 1. Workforce Contract (Confirmado 12.2A)
- **Decisão**: Contrato arquitetural canônico = 59 agentes
- **Composição**: 9 base + 50 especializados + 10 setores + 5 papéis especializados
- **Evidência**: Commit `aa77bdd`; arquivos `src/office/squads.ts`, `src/office/registry.ts`

### 2. Type Reconciliation (Confirmado 12.2B)
- **Decisão**: Manter tipos fortes; remover `as any`; manter `FIFTY_SPECIALIZED_AGENTS: SpecializedAgent[]`
- **Evidência**: Commit `ba9aa62`; remoção de casts `as any` em `src/office/registry.ts`

### 3. AgentRegistry Contract (Confirmado 12.2B-FIX)
- **Decisão**: Restaurar contrato padrão; garantir `reportsTo: 'chief-of-staff'` para 50 especializados
- **Evidência**: Commit `fbc9e42`; linha 291 de `src/office/registry.ts`

### 4. Organizational Contract (Confirmado 12.2C)
- **Decisão**: Manter camada organizacional; getDepartments() retorna 3 departamentos base por design
- **Evidência**: Testes atualizados em 12.2C; typecheck passou

### 5. Corrected Tests (Confirmado 12.2C)
- **Decisão**: Corrigir apenas 3 testes de escritório; não alterar código de produção
- **Mudanças**: agent-registry (5+10 departments, 9+5 roles, reportsTo validation), api (FIFTY_SPECIALIZED_AGENTS IDs), organization (58 direct reports, hierarchy)

### 6. Governance & Internal-First Rule (Confirmado docs/)
- **Decisão**: PDL primeiro como motor interno da PUB Holding; productização SaaS diferida
- **Evidência**: `docs/PDL_GOVERNANCE.md`; commit `8acd6ee`

## Regras Invioláveis (do MASTER_CONTEXT.md)

1. **Typecheck obrigatório** — `npx tsc --noEmit` EXIT_CODE=0
2. **Testes autorizados passam** — 41/41
3. **Nenhum `as any` novo em produção**
4. **Git limpo** — working tree vazio, HEAD == origin/main
5. **Handoff operacional** — `.agent/` é source of truth; GITHUB para código
6. **Nenhuma productização SaaS nesta fase**
7. **Validação E2E real** — não inventar saída

## Histórico de Commits Relevantes (até 12.2C)

| Commit | Descrição |
|--------|-----------|
| `43ff6fa` | test(office): reconcile tests with canonical 59-agent workforce (12.2C) |
| `c5dd671` | fix(office): type specialized workforce source (12.2B-FIX) |
| `ba9aa62` | fix(office): reconcile agent types with canonical 59-agent workforce (12.2B) |
| `fbc9e42` | fix(office): restore default AgentRegistry contract (12.2B-FIX) |
| `f6ee11a` | feat(correction): implement self-correcting prototype worker (12.1) |
| `8acd6ee` | docs: establish PDL internal-first governance rule |

---

*Este arquivo deve ser atualizado sempre que houver decisão arquitetural vinculante. Não remover decisões passadas — apenas adicionar.*
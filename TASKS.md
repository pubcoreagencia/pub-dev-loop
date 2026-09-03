# TASKS — PHASE 8.7: DAILY SKILL LEARNING & ORGANIZATIONAL COMPOUNDING

## ETAPA 1: CONTRATOS & DOMÍNIO DE SKILLS
- [x] 1.1 Criar `src/office/skills.ts` com contratos tipados (`SkillRecord`, `SkillCapability`, `SkillContext`, `SkillVersion`, `DailySkillEngine`)
- [x] 1.2 Implementar compilação determinística de Lição Institucional -> Skill e ciclo de vida de skills
- [x] 1.3 Re-exportar contratos e singleton em `src/office/memory.ts`

## ETAPA 2: PERSISTÊNCIA & MIGRATIONS
- [x] 2.1 Criar migration `db/migrations/016_daily_skills.sql`
- [x] 2.2 Atualizar testes de migração em `tests/prototype-concurrency-migrations.test.ts`

## ETAPA 3: INTEGRAÇÃO COM CONTEXT ASSEMBLY & DECISION CONTEXT
- [x] 3.1 Integrar recuperação de skills por papel em `src/office/context-assembly.ts`
- [x] 3.2 Suportar referência a skills no `src/office/decision-context.ts`

## ETAPA 4: BACKEND APIS & ROTAS
- [x] 4.1 Implementar `GET /office/skills` e `GET /office/skills/:id` em `src/api.ts` (Express)
- [x] 4.2 Implementar `GET /office/skills` e `GET /office/skills/:id` em `src/api-worker.ts` (Cloudflare)

## ETAPA 5: FRONTEND & THE OFFICE INTEGRATION
- [x] 5.1 Atualizar `frontend/src/types/office.ts` com interfaces de skills
- [x] 5.2 Adicionar `fetchSkills` em `frontend/src/services/api.ts`
- [x] 5.3 Conectar catálogo de skills no `frontend/src/store/useStore.ts`
- [x] 5.4 Exibir skills dominadas no `frontend/src/components/AgentInspector.tsx`
- [x] 5.5 Exibir catálogo de skills organizacionais no `frontend/src/components/AwarenessPanel.tsx`

## ETAPA 6: MATRIZ DE TESTES DEDICADA
- [x] 6.1 Criar suíte `tests/office-skills.test.ts` com 40+ testes determinísticos
- [x] 6.2 Executar suíte completa do repositório garantindo 100% PASS (524/524 testes PASS)

## ETAPA 7: DOCUMENTAÇÃO, BUILD & DEPLOY
- [x] 7.1 Executar validações de build (`typecheck`, `build`, `frontend build`)
- [x] 7.2 Criar `PHASE_8_7_DAILY_SKILL_LEARNING.md` e atualizar `THEOFFICEMASTERCONTEXT.md`
- [x] 7.3 Commit, push para `origin/main` e deploy oficial no Cloudflare Workers

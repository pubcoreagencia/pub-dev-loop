# MASTER_CONTEXT.md — PDL (Pub Dev Loop) Identity & Architecture

## Overview

PUB DEV LOOP is the primary project name. PDL = PUB DEV LOOP.

## Identity
**PDL** (Pub Dev Loop) — motor interno da PUB Holding para execução autônoma de tarefas de engenharia, geração de protótipos conversacionais e validação contínua.

**Primary Rule**: PDL **first as internal engine**. SaaS productization is not the goal of this phase. No commercialization, frontend, UX, external customer onboarding, billing or multi-tenancy functionality should be developed without explicit decision in DECISIONS.md.

## Mission
Execute engineering operations (code, review, test, deploy) via autonomous agents orchestrated by the Chief of Staff, with real E2E validation, mandatory typecheck and handoff between executors (Codex → Hermes → others) without context loss.

## Canonical Architecture (Confirmed in 12.2A–12.2C)

### Workforce — 59 Agents
- **9 base** (INITIAL_STAFF): chief-of-staff, architect, developer, reviewer, qa-engineer, video-editor, image-designer, sound-engineer, growth-ops
- **50 specialized** (FIFTY_SPECIALIZED_AGENTS): 10 sectors × 5 roles (TECH_LEAD, FULLSTACK_DEV, PRODUCT_DESIGNER, QA_SECURITY, GROWTH_SALES)
- **10 sectors** (PUB_HOLDING_SECTORS): B2B Growth, Pub Machine/SaaS, E-Commerce/Food, Audiovisual/Cinema/Music, 3D/Games, 3D Physical/Pets, Real Estate/Hospitality, iGaming/PubBet, Web3/Crypto, Neural-OS/Infra
- **Hierarchy**: all 58 non-chief agents report to `chief-of-staff` (reportsTo='chief-of-staff'); chief-of-staff reportsTo=null (human CEO)

### Core Components
- `src/office/registry.ts` — AgentRegistry (59 agents, full workforce)
- `src/office/organization.ts` — OfficeOrganization (3 base departments: EXECUTIVE, ENGINEERING, QA; 59 agents in full org)
- `src/office/squads.ts` — buildProjectSquad(), FIFTY_SPECIALIZED_AGENTS (typed as SpecializedAgent[])
- `src/office/types.ts` — Canonical types (AgentDepartment, AgentRole, AgentRoutingProfile, AgentStatus)
- `src/office/planning.ts` — OrganizationalPlanner, createOrganizationalPlan()
- `src/office/events.ts` — Event bus for agents
- `src/office/memory.ts` — Organizational memory, awareness, skills

### API & Runtime
- `src/api-worker.ts` — Cloudflare Worker API (`/office/agents`, `/office/organization`, `/prototype/*`)
- `src/api.ts` — Express parity for local development
- `src/prototype/*` — Prototype Worker, Handoff, Preview Recovery

### Infrastructure
- Cloudflare Workers + PostgreSQL (Neon / pg)
- 9Router gateway (fallback chain OpenRouter → 9Router)
- Windows Task Scheduler — executes `pdl_supervisor.sh` every 5min
- Supervisor: atomic mkdir lock + trap cleanup + stale detection + Git guard + provider 429/520 detection + exponential cooldown (30/60/120min) + state machine

## Invariant Rules (from PDL_GOVERNANCE.md and DECISIONS.md)

1. **PDL first** — do not productize SaaS
2. **Mandatory typecheck** — `npx tsc --noEmit` must return EXIT_CODE=0 before any commit
3. **Authorized tests pass** — 41/41 (office-agent-registry, office-api, office-organization, correction-controller)
4. **No `as any` in production** — casts removed in 12.2B; SpecializedAgent maintained in squads.ts
5. **Clean git** — working tree clean, HEAD == origin/main, no force-push, no rebase/revert of main
6. **Atomic operations** — single commit per operation, conventional message
7. **Explicit handoff** — `.agent/` is operational source of truth; GITHUB = source of truth for code
8. **Real E2E validation** — do not mock, invent output, or assume success

## Architectural Decisions Recorded in DECISIONS.md

- Workforce = 59 agents (confirmed commits aa77bdd, fbc9e42)
- Types = AgentDepartment (15) + AgentRole (14) + AgentRoutingProfile (7)
- `as any` casts removed — FIFTY_SPECIALIZED_AGENTS: SpecializedAgent[]
- 10 specialized sectors with exact names from squads.ts
- 5 specialized roles: TECH_LEAD, FULLSTACK_DEV, PRODUCT_DESIGNER, QA_SECURITY, GROWTH_SALES
- getDepartments() returns 3 base departments by design (not omission)
- Windows Task Scheduler supervisor active (PUB-DEV-LOOP-Autonomous, 5min)

## External References
- `docs/PDL_GOVERNANCE.md` — internal-first rule
- `docs/ARCHITECTURE_DECISIONS.md` — technical decisions
- `docs/AGENT_HANDOFF.md` — Codex↔Hermes handoff procedure
- `docs/README_FOR_AGENTS.md` — agent guide

*This file should be updated when there is change to identity, mission, canonical architecture or invariant rules. Daily operational state goes in CURRENT_STATE.md.*
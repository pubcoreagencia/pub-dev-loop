# AGENTS.md — Operational Instructions for AI Agents in PDL

> **Target Audience:** Any AI Assistant (Antigravity, Codex, Claude Code, etc.), Developer, or Automated Engine Agent entering this repository.  
> **Human Operator:** MATHEUS  
> **Cardinal Principle:** Git repository state is the canonical, absolute operational source of truth.

---

## 1. Onboarding Protocol (What to do when entering a session)

When starting or resuming work in PDL, **DO NOT rely on session memory, chat context, or IDE scratchpads**. Follow this sequence:

1. **Read PDL_OPERATIONAL_STATE.md:** Review current phase, published baseline commit, proven capabilities, and next authorized actions.
2. **Consult Git Status & History:**
   `ash
   git status --short
   git log --oneline -15
   git rev-parse HEAD
   git rev-parse origin/main
   `
   Confirm local HEAD matches remote tracking and note any untracked or modified files.
3. **Inspect Phase Documentation & Evidence:** Review documents in docs/ and docs/evidence/ relevant to the active phase.
4. **Execute Verification Suites:**
   `ash
   npm run typecheck
   npm run build
   npx vitest run tests/pdl/
   `
   Confirm system stability before modifying any code.
5. **Acknowledge the Operator:** The human operator is **MATHEUS**. Always address or refer to the operator as **MATHEUS**.

---

## 2. Absolute Architectural Boundaries & Invariants

All agents must strictly preserve the following non-negotiable rules:

* **RULE 1: FREE MODELS ONLY.**  
  PDL must strictly utilize zero-cost AI model tiers (Groq free tier, OpenRouter free tier, HuggingFace free, Gemini free). Never configure paid API keys, paid credits, or credit card dependencies in automated paths. If 429 quota limits are hit, fail closed and back off.
* **RULE 2: Fail-Closed Autonomous Governance.**  
  Any policy violation, database error, schema mismatch, or ambiguous instruction must immediately halt execution (FAILED / REJECTED). Never guess or bypass governance checks.
* **RULE 3: Product Isolation.**  
  PDL is a meta-engine. Product code (e.g. pub-rate-calculator, pub-servers, uzios-de-cima) belongs in separate git repositories / isolated paths under projects/. Never commit product code or product artifacts into the PDL engine repository.
* **RULE 4: PP Isolation.**  
  The Prototype Platform (PP) repository is completely isolated from PDL. Integration occurs strictly through defined intake contracts and repository interfaces.
* **RULE 5: Zero Secret Commitments.**  
  Never stage or commit .env, .env.*, API tokens, private keys, or passwords. All secrets belong strictly in .gitignore.
* **RULE 6: Non-Destructive Git Hygiene.**  
  Never run git reset --hard, git clean, git restore ., or force checkout. Preserve local work.
* **RULE 7: Fast-Forward Push Only.**  
  Never use --force or --force-with-lease. If remote diverged, stop and report.
* **RULE 8: Explicit Authorization Required.**  
  Never advance across phase boundaries (e.g. Phase 5.5 Step 5 / Campaign, SaaS, Level 5 autonomy) without explicit written authorization from **MATHEUS**.

---

## 3. Workflow for Code Changes & Testing

1. **Audit Working Tree:** Check git status --short before touching files.
2. **Implement Minimal Scoped Changes:** Write clean, typed TypeScript adhering to existing architecture.
3. **Run Verification:** Always run 
pm run typecheck, 
pm run build, and vitest test suites.
4. **Author/Update Evidence:** Document implementation rationale and test results in docs/evidence/ or docs/operations/.
5. **Stage Explicitly:** Stage specific files only (git add path/to/file). Never use blanket git add . or git add -A.
6. **Commit with Conventional Commits:** Use clear structured commit messages detailing exact additions and fixes.
7. **Perform Remote SHA Verification:** Ensure HEAD == origin/main == git ls-remote origin refs/heads/main.

---

## 4. Emergency & Troubleshooting

* **Kill Switch:** Set PDL_KILL_SWITCH=true in .env or set pdl.kill_switch_enabled = true in PostgreSQL to immediately halt schedulers and workers.
* **Stale Leases:** The Periodic Reaper automatically reclaims expired leases. For manual inspection, query 	asks where lease_deadline < NOW().
* **Dead-Letter Queue:** Investigate quarantined tasks in table 	ask_dlq.

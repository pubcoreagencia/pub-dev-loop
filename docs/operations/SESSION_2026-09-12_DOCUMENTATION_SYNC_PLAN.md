# PDL Documentation Sync Plan

- Baseline: `59eef2f06b89e670fce218c39870452650d2e1c8`
- Scope: synchronize `PDL_OPERATIONAL_STATE.md` and `AGENTS.md` with implementation evidence at the baseline commit.
- Explicitly out of scope: Phase 5.5 Step 5, Step 6, Campaign orchestration, PP changes, product changes, and provider-policy changes.
- Rule: do not infer behavior from historical documents when current code or migrations provide stronger evidence.
- Known corrections: scheduler lives under `src/pdl/scheduler/`; retry under `src/pdl/retry/`; DLQ table is `pdl_dead_letters`; reaper lives under `src/pdl/reaper/`; FREE MODELS ONLY means verified 0/0 pricing, not a provider-name assumption.
- Verification limitation: repository documentation was synchronized from GitHub source evidence. Local typecheck/build/test execution requires the repository runtime and is not represented by this documentation-only checkpoint.

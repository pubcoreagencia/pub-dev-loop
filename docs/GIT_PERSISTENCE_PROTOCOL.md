# Git Persistence Protocol — PUB DEV LOOP

**Status:** CANONICAL / ACTIVE
**Owner:** MATHEUS
**Purpose:** Prevent loss of engineering context, fixes, features, incident remediations, and operational decisions between agent sessions.

## 1. Core Rule

**If it matters, it must exist in Git.**

A meaningful change is not complete merely because it exists in a local workspace, IDE, agent session, chat, temporary clone, database, deployment, or runtime.

The canonical persistence chain is:

`IMPLEMENT → VALIDATE → CAPTURE EVIDENCE → COMMIT → PUSH → VERIFY REMOTE → VERIFY RUNTIME (when applicable) → HAND OFF`

## 2. What Requires Immediate Persistence

The rule applies after every meaningful:

- milestone;
- feature;
- fix;
- security remediation;
- architecture change;
- governance change;
- configuration change;
- production correction;
- incident investigation or resolution;
- test/validation improvement;
- migration/schema change;
- operational decision;
- documentation/context update required for continuity;
- phase completion or phase gate.

Do **not** wait for the end of the day, end of a session, or completion of a larger feature before persisting important work.

## 3. Required Procedure

### Step A — Validate

Run the smallest meaningful verification for the change. For code, this normally includes applicable tests, typecheck, build, lint, or runtime verification.

### Step B — Capture Evidence

Record material evidence in versioned Git artifacts when it is needed to reconstruct the decision later. Examples:

- test result;
- production verification;
- incident timeline;
- deployment identifier;
- architectural decision;
- migration result;
- security finding;
- known limitation or blocked state.

### Step C — Commit

Create a precise conventional commit containing only the intended change.

Never leave a meaningful milestone only in an uncommitted working tree.

### Step D — Push

Push the commit immediately to the canonical remote branch using normal fast-forward semantics.

A local commit is **not** sufficient persistence.

### Step E — Verify Remote

Confirm that the intended commit is reachable from the intended remote branch/ref and that no unexpected divergence exists.

### Step F — Verify Runtime When Applicable

If the change affects production, infrastructure, automation, scheduled execution, workers, deployments, or security controls, verify the **active runtime**, not merely the source tree or deployment command output.

This is mandatory because a correct Git change can coexist temporarily with an older active deployment.

### Step G — Handoff

Leave enough evidence in Git for another agent to reconstruct:

`WHAT changed → WHY → EVIDENCE → CURRENT STATE → NEXT STEP`

## 4. Definition of Done

A meaningful task is **DONE** only when all applicable conditions are true:

- implementation is validated;
- evidence is captured;
- commit exists;
- commit is pushed;
- remote ref is verified;
- production/runtime is verified when applicable;
- continuity context is versioned.

If commit or push fails, the task status is **INCOMPLETE**, even when the implementation itself works.

## 5. Incident-Learned Rule: Source ≠ Production

The Phase 5.5 legacy autonomous-writer incident demonstrated a critical operational distinction:

> **A security fix in Git is not a production fix until the active runtime/deployment is verified.**

The hard-stop code existed in Git before the old Cloudflare deployment had actually been replaced. The old runtime therefore remained capable of autonomous mutation until the active deployment was verified and the autonomous routes were confirmed blocked.

Future incident fixes affecting runtime MUST include both:

1. Git/source verification; and
2. active runtime verification.

## 6. Anti-Loss Invariant

The following state is forbidden at handoff:

`IMPORTANT CHANGE + NO REMOTE COMMIT`

The following state is also forbidden for production-affecting changes:

`SECURITY FIX IN GIT + ACTIVE RUNTIME UNKNOWN`

The agent must stop, persist evidence, and resolve the missing persistence/verification step before declaring completion.

## 7. Git as Institutional Memory

Git/GitHub is the durable institutional memory for PDL.

Chat history, model context, IDE state, local scratchpads, temporary workspaces, and deployment logs are supporting inputs. They are not canonical continuity.

If a future PUB Neural agent must know it, the fact must be recoverable from Git.

## 8. PUB Neural Extraction Contract

PUB Neural may reconstruct PDL state from:

1. current source;
2. Git commit history;
3. versioned evidence documents;
4. tests and validation artifacts;
5. explicit operational context;
6. current runtime evidence when documented.

The objective is that a new agent can enter a fresh session and recover the relevant state without depending on the previous chat.

## 9. Mandatory Session Closure

Before ending a meaningful work session, perform:

```text
STATUS
→ DIFF
→ TEST/VALIDATE
→ EVIDENCE
→ COMMIT
→ PUSH
→ REMOTE VERIFY
→ RUNTIME VERIFY (if applicable)
→ HANDOFF
```

A session must not be considered closed while meaningful changes remain only local.

## 10. Canonical Operational Mantra

**AG executa. PDL governa. Git registra a verdade.**

And for persistence:

**Fez algo importante? Commit. Commitou? Push. Pushou? Verifique. Mudou produção? Verifique o runtime.**

# PDL Execution Governance V1

**Workstream:** P1.2  
**Status:** IMPLEMENTATION CANDIDATE  
**Contract:** `pdl-execution-governance-v1`

## Purpose

P1.2 adds a governance boundary around the existing PDL execution runtime.

It does **not** create a second executor. The existing `PdlGovernanceEngine`,
execution engine, workspace controls, provider, correction loop, finalizer,
and persistence gates remain authoritative.

## Contract

`Pre-authorization → existing policy gate → existing execution → post-execution evidence`

### Pre-authorization

Every execution request must declare:

- governance contract version;
- task identity;
- governance gate and action;
- requested capabilities;
- explicitly granted capabilities;
- optional scoped approval;
- bounded delegation parameters when delegation is requested.

Unknown capabilities, version mismatches, malformed requests, missing grants,
invalid approvals, and invalid delegation bounds fail closed.

### Capability boundary

Capabilities are explicit and typed:

- `WORKSPACE_READ`
- `WORKSPACE_WRITE`
- `COMMAND_EXECUTION`
- `GIT_WRITE`
- `REMOTE_PERSISTENCE`
- `CREDENTIAL_ACCESS`
- `SUBAGENT_DELEGATION`

Raw credentials are outside the contract. Governance authorizes capability use,
not secret disclosure.

### Approval boundary

Credential access and subagent delegation require a scoped, time-bounded
approval record. Approval scope must contain every sensitive capability requested.

### Delegation boundary

Subagent delegation is bounded by:

- maximum depth: 1..3
- maximum children: 1..8
- requested depth/children cannot exceed the declared maximums
- delegation requires the explicit `SUBAGENT_DELEGATION` capability

This contract does not implement a subagent runtime.

### Hooks and evidence

A pre-hook receives the authorization decision and may veto by failing.
A post-hook receives a structured execution event and evidence metadata.

The governance evidence contract deliberately excludes credentials, tokens,
raw prompts, and command output.

## Fail-closed invariants

1. Governance version mismatch blocks execution.
2. Unknown or ungranted capabilities block execution.
3. Missing/expired/mismatched approval blocks sensitive capabilities.
4. Invalid delegation bounds block delegation.
5. Existing PDL policy denial blocks execution.
6. Pre-hook failure blocks execution.
7. Governance is authorization and audit, not execution.

## Non-goals

- replacing `PdlGovernanceEngine`;
- replacing `PdlCorrectionWorker`;
- replacing `DefaultExecutionEngine`;
- creating a new agent runtime;
- implementing an interactive approval UI;
- implementing a subagent runtime;
- making PUB Neural an execution dependency.

## Validation gate

Before adoption, this contract requires:

1. unit tests;
2. typecheck/build;
3. CI;
4. integration with the real runtime path;
5. real evidence showing pre-authorization and post-execution events;
6. remote verification;
7. PUB Neural institutionalization only after real E2E proof.

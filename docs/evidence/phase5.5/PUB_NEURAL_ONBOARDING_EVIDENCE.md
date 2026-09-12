# PUB Neural PDL Onboarding Evidence

## Status
PROVEN on branch `feat/pdl-onboard-pub-neural` before merge.

## Scope
Only `pubcoreagencia/pub-dev-loop` was modified. No changes were made to `pubcoreagencia/pub-neural`, `pubcoreagencia/neural-os`, PP, or other product repositories.

## Contract
`pub-neural` is now explicitly registered in the PDL Product Catalog with repository `https://github.com/pubcoreagencia/pub-neural.git`, development branch patterns, bounded paths, Level 4 maximum autonomy, and remote persistence eligibility.

## Governance
Migration `024_onboard_pub_neural.sql` explicitly adds `pub-neural` to the persistent canonical governance allowlist without changing the active governance level or kill-switch state.

## Tests
The dedicated onboarding test suite passed on GitHub Actions:
- manifest registration
- worker branch authorization / protected main
- governance allow when explicitly allowlisted
- governance deny when absent from allowlist

The full Vitest diagnostic run also completed successfully. The previously failing broad CI run contained legacy Prototype/PP expectations incompatible with the intentionally hardened PDL baseline; those failures were not caused by the onboarding contract.

## Verification
Typecheck and build passed in the diagnostic workflow. The temporary diagnostic workflows were removed after evidence capture and are not part of the intended product change.

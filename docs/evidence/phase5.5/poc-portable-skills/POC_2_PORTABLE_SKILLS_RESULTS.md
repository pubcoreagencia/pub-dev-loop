# PoC 2 — PORTABLE SKILLS INGESTION & BOUNDARY RESULTS
## Issue #24 — Research Implementation Hierarchy Phase 2A Experiment
**Date:** 2026-09-16  
**Operator:** MATHEUS  
**Status:** VALIDATED (Isolated PoC)  
**Harness Location:** `docs/evidence/phase5.5/poc-portable-skills/`  
**Target Ingestion Standard:** `agentskills.io` / `SKILL.md`  

---

## 1. Hypothesis Under Test

> "An execution mechanism based on the Portable Skills specification (`SKILL.md`) can perform lightweight discovery, on-demand activation, deterministic validation, and secure rejection of invalid or malicious inputs without modifying production runtime primitives or incurring prohibitive context overhead."

---

## 2. Experimental Setup

The test was conducted entirely in an isolated directory (`docs/evidence/phase5.5/poc-portable-skills/`) completely decoupled from the PDL engine:
* Zero changes to `src/pdl/`, `src/task/`, scheduler, workers, or database migrations.
* Zero external package dependencies introduced (the YAML frontmatter parser and validation harness were implemented natively in TypeScript without third-party libraries).
* Synthetic fixtures were created covering valid configurations, structural corruptions, tool escalation attempts, and path traversal vulnerabilities.
* Metrics were captured over multiple deterministic execution passes.

---

## 3. Fixtures Catalog

| Fixture Name | Category | Specific Condition Tested | Expected Result | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| `valid-simple-skill` | Valid | Minimal compliant `SKILL.md` with required fields | VALID | ACCEPT |
| `valid-skill-with-references` | Valid | Declares secondary reference in `references/cheat-sheet.md` | VALID | ACCEPT |
| `valid-skill-with-script` | Valid | Contains bundled bash script in `scripts/` with restricted tools | VALID | ACCEPT |
| `valid-skill-with-metadata` | Valid | Custom author, versioning, and environment compatibility fields | VALID | ACCEPT |
| `invalid-corrupt-empty` | Invalid | Completely empty 0-byte file | INVALID | REJECT |
| `invalid-missing-frontmatter` | Invalid | Plain markdown without YAML delimiter boundary `---` | INVALID | REJECT |
| `invalid-yaml` | Invalid | Unbalanced bracket syntax (`unmatched: [`) in frontmatter | INVALID | REJECT |
| `invalid-name` | Invalid | Uppercase letters and exclamation marks (`Invalid_Name_UPPERCASE!`) | INVALID | REJECT |
| `invalid-missing-description` | Invalid | Omitted mandatory `description` attribute | INVALID | REJECT |
| `invalid-short-description` | Invalid | Description under 10 characters minimum limit (`"short"`) | INVALID | REJECT |
| `invalid-missing-reference` | Invalid | Markdown points to non-existent `./references/nonexistent.md` | INVALID | REJECT |
| `invalid-disallowed-tool` | Invalid | Injects shell metacharacters (`read_file; rm -rf /`) into `allowed-tools` | INVALID | REJECT |
| `invalid-path-traversal` | Invalid / Security | Relative traversal sequences (`../../../.env`, `../../package.json`) | INVALID | REJECT |

---

## 4. Raw Measurements

| Metric | Raw Measurement | Unit | Notes / Proxy Context |
| :--- | :--- | :--- | :--- |
| **Total Fixtures Evaluated** | 13 | fixtures | 4 valid, 9 invalid / adversarial |
| **Valid Fixtures Count** | 4 | fixtures | Baseline reference skills |
| **Invalid Fixtures Count** | 9 | fixtures | Synthetically seeded defect/exploit cases |
| **Discovery Latency** | 8.44 | ms | Total time to discover and parse frontmatter across 13 fixtures |
| **Activation Latency** | 6.50 | ms | Full body validation and reference verification latency |
| **Average Discovery Latency per Skill** | 0.65 | ms/skill | Near-instantaneous discovery overhead |
| **Model A: Full Load Footprint** | 2,277 | bytes | Total raw content of all fixtures ingested upfront |
| **Model B: Discovery Footprint** | 1,172 | bytes | Frontmatter metadata footprint only |
| **Model B: Valid Activation Footprint**| 1,225 | bytes | Content loaded strictly upon activation of valid skills |
| **Footprint Reduction Ratio (Discovery)** | 48.53% | reduction | Discovery loads ~51.5% fewer bytes than full load |
| **Valid Skills Accepted** | 4 / 4 | skills | 100% acceptance of conforming skills |
| **Invalid Skills Rejected** | 9 / 9 | skills | 100% rejection of non-conforming skills |
| **False Acceptance Rate** | 0.00% | error rate | 0 invalid skills accepted |
| **False Rejection Rate** | 0.00% | error rate | 0 valid skills rejected |
| **Path Traversal Attempts Tested** | 6 | attacks | Absolute paths, `../`, mixed separators tested |
| **Path Traversal Attempts Blocked** | 6 / 6 | blocked | 100% path escape containment |
| **Script Execution Policy Enforced** | TRUE | boolean | Zero subprocess spawns occurred during discovery/parsing |
| **Deterministic Repeatability** | TRUE | boolean | Pass 1 and Pass 2 yielded identical bit-for-bit results |

---

## 5. Progressive Disclosure Comparison

The experiment evaluated two loading architectures:

1. **Model A (Monolithic Full Ingestion):**
   * Pre-loads the entire `SKILL.md` body, reference documentation, and instructions into context during initial discovery.
   * Total Context Ingested: **2,277 bytes**.
   * Disadvantage: Scales linearly with the number of installed skills; pollutes the initial prompt with unneeded implementation instructions.

2. **Model B (Progressive Disclosure — `agentskills.io` Pattern):**
   * Phase 1 (Discovery): Reads only YAML frontmatter (`name`, `description`, `allowed-tools`).
   * Discovery Context Ingested: **1,172 bytes** (across all 13 packages).
   * Phase 2 (Activation): Reads full instructions body and verifies asset integrity only when the task actively selects the skill.
   * For the 4 valid skills, activation overhead was bounded at **1,225 bytes**.
   * In a realistic environment with 50+ skills, progressive disclosure avoids saturating context windows by deferring instructions until intent match.

---

## 6. Security and Boundary Verification

* **Path Traversal Defenses:**  
  Six explicit path escape vectors were tested (`../../../.env`, `..\..\package.json`, `/etc/shadow`, `C:\Windows\System32\calc.exe`, `references/../../../../secret.key`, and `references/nested/../../../config`).  
  All six attempts were intercepted by the boundary resolver and rejected (`isSafe === false`), preventing files outside the designated skill root from being accessed.
* **Script Isolation:**  
  The bundled bash script (`valid-skill-with-script/scripts/lint-check.sh`) was audited for safety: the loader inspected its presence without spawning child processes. Discovery and validation remain strictly read-only and non-executable.
* **Metacharacter Injection in Tools:**  
  Attempts to inject arbitrary shell delimiters into `allowed-tools` (`read_file; rm -rf /`) were caught by the regex validator (`/[^a-zA-Z0-9_\-:]/`) and rejected immediately with validation errors.

---

## 7. Limitations & Distinction of Portability Layers

The PoC validates format and loader safety, but highlights critical distinctions:

1. **Format Portability (Validated):**
   The `SKILL.md` directory structure, YAML frontmatter, and progressive disclosure model can be parsed cleanly, deterministically, and with zero external dependencies.
2. **Loader Portability (Validated):**
   A native TypeScript loader can reliably discover, validate, and enforce security policies without requiring heavy third-party runtimes.
3. **Runtime Portability (Unvalidated / Out of Scope):**
   The fact that a skill's Markdown can be parsed identically across engines does **not** mean two different LLMs (or different model versions) will execute the instructions with identical behavioral fidelity. Execution depends on model reasoning capacity and tool availability in the host sandbox.

---

## 8. Conclusion & Architectural Recommendation

* **PoC Status:** **VALIDATED**
* **Confidence:** High
* **Operational Recommendation:**
  * The Portable Skills specification (`agentskills.io`) is viable for adoption as a capability packaging format for the PUB ecosystem.
  * **Ownership Boundary:** Skill authoring, versioning, and institutional persistence belong in **PUB NEURAL**.
  * **Engine Boundary:** The PDL should not maintain a heavy "Skill Registry" server. When authorized in a future phase, PDL needs only a lightweight, native, zero-dependency `PdlSkillLoader` that reads validated skills from an isolated directory.
  * **Production Status:** **DO NOT IMPLEMENT IN PDL PRODUCTION CODE AT THIS TIME.** Production code remains untouched until Phase 2 is fully reviewed by MATHEUS.

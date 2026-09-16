# PROMPT PROTOCOL SPECIFICATION (PHASE 2B-R2)

## 1. System Prompt (Strictly Identical in Both Groups)
```text
You are a software engineer reviewing an implementation before submission.
```

## 2. Review Checklist (Strictly Identical in Both Groups)
```text
REVIEW CHECKLIST:
1. Contract adherence: Verify return types, preserved interfaces, and field preservation.
2. Boundary conditions: Check 0-indexing vs 1-indexing, inclusive vs exclusive slice limits, and count thresholds.
3. Null/undefined/error handling: Verify safe handling of absent inputs and appropriate error propagation.
4. Existing behavior/regression: Ensure existing invariants and filters are not accidentally removed or weakened.
5. Security/input boundaries: Check for path traversal, unauthorized directory escapes, and unvalidated arguments.
```

## 3. Output Schema (Strictly Identical in Both Groups)
```text
Respond ONLY with valid JSON conforming strictly to this structure:
{
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION",
      "location": "file:line",
      "finding": "concise description of issue",
      "rationale": "why this is an issue",
      "recommendation": "how to fix"
    }
  ],
  "overall_verdict": "PASS" | "CHANGES_REQUESTED"
}
```

## 4. User Prompt Framing

### Control Group (Context Retention)
```text
TASK SPECIFICATION:
{task.specification}

RELEVANT REPOSITORY CONTEXT:
{task.contextCode}

IMPLEMENTATION DIFF:
{task.implementationPatch}

AUTHOR CONTEXT (PRIOR SESSION LOG):
Task intake processed at session start. Author reviewed project architecture, inspected target file, drafted unit specifications, and completed initial implementation pass against constraints. No operational tool errors recorded.

{REVIEW_CHECKLIST}

Review the implementation against the specification and identify defects.
{OUTPUT_SCHEMA}
```

### Experiment Group (Context Isolation)
```text
TASK SPECIFICATION:
{task.specification}

RELEVANT REPOSITORY CONTEXT:
{task.contextCode}

IMPLEMENTATION DIFF:
{task.implementationPatch}

{REVIEW_CHECKLIST}

Review the implementation against the specification and identify defects.
{OUTPUT_SCHEMA}
```

## 5. Sole Experimental Difference
The ONLY string present in Control that is absent in Experiment is the neutral `AUTHOR CONTEXT (PRIOR SESSION LOG)`.
No biased phrases ("everything is clean", "I implemented this correctly") are present in either prompt.

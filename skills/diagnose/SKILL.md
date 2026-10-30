---
name: diagnose
description: "Investigate a bug or unexpected behavior by systematically narrowing the root cause through hypothesis testing, log analysis, and bisection."
rules: [0, 1, 5, 6, 10, 17]
---

# Diagnose Workflow

```
/diagnose <symptom-description> [--error <error-message>] [--file <path>] [--since <commit-or-date>]
```

**Directory name**: Auto-generate `<symptom>` from the description in kebab-case, max 40 chars (e.g., `null-crash-on-login` or `stale-cache-after-update`).

Systematic bug investigation. Not a fix workflow — this FINDS the root cause and documents it. Use `/hotfix` or `/new-feature` to fix.

**Phases**: REPRODUCE → HYPOTHESIZE → NARROW → ROOT-CAUSE

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<symptom>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: REPRODUCE

**Goal**: Confirm the bug exists and establish a reliable reproduction.

1. Parse symptom description and any `--error` message
2. If `--file` given, read it. Otherwise, search codebase for error message or related code.
3. If `--since` given, run `git log --oneline <since>..HEAD -- <suspected-files>` to find relevant changes
4. Attempt to reproduce:
   - Run relevant test that should trigger the bug
   - If no test exists, describe manual reproduction steps
5. Document: symptom, reproduction steps, frequency (always/intermittent), affected scope

**Gate**: If bug cannot be reproduced, ask user for more context. Do NOT proceed to hypothesize without a confirmed symptom.

**>> Phase complete** — write output to `.workflows/<symptom>/01-reproduce.md`

---

## Phase 2: HYPOTHESIZE

**Goal**: Generate ranked list of possible causes.

1. Read the error/symptom context
2. Read the relevant code paths (follow the execution from entry point to failure)
3. Generate 3-5 hypotheses ranked by likelihood:
   ```
   H1 (most likely): <description> — Evidence: <what supports this>
   H2: <description> — Evidence: <what supports this>
   ...
   ```
4. For each hypothesis, identify the **single test** that would confirm or eliminate it

Ask user: "These are my top hypotheses. Any you'd rule out or add based on your knowledge?"

**>> Phase complete** — write output to `.workflows/<symptom>/02-hypothesize.md`

---

## Phase 3: NARROW

**Goal**: Eliminate hypotheses one by one until root cause is found.

For each hypothesis (highest likelihood first):

1. **Test it**: Run the identified test, read a specific log, check a specific value, or use `git bisect` if `--since` was provided
2. **Result**: CONFIRMED (stop, go to Phase 4) or ELIMINATED (try next)
3. **Record**: `H<N>: ELIMINATED — <what the test showed>`

**Git bisect approach** (when `--since` provided):
```bash
git bisect start HEAD <since-commit>
# For each bisect step: run the reproduction test
git bisect good/bad
# Until the first bad commit is found
git bisect reset
```

If all hypotheses eliminated: generate new ones based on what was learned. Max 2 rounds.

**>> Phase complete** — write output to `.workflows/<symptom>/03-narrow.md`

---

## Phase 4: ROOT-CAUSE

**Goal**: Document the confirmed root cause with enough detail to fix it.

```
Root Cause Analysis
===================
Symptom:     <what the user sees>
Root cause:  <exact code/condition causing it>
Location:    <file:line>
Introduced:  <commit hash if found, or "pre-existing">
Why:         <why this code is wrong / what changed>
Blast radius: <other code paths affected by same issue>
Fix approach: <1-2 sentence suggestion, NOT the implementation>
```

Ask: "Root cause confirmed. Want to fix it now? Suggest: `/hotfix <description>` for urgent fixes or `/new-feature` if it needs design work."

**>> Phase complete** — write output to `.workflows/<symptom>/04-root-cause.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| Cannot reproduce | Ask for more details, check environment differences |
| All hypotheses eliminated | Re-examine assumptions, ask user for new angles |
| Intermittent bug | Look for race conditions, timing, state-dependent paths |
| Bug in third-party code | Document and suggest workaround or version pin |

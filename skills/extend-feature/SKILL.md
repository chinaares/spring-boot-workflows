---
name: extend-feature
description: Extend an existing feature with new capabilities while preserving backward compatibility, using minimal-impact rules and structured brainstorming.
rules: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17]
---

# Extend Feature Workflow

```
/extend-feature <feature-name> <extension-description> [--skip-brainstorm] [--auto]
```

Add new capabilities to an existing feature while strictly preserving backward compatibility. Seven phases: **ANALYZE → BRAINSTORM → PLAN → IMPLEMENT → VERIFY-COMPAT → TEST → PR**.

**Auto mode**: `--auto` skips all approval gates (brainstorm decisions, plan approval). Uses the recommended option at each decision point.

## Core Principle: Minimal Impact

1. Prefer new files over modifying existing ones
2. Prefer additions over changes to existing code
3. Add new public interfaces — do not change existing signatures
4. Add new test files — do not modify existing test assertions
5. If you must modify an existing file, change the fewest lines possible

---

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<feature>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases unless config allows. NEVER stop after implementation — continue ALL remaining phases.**

---

## Phase 1: ANALYZE

Map the feature: entry points, business logic, data layer, config/wiring, existing tests. Identify extension points (new subtypes, new fields with defaults, callable public functions, registration mechanisms). Document current behavior.

**>> Phase complete** — write output to `.workflows/<feature>/01-analyze.md`

---

## Phase 2: BRAINSTORM

**Skip if**: `--skip-brainstorm` OR `workflows.extend-feature.require_brainstorm` is `false`. Mark `SKIPPED`, proceed to Phase 3.

Run brainstorm inline (Rule 9): Constraint Mapping (implicit constraint: minimal impact) → Generate Options → SCAMPER technique → Trade-off Matrix (score on modified-files count + standard criteria) → Recommend top 2.

**>> Phase complete** — write output to `.workflows/<feature>/02-brainstorm.md`

---

## Phase 3: PLAN

Write plan to `.workflows/<feature>/plan.md`: architecture summary, chosen approach, compatibility guarantees (no signatures/variants/assertions/behavior changed), new vs modified files, implementation phases with build/test commands and commit messages, rollback strategy.

**Verify**: Modified files ≤ new files. No signature changes.

Present plan. Ask: "Approve plan or request changes?"

**>> Phase complete** — write output to `.workflows/<feature>/03-plan.md`

---

## Phase 4: IMPLEMENT

Per phase: read plan → implement (new files first, modifications last) → build → test → commit. Apply `<plugin-root>/rules/` (Rule 3).

**REPLAN trigger**: More changes than planned, signature must change, or abstraction needs restructuring.

**>> Phase complete** — write output to `.workflows/<feature>/04-implement.md`

**>> CONTINUE** — implementation is NOT the end. Proceed to VERIFY-COMPAT, then TEST, then PR. Update state and continue.

---

## Phase 5: VERIFY-COMPAT

1. **Run full test suite** — every existing test MUST pass
2. **Behavioral comparison** — verify behaviors from Phase 1 work identically
3. **API/interface check** — all public signatures unchanged, new fields have defaults, all variants still exist

If any test fails: fix the NEW code (not the existing test).

**>> Phase complete** — write output to `.workflows/<feature>/05-verify-compat.md`

---

## Phase 6: TEST

**Skip if**: `workflows.extend-feature.require_tests` is `false`.

Create NEW test files (do not modify existing) covering: new functions/logic, integration with existing feature, edge cases. Target: `workflows.test.default_coverage` from config (default 90%) for new code.

**>> Phase complete** — write output to `.workflows/<feature>/06-test.md`

**>> CONTINUE** — testing is NOT the end. Proceed to PR phase. Update state and continue.

---

## Phase 7: PR

**Quality gate** (Rule 3): proportional review. Fix Critical/High violations.

Push and create PR with: summary, changes (new vs modified files), compatibility results, test results.

**>> Phase complete** — write output to `.workflows/<feature>/07-pr.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| Feature not found | Ask user for correct name or path |
| Feature too complex (>20 files) | Consider splitting into multiple extensions |
| Extension requires breaking changes | Present alternatives; document migration if unavoidable |
| Existing tests fail | Fix new code, not existing tests |

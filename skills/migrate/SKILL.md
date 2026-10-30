---
name: migrate
description: Plan and execute incremental migrations for dependencies, APIs, architecture, and databases.
rules: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17]
---

# Migration Workflow

`/migrate <type> [--skip-brainstorm] [--auto]`

Where `<type>` is one of: `dependency`, `api-version`, `architecture`, `database`

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<type>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases unless config allows. NEVER stop after execution — continue ALL remaining phases.**

---

## Phase 1: ANALYZE

Document current state before any changes.

1. Identify all files and modules affected
2. Document current versions, patterns, or schemas
3. Create snapshot summary

**Type-specific analysis:**

| Type | What to Document |
|------|-----------------|
| `dependency` | Current/target version, breaking changes from changelog, all usage sites |
| `api-version` | Current/target API version, deprecated endpoints, changed shapes |
| `architecture` | Current pattern, target pattern, boundary identification |
| `database` | Current schema, target schema, data volume estimates |

**>> Phase complete** — write output to `.workflows/<type>/01-analyze.md`

## Phase 2: BRAINSTORM

**Skip if**: `--skip-brainstorm` OR `workflows.migrate.require_brainstorm` is `false`.

Inline brainstorm (Rule 9): constraints → evaluate strategies (big bang, incremental, parallel run, strangler fig) → score risks → recommend.

**>> Phase complete** — write output to `.workflows/<type>/02-brainstorm.md`

## Phase 3: PLAN

Create incremental plan where each step is independently safe. Every step MUST compile and pass tests. Order by risk (non-breaking first). Include rollback per step.

Write plan to `.workflows/<type>/plan.md` (this standalone file is the executable plan, referenced by EXECUTE and resume. The phase output `03-plan.md` captures the planning summary and approval).

**>> Phase complete** — write output to `.workflows/<type>/03-plan.md`

## Phase 4: EXECUTE

Per step: apply changes → compile → test → fix if needed (max 3, then STOP) → commit → report. Read `<plugin-root>/rules/` before starting.

**>> Phase complete** — write output to `.workflows/<type>/04-execute.md`

**>> CONTINUE** — execution is NOT the end. Proceed to VERIFY, then PR. Update state and continue.

## Phase 5: VERIFY

Full test suite + full build + manual verification checklist + check for leftover TODOs/deprecated refs + linters.

**>> Phase complete** — write output to `.workflows/<type>/05-verify.md`

## Phase 6: PR

**Quality gate** (Rule 3): proportional review.

PR body: summary, migration details (before/after table), steps applied, rollback plan, testing, breaking changes.

**>> Phase complete** — write output to `.workflows/<type>/06-pr.md`

---

## Type-Specific Guidance

### dependency
- Read migration guide/changelog first
- Search for all imports and API usage
- Check transitive dependency conflicts
- Update lock files

### api-version
- Implement new client alongside old (parallel run)
- Add feature flag to toggle
- Keep old client until new is stable

### architecture
- Strangler Fig: wrap old, route new calls through new pattern
- One module at a time
- Add integration tests at boundary first

### database
- Reversible migrations (up + down)
- Add new columns first, migrate data, then remove old
- Test with realistic data volumes
- Back up before destructive migrations

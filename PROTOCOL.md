# Workflow Execution Protocol

> This protocol is auto-injected at session start. Follow it for EVERY `/spring-boot-workflows:*` workflow skill.

## State Initialization — Before Phase 1

1. Convert the feature/task name to **kebab-case** (max 40 chars, ASCII-only, lowercase)
2. `mkdir -p .workflows/<name>`
3. Write `.workflows/current-state.md`:

```yaml
---
workflow: <skill-name>
feature: <name>
phase: <first-phase>
phases: [<PHASE-1>, <PHASE-2>, ..., <PHASE-N>]
started: <ISO-8601>
updated: <ISO-8601>
branch:
output_dir: .workflows/<name>/
replan_count: 0
---
```

Then add these sections:

```markdown
## Phase History
| Phase | Status | Output | Notes |
|-------|--------|--------|-------|
| <first-phase> | ACTIVE | | Starting workflow |

## Context
_Key decisions and resume context:_

## Constraints
_Hard and soft requirements:_
```

4. **Verify** the file exists before proceeding to Phase 1.

## Phase Output — After EVERY Phase

Do **BOTH** before moving to the next phase:

1. **Write output file** to the path in each phase's `>> Write output to` line:
   ```
   # <Phase> — <Feature>
   ## Summary
   <1-3 sentences>
   ## Details
   <phase-specific content>
   ## Next Phase Input
   <what the next phase needs>
   ```

2. **Update state file** `.workflows/current-state.md`:
   - Set `phase` to the next phase, `updated` to now
   - Mark completed phase as `COMPLETED` with output filename in Phase History
   - Add new `ACTIVE` row for the next phase
   - Append key decisions to `## Context` (max ~20 bullets — this is the primary resume artifact)
   - Update `## Constraints` if new hard/soft requirements emerged

**Do NOT proceed to the next phase until both files are written.**

## Progress Display

After each phase transition, print:
```
Progress: ✓GATHER ✓SPEC ▶BRAINSTORM ·PLAN ·IMPLEMENT ·TEST ·PR
```
Legend: ✓=completed, ▶=active, ○=skipped, ·=pending

## Phase Skip Rules

Read `.workflows/config.yml` (fall back to `<plugin-root>/config/defaults.yml`):
- `require_brainstorm: false` OR `--skip-brainstorm` flag → skip BRAINSTORM phase
- `require_tests: false` → skip TEST phase
- `require_spec: false` → skip SPEC phase

When skipping: mark `SKIPPED` in state, no output file, proceed to next phase.

**NEVER skip a phase unless the skill explicitly says "Skip if" for that phase.**

## Mandatory Rules

- **NEVER jump to implementation** — execute phases in declared order
- **NEVER stop after implementation** — IMPLEMENT/FIX/EXECUTE is NOT the last phase. After writing code, you MUST continue to the remaining phases (TEST, VERIFY, PR, etc.). The workflow is only complete when ALL phases are done.
- **NEVER proceed** until output file AND state update are both written
- **NEVER skip phases** unless config/flags explicitly allow it
- If build fails 3+ times in one phase: STOP, document failure, ask user to approve adjusted plan
- If user says "pause": write partial output, update state, rename to `.workflows/paused-<name>.md`

## Config & Path Resolution

- **Project config**: `.workflows/config.yml` in the project root
- **Plugin defaults**: `<plugin-root>/config/defaults.yml`
- **Precedence**: CLI flags > project config > plugin defaults
- **Plugin root**: Determine from any skill's path by removing `/skills/<name>/SKILL.md`

## Active Workflow Check

If `.workflows/current-state.md` already exists for a DIFFERENT workflow/feature: ask user to pause or abandon it first. If it belongs to the SAME workflow, continue from the current phase.

Check `.workflows/paused-*.md` for paused workflows and mention them.

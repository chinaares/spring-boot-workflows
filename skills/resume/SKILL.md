---
name: resume
description: Resume a paused or interrupted workflow with full state validation and context recovery.
rules: [0, 1, 5, 6, 10, 17]
---

# Resume Workflow

## Step 1: Locate State Files

Search for resumable workflows:
1. **Active** (interrupted session): `.workflows/current-state.md`
2. **Paused**: `.workflows/paused-*.md`

If nothing found: "No active or paused workflows. Use `/start` to begin a new one."

## Step 2: Select Workflow

- **Only `current-state.md`** exists → resume it directly (interrupted session).
- **Argument provided** (e.g., `/resume booking-cancellation`) → find `.workflows/paused-booking-cancellation.md`.
- **Multiple paused** → list all with their `feature`, `workflow`, and `updated` timestamp. Ask user to pick.
- **Conflict** (active `current-state.md` + resuming a paused file) → offer to pause the active workflow first (Rule 6), then resume the selected one.

## Step 3: Parse and Validate State

Read the selected state file. Parse the **YAML frontmatter** to extract:
- `workflow`, `feature`, `phase`, `branch`, `output_dir`, `started`, `updated`, `replan_count`

Then run these integrity checks **before** resuming:

### 3a: Staleness Check
Compare `updated` timestamp to now. If **>7 days old**, warn:
> "This workflow was last active <N> days ago. Context may be stale."
> Options: (a) resume anyway, (b) restart from scratch, (c) abandon

### 3b: Branch Validation
If `branch` is set:
1. Run `git branch --list <branch>` — if empty, the branch was deleted.
   - Warn: "Branch `<branch>` no longer exists. Create it fresh or pick another?"
2. Check current branch with `git branch --show-current`.
   - If on a different branch: "You're on `<current>` but the workflow uses `<branch>`. Switch to it?"
   - If user confirms: `git checkout <branch>`

### 3c: Phase Output Validation
For each phase marked `COMPLETED` in the Phase History table:
- Check that the output file in the Output column exists under `.workflows/<feature>/`
- If missing: warn "Phase output `<file>` is missing — context for that phase is lost. Continuing without it."

### 3d: Workflow Skill Validation
Determine the plugin root from this skill's own path (remove `/skills/resume/SKILL.md`). Check that `<plugin-root>/skills/<workflow>/SKILL.md` exists.
- If missing: "The `<workflow>` skill no longer exists. Options: (a) abandon, (b) map to a different skill."

## Step 4: Activate the Workflow

If resuming a **paused** file:
1. If `current-state.md` already exists, confirm it should be paused first (Step 2 conflict handling).
2. Rename `.workflows/paused-<feature>.md` → `.workflows/current-state.md` using your Write tool (write content to new path, then delete old file).

## Step 5: Load Context

Build context efficiently by reading files **in this order**:

1. `.workflows/current-state.md` — current state and **Context section** (this is the authoritative record of all prior decisions — critical for recovering after context compression)
2. `<plugin-root>/skills/<workflow>/SKILL.md` — the workflow definition to find the current phase instructions
3. **Selective phase output loading** (to preserve context budget):
   - **Always read**: the output file from the immediately previous phase (it contains `## Next Phase Input`)
   - **Read if exists**: the plan file (`.workflows/<feature>/plan.md`) — contains the implementation roadmap
   - **Skip**: older phase outputs unless the Context section references them or the current phase explicitly needs them
   - **On-demand**: if a phase requires information from a specific earlier phase, read that file then

**The Context section in the state file is the most important recovery artifact.** If phase output files are missing but the Context section has bullets, you have enough to continue.

## Step 6: Report Status

Present a summary:
```
Resuming: <workflow> — <feature>
Branch: <branch> (checked out: yes/no)
Phase: <current-phase>
Last updated: <updated>
Age: <days since started>

Completed phases:
  <phase> — <notes> (<output-file> exists/MISSING)

Current: <active-phase>
Remaining: <phases-not-yet-started>

Key context:
  <bullet points from Context section of state file>
```

**Visual progress**: If the state file has a Progress section with a Mermaid diagram, display it in the conversation so the user sees where they are at a glance. If the Progress section is missing (older state file), generate it now per Rule 17 and update the state file.

Ask: "Continue from `<active-phase>`?"

## Step 7: Resume Execution

1. If the current branch is wrong and user approved checkout: `git checkout <branch>`
2. Read the current phase section in `<plugin-root>/skills/<workflow>/SKILL.md`
3. **Mid-phase recovery**: If the current phase supports checkpoints (IMPLEMENT, MIGRATE, EXECUTE — see Rule 11), read the phase output file for `### Checkpoint:` entries. Resume from the step **after** the last checkpoint.
4. Continue executing the phase
5. After each phase: write phase output (Rule 1), update state — Rule 5 handles workflow completion automatically

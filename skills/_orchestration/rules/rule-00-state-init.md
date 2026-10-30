# Rule 0: State Initialization

Before starting any workflow, check if `.workflows/current-state.md` exists.

**Directory naming**: Convert `<feature-name>` to kebab-case, max 40 characters, ASCII only. Strip special characters, collapse whitespace to hyphens, lowercase. Examples: "Add user login" → `add-user-login`, "Fix null crash on checkout screen!" → `fix-null-crash-checkout-screen`.

**If it does NOT exist**, create it:
1. `mkdir -p .workflows/<feature-name>`
2. Read the workflow's SKILL.md to get the full list of phases.
3. Use your **Write tool** to create `.workflows/current-state.md` with YAML frontmatter + markdown body:
```
---
workflow: <workflow-name>
feature: <feature-name>
phase: <first-phase>
phases: [<PHASE-1>, <PHASE-2>, ..., <PHASE-N>]
started: <ISO-8601>
updated: <ISO-8601>
branch:
output_dir: .workflows/<feature-name>/
replan_count: 0
---
## Progress

<Mermaid state diagram — see Rule 17>

## Phase History
| Phase | Status | Output | Notes |
|-------|--------|--------|-------|
| <first-phase> | ACTIVE | | Starting workflow |

## Context
_Key decisions and resume context:_

## Constraints
_Hard and soft requirements for remaining phases:_
```

**If it already exists**, read it. If it belongs to a DIFFERENT workflow/feature, ask the user: pause the existing one (Rule 6) or abandon it? If it belongs to the SAME workflow, continue from the current active phase.

**Verify**: Read `.workflows/current-state.md` to confirm it exists before proceeding.

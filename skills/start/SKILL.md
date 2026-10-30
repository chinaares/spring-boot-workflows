---
name: start
description: Entry point — shows available workflows, gathers arguments, then executes the selected workflow directly.
rules: []
---

# Start a Workflow

## Step 1: Check Active Workflows

Read `.workflows/current-state.md`. If it exists:

If the state file has a Progress section with a Mermaid diagram, display it so the user sees where the workflow is.

```
Active workflow detected:
   <workflow> — <feature> (at <phase>, updated <date>)

<Mermaid diagram from Progress section>

Options:
  1. Resume this workflow
  2. Pause it and start something new
  3. Abandon it and start fresh
```

- **Resume** → execute the resume skill. Stop here.
- **Pause** → Rename to `.workflows/paused-<feature>.md`, continue to Step 2.
- **Abandon** → Move to `.workflows/history/<feature>-<date>.md`, continue to Step 2.

Also list any `.workflows/paused-*.md` files as paused workflows.

## Step 2: Show Menu

```
What would you like to do?

-- Build ---------------------------------
  1.  New Feature      — spec, plan, implement, test, PR
  2.  Extend Feature   — add to an existing feature
  3.  New Project      — scaffold a new project

-- Fix -----------------------------------
  4.  Hotfix           — urgent production fix
  5.  CI Fix           — fix failing CI/CD
  6.  Diagnose         — investigate a bug systematically

-- Improve -------------------------------
  7.  Refactor         — restructure code safely
  8.  Migrate          — upgrade deps, APIs, patterns

-- Ship ----------------------------------
  9.  Release          — version, changelog, tag
  10. Review           — PR code review

-- Think ---------------------------------
  11. Brainstorm       — explore ideas and approaches
  12. Scope            — analyze task complexity before starting
  13. Test             — generate or improve tests

-- Meta ----------------------------------
  14. Retrospective    — analyze workflow history for improvements
  15. Metrics          — view workflow execution stats
  16. Learn            — capture or apply patterns

Pick a number (1-16):

Also available as direct commands:
  /git-flow       — branch, commit, PR, merge helpers
  /guards         — safety checks before commits
  /template       — save/reuse workflow templates
  /compose-skill  — create a custom workflow
```

## Step 3: Gather Arguments

Ask for the required input based on selection:

| Selection | Required input |
|-----------|---------------|
| New Feature | Feature name. Optional: ticket ID, design URL, spec path |
| Extend Feature | Which feature + what to add |
| New Project | Project name/path + stack preferences |
| Hotfix | Description of the issue |
| CI Fix | Which CI job or PR |
| Diagnose | Symptom description |
| Refactor | Target + goal |
| Migrate | What to migrate + from/to |
| Release | Version number |
| Review | PR number or branch |
| Brainstorm | Topic to explore |
| Scope | Task description |
| Test | Target to test |
| Retrospective | (no input needed) |
| Metrics | (no input needed) |
| Learn | capture / list / apply + topic |

## Step 4: Execute

Read and execute the selected skill's `SKILL.md` from `<plugin-root>/skills/<skill-name>/`, starting from Phase 1, passing the gathered arguments as context. The dispatched skill manages its own state initialization.

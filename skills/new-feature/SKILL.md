---
name: new-feature
description: "Complete feature development workflow from requirements through PR, including spec writing, brainstorming, planning, implementation, testing, and PR creation."
rules: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17]
---

# New Feature Workflow

```
/new-feature <name> [--from-ticket <url-or-id>] [--from-figma <url>] [--from-spec <path>] [--skip-brainstorm] [--depth full] [--auto]
```

**Prerequisites**: Plugin configured (run /spring-boot-workflows:setup if needed). Git working tree is clean.

**Variants**: This workflow supports adaptive depth (see GATHER phase). You can also force a variant:
- `/new-feature <name> --depth trivial` → GATHER → PLAN → BRANCH → IMPLEMENT → PR (skip SPEC, BRAINSTORM, TEST)
- `/new-feature <name> --depth full` → All 8 phases, no auto-skipping

**Auto mode**: `--auto` skips all approval gates (spec approval, plan approval, brainstorm decisions). Uses the first/recommended option at each decision point. Useful for well-defined tasks where human review happens at PR stage.

**Config**: Read `.workflows/config.yml` for `project.language`, `project.type`, `git.branches.*`, and `workflows.new-feature.*`. Fall back to user plugin settings, then `<plugin-root>/config/defaults.yml`.

---

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<name>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases unless config allows. NEVER stop after implementation — continue ALL remaining phases.**

---

## Phase 1: GATHER

**Goal**: Collect all requirements into a unified understanding.

### Input routing

| Flag | Action |
|---|---|
| `--from-ticket <url-or-id>` | If an issue tracker MCP is available (Jira, Linear, GitHub Issues), fetch issue details. Extract title, description, acceptance criteria, subtasks, priority. **If MCP unavailable**: ask user to paste the ticket details. |
| `--from-figma <url>` | If Figma MCP is available, fetch design context + screenshot. Extract screens, components, design tokens, interactions. **If MCP unavailable**: ask user to describe UI manually. |
| `--from-spec <path>` | Read and parse the file directly. |
| No flags | Interactive mode (see below). |

### Interactive gathering

Ask sequentially:
1. "What does this feature do? (1-2 sentences)"
2. "What are the acceptance criteria?"
3. "Any UI designs? (Figma URL or description)"
4. "Any API changes needed?"
5. "What existing features does this interact with, and any constraints?"

### Adaptive depth

If `workflows.new-feature.adaptive` is `true` in config, estimate complexity after gathering:

| Signal | Depth | Effect |
|--------|-------|--------|
| 1-2 files, <20 lines estimated | **Trivial** | Skip SPEC, BRAINSTORM. Lightweight plan. |
| 3-10 files, clear scope | **Standard** | Normal workflow (all phases) |
| >10 files, architectural changes | **Complex** | Force deep brainstorm, require spec approval |

**Decision criteria**: Count files by searching the codebase for related code (grep for feature keywords, check imports). Count lines by estimating from the spec's acceptance criteria. When uncertain, default to **Standard**.

Announce: "Estimated complexity: [depth]. Adjusting workflow accordingly." User can override with `--depth full`.

### Gate

Do NOT proceed if acceptance criteria are undefined. List missing info and ask user to provide or confirm.

**>> Phase complete** — write output to `.workflows/<name>/01-gather.md`

---

## Phase 2: SPEC

**Goal**: Produce a formal specification from gathered requirements.

### Generate spec

If `<plugin-root>/templates/spec.md.tmpl` exists, use it as the template. Otherwise use this structure:

- **Metadata**: date, source, status (Draft), author
- **Summary**: 1-3 sentences
- **User Stories**: derived from requirements
- **Acceptance Criteria**: checkable list
- **Scope**: in-scope / out-of-scope
- **Technical Requirements**: API changes, data model, UI/UX
- **Dependencies**
- **Edge Cases**
- **Open Questions**

### Approval gate

Present spec summary. Ask: "Review the spec. Reply with changes or 'approved' to proceed."
- Changes requested: update and re-present.
- Approved: proceed.
- Rejected 3+ times: ask if feature scope needs rethinking.

**>> Phase complete** — write output to `.workflows/<name>/02-spec.md`

---

## Phase 3: BRAINSTORM

**Skip if**: `--skip-brainstorm` flag OR `workflows.new-feature.require_brainstorm` is `false`. Mark `SKIPPED` in state and proceed to Phase 4.

### Execute (Rule 9 delegation)

Read `<plugin-root>/skills/brainstorm/SKILL.md` and run its **EXPLORE → EVALUATE → RECOMMEND** phases inline.

Delegation parameters:
- **depth**: `standard` (or override from `workflows.new-feature.brainstorm_depth`)
- **topic**: the feature spec produced in Phase 2
- **output**: write to this workflow's `.workflows/<name>/` directory
- **auto mode**: If `--auto` flag is set, use the recommended option at each decision point without waiting for user input

### Approval gate

User selects an approach. Document choice under "## Chosen Approach" in the spec.

**>> Phase complete** — write output to `.workflows/<name>/03-brainstorm.md`

---

## Phase 4: PLAN

**Goal**: Create a phased implementation plan tailored to the project's architecture.

### Read context

1. Read `.workflows/config.yml` → `project.type`, `project.language`, build/test commands.
2. Read chosen approach from brainstorm output (or spec if brainstorm was skipped).

### Generate plan

Write the implementation plan to `.workflows/<name>/plan.md` (this standalone file is the executable plan, referenced by IMPLEMENT and resume. The phase output `04-plan.md` captures the planning process summary and approval).

**Step 1 — Identify layers touched** by the spec:
- **Data/Models**: entities, DTOs, database schemas, types
- **Domain/Business**: use cases, services, business rules, interfaces
- **Data Layer/API**: repositories, API clients, network, data sources
- **Presentation/UI**: views, screens, components, view models, state
- **Configuration**: DI, routing, build config, environment
- **Tests**: unit tests, integration tests for new code

**Step 2 — Order by dependency** (build from foundation up):
- Phase A: Data models and types (if needed)
- Phase B: Domain/business logic (if needed)
- Phase C: Data layer / API integration (if needed)
- Phase D: Presentation / UI (if needed)
- Phase E: Wiring / DI / configuration (if needed)
- Phase F: Tests for new code

**Step 3 — Skip empty layers.** If no changes needed for a layer, omit it.

**Step 4 — Split large layers.** If a layer touches >5 files, split into sub-phases.

**Step 5 — Cap at `workflows.new-feature.max_plan_phases`** (default 10). If over limit, ask user to split feature.

Each phase MUST include:
- **Files to create/modify**: checkable list with paths
- **Implementation details**: what to build and how
- **Build check command**: detected from project
- **Commit message**: conventional commit format

Also include:
- **Rollback plan**: each phase independently revertable via git
- **Risk assessment**: risks with mitigations

### Approval gate

Present plan summary. Ask: "Review the plan. Reply with changes or 'approved' to proceed."

### Update tracking

If `tasks/todo.md` exists, add feature to it with a checkable item per phase.

**>> Phase complete** — write output to `.workflows/<name>/04-plan.md`

---

## Phase 5: BRANCH

**Preconditions**: `clean-tree`, `phase-complete:PLAN`

**Goal**: Create a properly named feature branch.

1. Read `git.branches.development` and `git.branches.feature` pattern from config.
2. Replace `{name}` in pattern with kebab-case feature name.
3. Run:
   ```bash
   git checkout <dev_branch> && git pull origin <dev_branch> && git checkout -b <branch_name>
   ```

**Error handling**: Dirty tree → tell user to stash. Branch exists → ask to switch or rename. Dev branch behind → pull first.

**>> Phase complete** — write output to `.workflows/<name>/05-branch.md`

---

## Phase 6: IMPLEMENT

**Goal**: Execute the plan phase by phase with build checks and commits.

### Before starting

1. Read `<plugin-root>/rules/` for language-specific coding rules (Rule 3). Follow ALL DO/DON'T directives.

### Per-phase loop

For each phase in the plan:

1. **Read** phase details from `.workflows/<name>/plan.md`.
2. **Implement** changes:
   - One concern per phase. Do not mix layers.
   - Match existing codebase conventions exactly.
   - Only create/modify files listed in the plan.
   - No placeholder code. Every line production-ready.
3. **Build check**: run the phase's build command. If it fails: read error, fix, re-run. After 3 failures: trigger REPLAN (Rule 7).
4. **Commit**: `git add <specific-files> && git commit -m "<message>"`.
5. **Checkpoint** (Rule 11): record files changed, commit hash, status.
6. **Continue**: proceed automatically for straightforward phases. For complex phases, confirm with user.

**>> Phase complete** — write output to `.workflows/<name>/06-implement.md` (files changed, commits, issues encountered)

**>> CONTINUE** — implementation is NOT the end. Proceed to TEST, then PR. Update state and continue.

---

## Phase 7: TEST

**Goal**: Verify correctness and quality.

### Execute

1. Detect test framework from build files. Do NOT assume any specific framework.
2. **Run all tests**: all existing tests MUST pass. If failures caused by new feature, fix them. If pre-existing, report but don't block.
3. **Run new tests**: verify tests from the plan pass.
4. **Coverage check**: if coverage tooling is configured, report coverage for new code. Target: `workflows.test.default_coverage` from config (default 90%).
5. **Verification checklist**:
   - All existing tests pass
   - New tests pass
   - Build succeeds
   - Feature works as specified
   - No regressions

**>> Phase complete** — write output to `.workflows/<name>/07-test.md`

**>> CONTINUE** — testing is NOT the end. Proceed to PR phase. Update state and continue.

---

## Phase 8: PR

**Preconditions**: `tests-pass`, `clean-tree`

**Goal**: Create a well-documented pull request after passing quality gates.

### Pre-PR quality gate (Rule 3)

Load checklists proportional to change size. Self-check applicable items. Fix Critical/High violations before proceeding.

### Create PR

1. Generate PR body:
   - **Summary**: 2-3 sentences from spec
   - **Changes**: bulleted list organized by phase
   - **Testing**: what was tested, coverage
   - **Checklist**: items from quality gate
2. Push and create:
   ```bash
   git push -u origin <branch>
   ```
   Then create the PR with the platform's CLI (detect the platform first — see Rule 8):
   - **GitHub**: `gh pr create --base <dev_branch> --title "feat(<scope>): <title>" --body "<body>"`
   - **Gitea**: `tea pr create --base <dev_branch> --title "feat(<scope>): <title>" --description-file -` (body on stdin)

### Final summary

Print: branch name, PR URL, commit count, files created/modified, spec path, plan path. Suggest next steps.

**>> Phase complete** — write output to `.workflows/<name>/08-pr.md`

---

## Error Handling

| Phase | Error | Resolution |
|---|---|---|
| GATHER | Missing acceptance criteria | Ask user to define before proceeding |
| BRANCH | Merge conflicts | Rebase on dev branch, resolve conflicts |
| IMPLEMENT | Build fails 3+ times | REPLAN (Rule 7) |
| PR | `gh` CLI not authenticated | Guide user: run `! gh auth login` |

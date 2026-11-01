---
name: ci-fix
description: Diagnose and fix CI/CD pipeline failures automatically. Supports GitHub Actions and Gitea Actions.
rules: [0, 1, 3, 4, 5, 6, 7, 10, 11, 12, 17]
---

# CI Fix Workflow

## Command

`/ci-fix [--run <run-id>] [--pr <pr-number>] [--platform github|gitea]`

**Description for output paths**: Auto-generate `<description>` from the CI failure (e.g., `fix-compile-error-UserService` or `fix-test-failure-pr-42`). Use kebab-case, max 40 chars.

---

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<description>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases. NEVER stop after fix — continue ALL remaining phases.**

---

## Step 0b: Detect Platform (DO THIS BEFORE PHASE 1)

The log-fetch commands differ between GitHub and Gitea. Determine the platform once and use it for every phase.

1. `--platform` flag → use it.
2. Else `ci.platform` in `.workflows/config.yml`, when it is not `auto`.
3. Else `git remote get-url origin`: `github.com` → `github`; otherwise → `gitea`.
4. Else ask the user.

Then verify the CLI exists:

| Platform | CLI | Check |
|---|---|---|
| github | `gh` | `command -v gh` |
| gitea | `tea` | `command -v tea` |

If the CLI is missing, stop and tell the user which one to install. Do not silently fall back to the other platform.

Read `<plugin-root>/skills/_orchestration/references/platform-cli.md` for the full command mapping.

---

## Phases

### Phase 1: FETCH

Retrieve CI failure details using the platform detected in Step 0b.

**GitHub:**

1. If `--run <run-id>`: `gh run view <run-id> --log-failed`
2. If `--pr <pr-number>`: `gh pr checks <pr-number>` then `gh run view <failed-run-id> --log-failed`
3. If neither: `gh run list --status failure --limit 5` and ask user which to investigate

**Gitea:**

1. If `--run <run-id>`: `tea actions runs logs <run-id>`
2. If `--pr <pr-number>`: list the PR's runs with `tea actions runs list --event pull_request`, pick the failed one, then `tea actions runs logs <run-id>`
3. If neither: `tea actions runs list --status failure --limit 5` and ask user which to investigate

In both cases:

4. Capture the full failure output for diagnosis. On Gitea, `tea actions runs logs` prints every job — narrow it with `--job <job-id>` when the output is large.
5. On Gitea, if the log shows no failure, the run may still be in progress; check `tea actions runs view <run-id>` for the conclusion.

**>> Phase complete** — write output to `.workflows/<description>/01-fetch.md` (platform, run id, failing job, log excerpt)

### Phase 2: DIAGNOSE

Classify failure by parsing log output. Read `<plugin-root>/rules/` for language-specific fix patterns.

| Category | Indicators |
|----------|-----------|
| **Compile Error** | `error:`, `FAILURE: Build failed`, `Cannot find symbol`, `Unresolved reference` |
| **Test Failure** | `FAILED`, `AssertionError`, `expected:`, `Tests run:.*Failures: [1-9]` |
| **Lint Violation** | `warning:`, `Lint found`, `ktlint`, `detekt`, `eslint` |
| **Dependency Issue** | `Could not resolve`, `Module not found`, `version conflict` |
| **Config Error** | `FileNotFoundException`, `missing secret`, `env variable not set`, `permission denied` — if the workflow file itself is missing or malformed, suggest `/spring-boot-workflows:ci-setup` |
| **Timeout** | `exceeded`, `timed out`, `deadline`, `cancelled` |
| **Flaky/Intermittent** | Passed locally, `flaky`, sporadic failures, inconsistent results |

1. Parse failure log against indicators
2. Extract error message, file path, line number when available
3. Present diagnosis: category, root cause, affected files

**>> Phase complete** — write output to `.workflows/<description>/02-diagnose.md` (category, root cause, affected files)

### Phase 3: FIX

Apply targeted fix based on diagnosis.

| Category | Approach |
|----------|----------|
| **Compile Error** | Read failing file at reported line, apply minimal fix (missing import, type mismatch, syntax) |
| **Test Failure** | Read test + source; if ambiguous whether test or source is wrong, ask user; default to fixing source |
| **Lint Violation** | Run auto-fix if available (`ktlint -F`, `eslint --fix`); otherwise manual correction |
| **Dependency Issue** | Check version mismatches in build files, update/add dependencies, verify resolution |
| **Config Error** | Identify missing config/secret/file; inform user (cannot auto-create secrets). If the workflow is absent or structurally broken, hand off to `/spring-boot-workflows:ci-setup` |
| **Timeout** | Suggest optimizations (caching, parallelism, test splitting); provide recommendations |

**>> Phase complete** — write output to `.workflows/<description>/03-fix.md` (changes made, approach)

**>> CONTINUE** — the fix is NOT the end. Proceed to PUSH, then MONITOR. Update state and continue.

### Phase 4: PUSH

Commit and push the fix.

1. Stage only changed files (never `git add -A`)
2. Commit: `fix(ci): <description of what was fixed>`
3. Push to current branch
4. Note open PR number if applicable

**>> Phase complete** — write output to `.workflows/<description>/04-push.md` (commit hash, branch, PR)

### Phase 5: MONITOR

Verify the fix resolved the CI failure, using the platform detected in Step 0b.

| Platform | Watch | Check status |
|---|---|---|
| github | `gh run watch` | `gh run list --branch <current-branch> --limit 3` |
| gitea | `tea actions runs logs <run-id> --follow` | `tea actions runs list --branch <current-branch> --limit 3` |

3. **Retry on failure**: If CI fails again, re-read the new failure log and apply a targeted fix. Commit and push. Check status again. Max 3 total fix attempts across the workflow. After 3, STOP and present the failure details to the user.

**>> Phase complete** — write output to `.workflows/<description>/05-monitor.md` (CI run status, pass/fail)

---

## Error Handling

| Error | Resolution |
|---|---|
| `gh` / `tea` not installed | Stop; tell the user which CLI to install for the detected platform |
| `gh` not authenticated | Tell user: `! gh auth login` |
| `tea` not authenticated | Tell user: `! tea login add --name <instance> --url <url> --token <token>` |
| `tea` login does not match the remote | List logins with `tea login list`; pass `--login <name>` explicitly |
| Platform cannot be determined | Ask the user; do not guess |
| Run id not found | List runs and ask the user to pick one |
| Run still in progress | Wait — check the conclusion with `gh run view` / `tea actions runs view` |
| Logs empty on Gitea | The run may still be running; check the status before diagnosing |
| No CI runs at all | The workflow may not have triggered; check the trigger config and suggest `/spring-boot-workflows:ci-setup` |



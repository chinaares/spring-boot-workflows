---
name: review
description: Review a GitHub pull request by fetching changes, categorizing by architecture, checking against dynamically loaded checklists, and generating inline comments with severity levels.
rules: [0, 1, 5, 6, 7, 10, 12, 17]
---

# Code Review Workflow

```
/review <pr-number> [--strict] [--focus <area>]
```

- `--strict`: Treat warnings as errors
- `--focus <area>`: Prioritize checks matching area (security, performance, architecture, tests)

Four phases: **FETCH → CATEGORIZE → CHECK → COMMENT**

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<pr-name>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: FETCH

**Goal**: Gather all PR data needed for review.

Detect the platform first (see Rule 8): `--platform` flag → `ci.platform` in `.workflows/config.yml` → `git remote get-url origin` → ask the user.

**Steps 1.1–1.4 are independent — execute in parallel.**

Fetch the PR data using the platform's CLI:

| Data | GitHub | Gitea |
|---|---|---|
| Repository | `gh repo view --json owner,name -q '.owner.login + "/" + .name'` | `tea repo list --output simple` |
| PR metadata | `gh pr view --json` | `tea pr <pr-number>` |
| Diff | `gh pr diff <pr-number>` | `tea pr <pr-number>` (summary) + `git diff` against the base branch locally |
| Changed files | `gh pr diff --name-only` | `git diff --name-only <base>...HEAD` |
| CI checks | `gh pr checks <pr-number>` | `tea actions runs list --event pull_request` |
| Existing comments | `gh pr view --json comments` | `tea pr review-comments <pr-number>` and `tea comments list <pr-number>` |

On Gitea, `tea pr` does not return a raw diff — fetch the diff locally with `git fetch origin <base> && git diff <base>...HEAD`.

**Context loading strategy** — do NOT read every file in full. Read the bounds
from `workflows.review.context_thresholds` in `.workflows/config.yml` (fall back
to `<plugin-root>/config/defaults.yml`); the shipped defaults are
`{ small: 10, medium: 30 }`:
- **Small PRs** (≤ `small` files): Read each changed file in full for context
- **Medium PRs** (`small`+1 to `medium` files): Read files only when checking them in Phase 3
- **Large PRs** (> `medium` files): Warn PR should be split. Read files per-category during CHECK.

**>> Phase complete** — write output to `.workflows/<pr-name>/01-fetch.md`

---

## Phase 2: CATEGORIZE

**Goal**: Organize changes by architectural layer.

Classify files into: UI, Logic/Controllers, Domain/Business, Data/API, Models, Config, Tests, Other. Adapt to project's actual architecture.

Review order (foundations first): Models/Data → Domain → Logic/Controllers → UI → Config → Tests

Summarize file counts per category with additions/deletions.

**>> Phase complete** — write output to `.workflows/<pr-name>/02-categorize.md`

---

## Phase 3: CHECK

**Goal**: Review each file against quality checklists.

**Load checklists**: read `workflows.review.checklist` from `.workflows/config.yml` (fall back to `<plugin-root>/config/defaults.yml`):

| Value | Checklists |
|---|---|
| `auto` (default) | General checklist + language-specific (from `project.language`). If a team is configured, also load `<plugin-root>/teams/<team>/reviews/team-review-checklist.md`. |
| `none` | No checklist files — use the fallback checks (architecture, code quality, security, performance, test coverage, consistency). |
| `<path>` | Only that checklist file. |

No checklists found → use the same fallback checks as `none`.

**Gate level**: read `workflows.review.size_thresholds` from config and apply
Rule 3's proportional table (Light / Standard / Full). The config block is the
single source of truth — do not hardcode the bounds here. When
`quality.proportional` is `false`, use the Full gate regardless of size.

**Apply focus**: If `--focus` provided, weight matching violations higher. Still run all checks.

**Execute**: For each changed file, check applicable items. Record violations with: severity (Critical/High/Medium/Low), file+line, issue, actionable suggestion.

**Structured output**: also write `.workflows/<pr-name>/findings.json` so the
findings can be re-gated, aggregated, or consumed by another tool. Same schema
as the verification loop (`spring-boot-workflows/verify-findings@1`):

```json
{
  "schema": "spring-boot-workflows/verify-findings@1",
  "generated_at": "2026-11-03T10:22:31Z",
  "pr": "42",
  "overall": "REQUEST_CHANGES",
  "checks": [{ "id": "review", "status": "FAIL", "detail": "2 Critical, 1 High" }],
  "findings": [
    {
      "id": "review",
      "severity": "critical",
      "file": "src/main/java/com/example/OrderService.java",
      "line": 42,
      "message": "Raw exception message returned in the response body",
      "fix": "Return a Problem Details body; log the message instead"
    }
  ]
}
```

`status` is one of `PASS`, `FAIL`, `SKIPPED`, `ERROR`; `severity` is one of
`critical`, `high`, `medium`, `low`. The file is written even when there are no
findings — an empty `findings` array is a result, not a missing file.

**>> Phase complete** — write output to `.workflows/<pr-name>/03-check.md`

---

## Phase 4: COMMENT

**Goal**: Generate and submit review comments.

| Severity | Blocks Merge? |
|---|---|
| **Critical** | Yes — bug, security issue, crash risk |
| **High** | No (but should fix) — code smell, perf issue, correctness risk |
| **Medium** | No — improvement idea, minor code quality |
| **Low** | No — style, naming, nitpicks |

**Verdict**: Critical → REQUEST_CHANGES | High only → COMMENT (or APPROVE if minor) | none → APPROVE | `--strict`: High also REQUEST_CHANGES.

**User Approval**: "(1) submit as-is, (2) remove comments, (3) adjust severities, (4) cancel."

Submit the verdict with the platform's CLI:

| Action | GitHub | Gitea |
|---|---|---|
| Approve | `gh pr review <pr> --approve --body "<summary>"` | `tea pr approve <pr>` |
| Request changes | `gh pr review <pr> --request-changes --body "<summary>"` | `tea pr reject <pr>` |
| Comment only | `gh pr review <pr> --comment --body "<summary>"` | `tea comments add <pr> --description "<summary>"` |
| Inline comments | `gh api repos/{owner}/{repo}/pulls/{pr}/comments -f body="<comment>" -f path="<file>" -F line=<line> -F commit_id="<sha>"` | See the note below |

**Gitea inline comments** — there is no CLI equivalent. Use the Gitea API:

```
POST /api/v1/repos/{owner}/{repo}/pulls/{index}/reviews
{
  "body": "<summary>",
  "comments": [
    { "path": "<file>", "body": "<comment>", "new_position": <line> }
  ]
}
```

Use `new_position` (not `line`), and take the PR **index** (not number) from `tea pr list`. Authenticate with the login's token. Confirm the payload against the target Gitea version before relying on it — if the API call fails, fall back to posting the findings as a single PR comment (`tea comments add`) with each finding prefixed by `path:line`, and tell the user the inline format was unavailable.

Print verdict, counts by severity (Critical/High/Medium/Low), PR URL.

**>> Phase complete** — write output to `.workflows/<pr-name>/04-comment.md`

---

## Review Principles

Be constructive (include suggestions), specific (exact lines), proportional (don't block for nitpicks). Acknowledge good work. Focus on behavior over style. Consider context (hotfix vs feature). One comment per issue.

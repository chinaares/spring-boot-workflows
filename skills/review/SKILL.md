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

Detect repository: `gh repo view --json owner,name -q '.owner.login + "/" + .name'`

**Steps 1.1–1.4 are independent — execute in parallel.**

Fetch via `gh`: PR metadata (`gh pr view --json`), diff (`gh pr diff`), changed files list, CI checks (flag failures), existing comments (to avoid duplicates).

**Context loading strategy** — do NOT read every file in full:
- **Small PRs** (≤10 files): Read each changed file in full for context
- **Medium PRs** (11-30 files): Read files only when checking them in Phase 3
- **Large PRs** (>30 files): Warn PR should be split. Read files per-category during CHECK.

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

**Load checklists**: General checklist + language-specific (from `project.language`). If a team is configured, also load `<plugin-root>/teams/<team>/reviews/team-review-checklist.md`. No checklists found → use fallback checks (architecture, code quality, security, performance, test coverage, consistency).

**Apply focus**: If `--focus` provided, weight matching violations higher. Still run all checks.

**Execute**: For each changed file, check applicable items. Record violations with: severity (Critical/High/Medium/Low), file+line, issue, actionable suggestion.

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

Submit: `gh pr review <pr-number> --approve|--request-changes|--comment --body "<summary>"` for verdict. For inline comments: `gh api repos/{owner}/{repo}/pulls/{pr}/comments -f body="<comment>" -f path="<file>" -F line=<line> -f commit_id="<sha>"`.

Print verdict, counts by severity (Critical/High/Medium/Low), PR URL.

**>> Phase complete** — write output to `.workflows/<pr-name>/04-comment.md`

---

## Review Principles

Be constructive (include suggestions), specific (exact lines), proportional (don't block for nitpicks). Acknowledge good work. Focus on behavior over style. Consider context (hotfix vs feature). One comment per issue.

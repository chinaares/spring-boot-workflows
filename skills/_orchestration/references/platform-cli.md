# Platform CLI Reference

Command mapping for GitHub (`gh`) and Gitea (`tea`). Skills that touch pull
requests, CI runs, or releases must detect the platform first and use the
matching column.

## Detecting the platform

```bash
git remote get-url origin
```

| Remote contains | Platform |
|---|---|
| `github.com` | `github` |
| Anything else, or `.gitea/` exists | `gitea` |
| No remote / inconclusive | Ask the user |

The `ci:` section of `.workflows/config.yml` (`ci.platform`) is authoritative
when it is set to something other than `auto`. Otherwise detect from the
remote, and fall back to asking.

**Tool availability** — check before use:

```bash
command -v gh    # GitHub
command -v tea   # Gitea
```

If the required CLI is missing, say which one to install rather than failing
mid-phase.

---

## CI runs

| Operation | GitHub | Gitea |
|---|---|---|
| List failed runs | `gh run list --status failure --limit 5` | `tea actions runs list --status failure --limit 5` |
| List runs for a branch | `gh run list --branch <branch> --limit 3` | `tea actions runs list --branch <branch> --limit 3` |
| List runs for a PR event | `gh run list --event pull_request` | `tea actions runs list --event pull_request` |
| View a run | `gh run view <run-id>` | `tea actions runs view <run-id>` |
| View a run's jobs | `gh run view <run-id> --json jobs` | `tea actions runs view <run-id> --jobs` |
| Failed-step logs | `gh run view <run-id> --log-failed` | `tea actions runs logs <run-id>` (all jobs) |
| Follow a running run | `gh run watch <run-id>` | `tea actions runs logs <run-id> --follow` |

Notes:

- `tea actions runs list` accepts `--status`, `--branch`, `--event`,
  `--since`, `--until`, `--login`, and `--output` (`simple`, `table`, `json`).
- `tea actions runs logs` prints every job's log; use `--job <job-id>` to
  narrow it. Unlike `gh run view --log-failed`, it does not filter to failed
  steps — grep the output for the failing job instead.
- Add `--login <name>` when the repository is not served by the default tea
  login. `tea login list` shows the configured instances.

## Pull requests

| Operation | GitHub | Gitea |
|---|---|---|
| PR metadata | `gh pr view <pr> --json ...` | `tea pr <pr>` |
| PR diff | `gh pr diff <pr>` | `tea pr <pr> --output simple` (summary only) |
| CI checks for a PR | `gh pr checks <pr>` | `tea actions runs list --event pull_request` |
| Create a PR | `gh pr create --base <b> --title <t> --body <body>` | `tea pr create --base <b> --title <t> --description <body>` |
| Draft PR | `gh pr create --draft` | `tea pr create --draft` (Gitea prefixes the title with `WIP: `) |
| Merge (squash) | `gh pr merge <pr> --squash` | `tea pr merge <pr> --style squash` |
| Merge (merge commit) | `gh pr merge <pr> --merge` | `tea pr merge <pr> --style merge` (default) |
| Merge (rebase) | `gh pr merge <pr> --rebase` | `tea pr merge <pr> --style rebase` |
| Submit a review verdict | `gh pr review <pr> --approve\|--request-changes\|--comment --body <text>` | `tea pr approve <pr>` / `tea pr reject <pr>` |
| Comment on a PR | `gh pr comment <pr> --body <text>` | `tea comments add <pr> --description <text>` |
| Inline review comments | `gh api repos/{o}/{r}/pulls/{pr}/comments -f body=... -f path=... -F line=... -F commit_id=...` | No CLI equivalent — use the Gitea API `POST /repos/{owner}/{repo}/pulls/{index}/reviews` |
| List review comments | `gh pr view <pr> --json comments` | `tea pr review-comments <pr>` |
| Request reviewers | `gh pr create --reviewer <user>` / `gh pr edit <pr> --add-reviewer <user>` | No `tea` equivalent — use the Gitea web UI or `POST /repos/{owner}/{repo}/pulls/{index}/requested_reviewers` with `{"reviewers": [...]}` |
| Set assignees | `gh pr edit <pr> --add-assignee <user>` | `tea pr create --assignees <a,b>` (creation only — no edit flag) |

Notes:

- `tea pr create --description-file -` reads the body from stdin, which avoids
  shell-quoting problems with multi-line bodies.
- `tea comment <pr> "<body>"` is shorthand for `tea comments add`. There is no
  `tea pr comment` subcommand — use `tea comments`.
- Gitea inline review comments have no CLI command. The API path is
  `POST /repos/{owner}/{repo}/pulls/{index}/reviews` with a `comments` array;
  each comment needs `path`, `body`, and `new_position` (not `line`).
  Confirm the payload against the target Gitea version before relying on it.
- `tea pr` (without a subcommand) lists open PRs.
- `tea pr create` has no reviewer flag. Requesting reviewers needs the Gitea
  API or web UI; assignees (`--assignees`) are a different role and not a
  substitute. Add `--login <name>` to `tea` commands when multiple instances
  are configured.

## Releases

| Operation | GitHub | Gitea |
|---|---|---|
| Create a release | `gh release create <tag> --title <t> --notes <n>` | `tea releases create <tag> --title <t> --description <n>` |

## API access

| Operation | GitHub | Gitea |
|---|---|---|
| REST base | `https://api.github.com` | `http://<host>/api/v1` |
| Auth token | `gh auth token` | `tea login list` → use the login's token |
| Generic call | `gh api <path>` | `curl -H "Authorization: token <token>" <base>/<path>` |

## What has no Gitea equivalent

| Feature | GitHub | Gitea |
|---|---|---|
| Environment protection rules / required reviewers | `environment:` | Not supported |
| OIDC cloud credentials | `id-token: write` | Not supported — use long-lived secrets |
| Native test-report UI | Surefire results in checks | Artifact download only |
| Dependabot for action versions | Built in | Use Renovate |
| Required status checks on protected branches | Built in | Branch protection supports some statuses |

When a workflow depends on one of these, generate the artifact-based
alternative and tell the user what differs.

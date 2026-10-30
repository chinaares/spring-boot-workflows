---
name: git-flow
description: Direct git operations — branch creation, commits, PRs, and merges using project-configured patterns and policies.
rules: []
---

# Git Flow Skill

## Commands

```
/git-flow branch <type> <name>
/git-flow commit <message>
/git-flow pr [--base <branch>]
/git-flow merge <branch>
```

---

## Subcommand: `branch <type> <name>`

Create a branch from the configured pattern in `.workflows/config.yml`.

1. Read `git.branches` from `.workflows/config.yml`
2. Validate `<type>` is one of: `feature`, `bugfix`, `hotfix`, `release`
3. Resolve pattern — replace `{name}` or `{version}` with `<name>`
4. **Protected branch check**: If current branch is in `git.protected`, warn before branching from it
5. Ensure working tree is clean, pull latest from base branch
6. Create and checkout: `git checkout -b <resolved-branch-name>`
7. Print the created branch name

**Error**: If `<type>` is not recognized, list valid types from config and abort.

---

## Subcommand: `commit <message>`

Commit staged changes using the configured commit format.

1. Read `git.commits` from `.workflows/config.yml`
2. **Format validation** — if `format: "conventional"`, enforce:
   - Message must match: `<type>(<scope>): <description>` or `<type>: <description>`
   - `<type>` must be in the configured `types` list
   - Reject non-matching messages with a correct-format example
3. **Protected branch check**: If current branch is in `git.protected`, abort — never commit directly to protected branches
4. Stage files if none staged (prompt user to confirm which files)
5. Create the commit: `git add <files> && git commit -m "<validated-message>"`
6. Print commit hash and summary

**Error**: If no changes staged and no untracked files, abort with "nothing to commit".

---

## Subcommand: `pr [--base <branch>]`

Create a pull request with configured settings.

1. Read `git.pr` from `.workflows/config.yml`
2. Base branch: `--base` flag > `git.pr.base_branch` > `develop`
3. **Protected branch check**: Warn if target is `main`/`master` and source is not `release/` or `hotfix/`
4. Read `<plugin-root>/reviews/` if it exists — include findings in PR body
5. Push: `git push -u origin <current-branch>`
6. Generate title from branch name (e.g., `feature/add-login` -> `feat: add login`)
7. Generate body from `git log <base>..HEAD --oneline --no-merges`; use `git.pr.template` if configured
8. Create via `gh pr create` with `--base`, `--title`, `--body`, `--draft`, `--reviewer`, `--label` (omit empty arrays)
9. Print PR URL

---

## Subcommand: `merge <branch>`

Merge a branch using the configured strategy.

1. Read `git.merge` from `.workflows/config.yml`
2. **Protected branch check**: If merging INTO a protected branch, require explicit user confirmation
3. Verify the branch exists and has an open PR (if applicable)
4. Apply configured merge strategy:
   - `squash`: `gh pr merge <branch> --squash`
   - `merge`: `gh pr merge <branch> --merge`
   - `rebase`: `gh pr merge <branch> --rebase`
5. If `git.merge.delete_branch` is `true`, add `--delete-branch` flag
6. Pull latest after merge: `git checkout <base-branch> && git pull origin <base-branch>`
7. Print merge result and branch deletion status

**Error**: If merge conflicts exist, abort and report conflicting files.

---

## Notes

- All settings read from `.workflows/config.yml` under the `git` key. If missing, use defaults: `conventional` commits, `develop` PR base, `squash` merge, protected = `[main, master, develop]`.
- Never force-push to protected branches.

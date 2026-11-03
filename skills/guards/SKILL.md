---
name: guards
description: Safety guard enforcement — checks files against block patterns, protected paths, and credential leaks before commits and pushes.
rules: []
---

# Safety Guards

```
/guards init
/guards check [--staged] [--force]
/guards report
```

Prevents dangerous operations and credential leaks by enforcing rules from `.workflows/guards.yml`.

---

## Configuration

Two files, in this precedence order:

| Source | Key | Meaning |
|---|---|---|
| `.workflows/guards.yml` | `strict` | Per-project override — `true` makes a WARN finding block the operation |
| `<plugin-root>/config/defaults.yml` | `guards.strict` | Plugin default, used when the project file does not set it |
| `.workflows/guards.yml` | `enabled` | Per-project switch — `false` disables this project entirely |
| `<plugin-root>/config/defaults.yml` | `guards.enabled` | Master switch — when `false`, the automatic checks in `git-flow` and `new-feature` are skipped |

Both must be `true` for a guard check to run automatically. A manual
`/guards check` always runs.

## Matching Semantics

This is the part that is easy to get wrong — the rules use **two different
matchers**, and each one applies to its own list:

| List | Matcher | Applied to |
|---|---|---|
| `block_patterns` | **POSIX extended regex** | file content, line by line |
| `warn_patterns` | **POSIX extended regex** | file content, line by line |
| `token_patterns` | **POSIX extended regex** | file content, line by line |
| `protected_paths` | **shell glob** | file path |
| `no_commit_patterns` | **shell glob** | file path |

Consequences worth internalizing:

- `*.env` in a **regex** list matches nothing — use `\.env$`.
- `*.env` in a **glob** list matches `prod.env`.
- `block_patterns` is evaluated first. A line matching both a block and a warn
  pattern is a **BLOCK**.
- A regex that fails to compile is a **configuration error**, not a silent
  pass. Report it and continue with the other rules.

---

## `/guards init`

1. If `.workflows/guards.yml` does **not** exist: copy
   `<plugin-root>/templates/guards.yml.tmpl` to `.workflows/guards.yml`.
2. If it **does** exist, check whether it predates the current schema:

   | Missing key | Meaning |
   |---|---|
   | `strict` | The config predates the strict mode |
   | `token_patterns` | The config predates the configurable credential patterns |

   When either is missing, print what is missing and **offer to upgrade**: keep
   every pattern the project already has, and add only the missing keys. The
   project's own patterns are never overwritten — the user's rules are theirs.
3. **Validate every pattern** under `block_patterns`, `warn_patterns`, and
   `token_patterns` as a POSIX extended regex. A pattern that does not compile
   is a **configuration error** — report it with the pattern and the error, and
   list the patterns that do compile. Never treat an unparseable pattern as
   "no match".
4. Print config summary (counts of block / warn / token patterns, protected
   paths, no-commit patterns) and the resolved `strict` value.

> A legacy config's patterns were never checked against a matcher, so a pattern
> like `:(){:|:&};:` compiles but alternates on its `|` and never matches the
> string it was written for. After upgrading, re-read each pattern and say
> which ones look like they were meant to be literal — a literal string must
> have its special characters escaped.

---

## `/guards check [--staged] [--force]`

**Step 1 — Load Rules**: Read `.workflows/guards.yml` (run `init` if missing).
Resolve `strict` and `enabled` per the Configuration table above.

**Step 2 — Determine File Set**:
- `--staged`: `git diff --cached --name-only`
- Default: `git diff --name-only HEAD` + `git ls-files --others --exclude-standard`

Skip binary files and files over 1 MB — a binary blob is not a text-credential
carrier and reading it into context is wasteful.

**Step 3 — Check Files**: For each file, check:
- Path matches against `protected_paths` and `no_commit_patterns` (glob)
- Content matches against `block_patterns` and `warn_patterns` (regex)
- Content matches against `token_patterns` (regex). The built-in list covers
  AWS access keys, GitHub/GitLab/Slack tokens, OpenAI/Anthropic keys, Google
  API keys, private-key headers, JWTs, Bearer literals, and inline credentials
  in URLs. When the project file **has** a `token_patterns` list, it **replaces**
  the built-in one — extend it, do not assume it is merged. When the project
  file has **no** `token_patterns` key (a config from before the list became
  configurable), the built-in list applies unchanged.

**Step 4 — Report**: Print `[BLOCK]`, `[WARN]`, `[PASS]` per file.

- `[BLOCK]` stops the operation.
- `[WARN]` is advisory — unless `strict` resolves to `true`.

**Never echo a matched credential.** Report the file, the line number, and the
pattern that matched — not the value. A secret printed into a terminal, a log,
or a report file is a second leak.

**Final line** — always print exactly one of these, so a caller can branch on it:

```
GUARDS: PASS
GUARDS: BLOCK
GUARDS: WARN
```

`BLOCK` when any block finding exists. `WARN` when only warnings exist and
`strict` is `false`. `PASS` otherwise.

If `--force`, log the override to `.workflows/history/guard-overrides.log` and
print `GUARDS: BLOCK (overridden)`.

---

## Automatic Invocation

The following workflows run this check on the user's behalf. Each one honours
the `guards.enabled` master switch — when it is `false`, the check is skipped
and the workflow says so.

| Workflow | When | File set |
|---|---|---|
| `git-flow commit` | before `git commit` | staged files |
| `git-flow pr` | before `git push` | the diff against the base branch |
| `new-feature` (PR phase) | before pushing the branch | the diff against the base branch |

When the check reports `BLOCK`, the workflow **stops** and reports the
findings. It does not offer `--force` on its own — that is the user's call.

---

## `/guards report`

Print config summary and recent overrides. If no config, run `init` automatically.

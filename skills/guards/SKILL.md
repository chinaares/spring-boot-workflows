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

## `/guards init`

1. If `.workflows/guards.yml` exists: print config summary.
2. Otherwise, copy `<plugin-root>/templates/guards.yml.tmpl` to `.workflows/guards.yml`.
3. Print config summary (count of block patterns, warn patterns, protected paths, no-commit patterns).

---

## `/guards check [--staged] [--force]`

**Step 1 — Load Rules**: Read `.workflows/guards.yml` (run `init` if missing).

**Step 2 — Determine File Set**:
- `--staged`: `git diff --cached --name-only`
- Default: `git diff --name-only HEAD` + `git ls-files --others --exclude-standard`

**Step 3 — Check Files**: For each file, check:
- Path matches against `protected_paths` and `no_commit_patterns`
- Content matches against `block_patterns` and `warn_patterns`
- Hardcoded tokens: `AKIA`, `sk-`, `ghp_`, `Bearer `, `-----BEGIN.*PRIVATE KEY-----`, `eyJ` (JWT), common API key formats

**Step 4 — Report**: Print `[BLOCK]`, `[WARN]`, `[PASS]` per file. `BLOCK` stops the operation; `WARN` is advisory (unless `guards.strict: true`).

If `--force`, log override to `.workflows/history/guard-overrides.log`.

---

## `/guards report`

Print config summary and recent overrides. If no config, run `init` automatically.

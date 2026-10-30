# Rule 1: Phase Output Protocol

After completing each phase, do TWO things before moving on:

**Action 1 — Write the phase output file** at the path shown in each phase's `>> Write output to` line:
```
# <Phase Name> — <Feature>
## Summary
<1-3 sentences>
## Details
<Phase-specific content — the individual skill defines what each phase produces>
## Next Phase Input
<What the next phase needs to know — keep this concise, it's the primary input for the next phase>
```

Don't duplicate date/status/decisions in output files — they belong in the state file.

**Output numbering**: Each skill's phases define their output paths with hardcoded numbers (e.g., `01-gather.md`, `02-spec.md`). Use these paths exactly as written. When a phase is SKIPPED, its output file is simply not created — the numbering does NOT shift. This means output directories may have gaps (e.g., `01-gather.md`, `03-plan.md` if SPEC was skipped).

**Action 2 — Update the state file.** Read `.workflows/current-state.md`, then rewrite:
- **Frontmatter**: set `phase` to next, `updated` to now, `branch` if created
- **Progress**: regenerate Mermaid diagram (Rule 17)
- **Phase History**: mark completed phase `COMPLETED` with output filename, add new `ACTIVE` row
- **Context**: append key decisions as bullets (1 per decision, max ~20 — this is the authoritative record that survives context compression; always read it before starting a new phase)
- **Constraints**: update if new `[HARD]`/`[SOFT]` constraints found (all remaining phases must respect these)

**Do NOT proceed to the next phase until both files are written.**

### Phase Preconditions

Before starting any phase, check if it declares preconditions (indicated by a `**Preconditions**:` line in the skill's phase definition). Common preconditions:

| Precondition | Check |
|---|---|
| `clean-tree` | `git status --porcelain` returns empty |
| `tests-pass` | Run `<test-command>` and verify exit code 0 |
| `branch-exists` | `git branch --list <branch>` returns non-empty |
| `file-exists:<path>` | File at `<path>` exists |
| `phase-complete:<phase>` | Phase marked COMPLETED in state file |

If a precondition fails: report which precondition failed and why. Offer to fix automatically (e.g., stash changes for `clean-tree`) or ask user for guidance. Do NOT skip the phase — precondition failures must be resolved.

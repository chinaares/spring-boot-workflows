# Rule 14: Dry Run

> **Always-available rule**: This rule applies to ALL skills regardless of their `rules` list. Check for `--dry-run` before executing any workflow.

If `--dry-run` flag is present on any workflow command:
1. Preview the execution plan: phases, branch name, output files, config flags
2. No state files created, no git commands (except read-only), no file writes
3. Display the plan summary, then **STOP**

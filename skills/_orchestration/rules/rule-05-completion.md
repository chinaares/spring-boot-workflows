# Rule 5: Workflow Completion

When the LAST phase of a workflow is completed:
1. Write final phase output, mark as `COMPLETED` in state
2. **Generate diff report**: Run `git diff --stat <start-commit>..HEAD` (from first checkpoint or branch creation). Present:
   ```
   Workflow Complete: <workflow> — <feature>
   ─────────────────────────────────────────
   Commits:    <N>
   Files:      <N> changed (<N> added, <N> modified, <N> deleted)
   Lines:      +<added> / -<removed>
   Branch:     <branch-name>
   Phases:     <completed>/<total> (<skipped> skipped)
   Replans:    <count>
   ```
3. Move `.workflows/current-state.md` to `.workflows/history/<feature>-<YYYY-MM-DD>.md` (append `-<HHMM>` if name collision)
4. Preserve `.workflows/<feature>/` directory as archive
5. Check for workflow chaining (Rule 15)
6. Extract knowledge if applicable (Rule 16)

**Skills do NOT need to repeat these steps** — this rule handles all completion logic universally.

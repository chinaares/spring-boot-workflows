# Rule 7: Error Recovery & REPLAN

| Trigger | Action |
|---------|--------|
| Compilation fails 1-2 times in a phase | **RETRY**: read error, adjust approach, try again within same phase |
| Compilation fails 3+ times in a phase | **REPLAN** |
| Plan step is impossible | STOP, document, REPLAN |
| User requests change mid-implementation | STOP, REPLAN |

**RETRY protocol**: On failures 1-2, read the error, adjust approach, and retry. Document as `### Retry N` in phase output. Escalate to REPLAN on 3rd failure in the same phase.

**REPLAN protocol**: Stop, document failure under "## Replan Notes" in plan file, re-analyze remaining phases, get user approval, resume.

**REPLAN limit**: Max 2 per workflow. Each REPLAN increments `replan_count` in the state frontmatter (max 2). After 2, STOP and present options: (a) continue with manual guidance, (b) abandon workflow, (c) split into smaller scope. Each REPLAN resets the 3-failure counter.

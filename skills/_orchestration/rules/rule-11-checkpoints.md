# Rule 11: Mid-Phase Checkpoints

For multi-step phases (IMPLEMENT, MIGRATE, EXECUTE), append after each step:
```
### Checkpoint: Step N complete
- Files changed: [list]
- Commit: [hash]
- Status: pass/fail
```
If resuming mid-phase, read the last checkpoint and continue from the next step.

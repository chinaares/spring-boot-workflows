# Rule 12: Telemetry (Optional)

If `telemetry.enabled` is `true` in `.workflows/config.yml` (or defaults), append to `.workflows/telemetry.jsonl` after each phase:
```json
{"ts":"<ISO-8601>","workflow":"<name>","feature":"<feature>","phase":"<phase>","status":"COMPLETED","files_changed":<count>,"replan":false}
```
- `ts`: record the ISO-8601 timestamp when the phase completes (single timestamp, not start/end pair)
- `files_changed`: get from `git diff --stat` (actual count, not estimated)
- Never block workflow execution on telemetry failures

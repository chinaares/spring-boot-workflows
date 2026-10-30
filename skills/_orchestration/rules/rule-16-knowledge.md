# Rule 16: Knowledge Extraction

After completing a workflow (Rule 5 step 6), if the workflow included a BRAINSTORM or PLAN phase, extract decisions to `.workflows/knowledge.jsonl`:

```json
{"date":"<ISO-8601>","workflow":"<type>","feature":"<name>","approach":"<chosen-approach>","constraints":["<constraint>"],"outcome":"success"}
```

During future BRAINSTORM phases, read `.workflows/knowledge.jsonl` and surface relevant past decisions. Match by workflow type or topic keywords against past `feature`/`approach` fields. Present up to 3 matches (newest first): "Past decision: <feature> used <approach> — <outcome>"

**Distinction from `/learn`**: Knowledge entries are structured data (JSON) for automated matching during brainstorming. `/learn` captures human-readable pattern descriptions (markdown) for manual browsing and application. They serve different retrieval needs.

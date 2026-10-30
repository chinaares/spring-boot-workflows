---
name: retrospective
description: "Analyze completed workflows to identify what worked, what didn't, and extract actionable improvements for future workflows."
rules: []
---

# Retrospective

```
/retrospective [--last <N>] [--workflow <name>]
```

- `--last <N>`: Analyze last N completed workflows (default: 5)
- `--workflow <name>`: Filter to specific workflow type

Analyzes completed workflow history to find patterns, bottlenecks, and improvement opportunities.

---

## Step 1: Gather Data

Read `.workflows/telemetry.jsonl` and `.workflows/history/` files. Parse:
- Workflow type, feature name, completion status
- Phase statuses (completed, skipped, failed)
- Replan events and their triggers
- Knowledge entries from `.workflows/knowledge.jsonl`
- Learned patterns from `.workflows/learned/`

## Step 2: Analyze Patterns

### What Worked
- Workflows that completed without replans
- Phases that were consistently completed (not skipped)
- Patterns that were reused (from learned patterns)

### What Didn't
- Workflows that failed or were abandoned
- Phases that triggered replans (and why)
- Phases that were consistently skipped (candidate for disabling)

### Bottlenecks
- Most replan-prone phase across workflows
- Most common error types from telemetry

## Step 3: Generate Recommendations

```
Retrospective (<N> workflows analyzed)
========================================

Wins:
  - <pattern that worked well>
  - <workflow type with high success rate>

Issues:
  - <recurring problem>
  - <phase that consistently causes trouble>

Recommendations:
  1. <actionable suggestion with config change>
  2. <process improvement>
  3. <skill or rule adjustment>

Config suggestions:
  <specific config.yml changes, e.g., "Set workflows.new-feature.require_brainstorm: false — skipped in 80% of runs">
```

## Step 4: Apply (Optional)

Ask: "Apply any of these config changes? (list numbers or 'skip')"

If user selects changes, update `.workflows/config.yml` accordingly.

Also auto-capture any new patterns via `/learn capture` if significant wins are identified.

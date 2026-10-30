---
name: metrics
description: Workflow execution metrics from telemetry data — completion rates, phase patterns, bottlenecks, and trends.
rules: []
---

# Workflow Metrics

```
/metrics
/metrics <workflow-name>
/metrics trends
```

**Data source**: `.workflows/telemetry.jsonl` (primary). Falls back to `.workflows/history/` if telemetry is empty.

---

## `/metrics` — Summary Dashboard

Read `.workflows/telemetry.jsonl`. Parse each JSON line. Aggregate:

```
Workflow Metrics
===================================
  Total workflows:     <N>
  Completion rate:     <N>% (<completed>/<total>)
  Most used:           <name> (<N> runs)
  Most replanned:      <name> (<N> replans)
  This week: <N>  |  This month: <N>

  By Workflow:
  -----------------------------------
  new-feature     ########..  8 runs  75% success
  hotfix          ####......  4 runs  100% success
  refactor        ##........  2 runs  50% success
```

## `/metrics <workflow-name>` — Per-Workflow Detail

Filter telemetry to matching workflow:

```
Metrics: new-feature
===================================
  Runs: <N>  |  Completed: <N>  |  Failed: <N>

  Phase Completion:
  -----------------------------------
  GATHER      ####..  8/8
  SPEC        ####..  8/8
  BRAINSTORM  ###...  6/8  (skipped: 2)
  PLAN        ####..  8/8
  IMPLEMENT   ######  8/8
  TEST        ####..  7/8
  PR          ##....  7/8

  Common replan triggers: <from telemetry replan=true entries>
```

## `/metrics trends` — Trend Analysis

Compare last 10 workflows vs previous 10:

```
Trends (last 10 vs previous 10):
  Success rate: +10% (90% vs 80%)
  REPLANs:      -40% fewer (3 vs 5)
  Skipped phases: BRAINSTORM skipped 60% — consider disabling
```

If fewer than 5 workflows: "Not enough data for trends."

## `/metrics health` — Workflow Health Score

Compute a single 0-100 health score from telemetry data:

```
Workflow Health: 78/100  ██████████████████░░░░░
─────────────────────────────────────────
  Completion rate:  90% (×0.40 = 36)
  Low replan rate:  70% (×0.30 = 21)
  Low skip rate:    80% (×0.20 = 16)
  Low abandon rate: 100% (×0.10 = 10)
  Deductions:       -5 (repeated failures in same phase)
```

**Formula**:
- `completion_score = (completed / total) × 40`
- `replan_score = (1 - replans / total_phases) × 30`
- `skip_score = (1 - skipped_phases / total_phases) × 20`
- `abandon_score = (1 - abandoned / total) × 10`
- `deductions`: -5 per phase that failed 3+ times across multiple workflows
- `health = completion_score + replan_score + skip_score + abandon_score + deductions` (clamped 0-100)

If fewer than 3 workflows: "Not enough data for health score. Complete 3+ workflows to enable."

---

## Fallback

If `telemetry.jsonl` is empty/missing, parse `.workflows/history/*.md` frontmatter. Note reduced accuracy.

If no data: "No workflow history found. Complete a workflow to start tracking."

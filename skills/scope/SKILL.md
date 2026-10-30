---
name: scope
description: "Analyze a task's complexity and recommend the right workflow, depth, and splitting strategy before starting work."
rules: []
---

# Scope Analysis

```
/scope <description>
```

Quick pre-flight analysis. Estimates complexity, recommends which workflow to use, and suggests splitting if the task is too large. Run this BEFORE choosing a workflow when you're unsure.

---

## Step 1: Analyze the Request

Parse the description. Scan the codebase for related files:

1. **Identify affected files**: Search for files related to the feature/change
2. **Count layers touched**: data, domain, presentation, config, tests
3. **Check for breaking changes**: public API modifications, schema changes, dependency updates
4. **Estimate scope**:

| Signal | Size | Recommended Workflow |
|--------|------|---------------------|
| 1-2 files, no new APIs | **Trivial** | Direct edit (no workflow needed) |
| 3-10 files, 1-2 layers | **Small** | `/new-feature --depth trivial` or `/extend-feature` |
| 10-25 files, 2-3 layers | **Medium** | `/new-feature` (standard) |
| 25-50 files, 3+ layers | **Large** | `/new-feature` (complex) — consider splitting |
| 50+ files or breaking changes | **Epic** | Must split into multiple workflows |

## Step 2: Splitting Recommendations (if Large/Epic)

If the task is Large or Epic, suggest concrete splits:

```
This task touches ~<N> files across <N> layers.
Recommended split:

1. "<sub-task-1>" — <files>, <workflow>
   Depends on: nothing (start here)
2. "<sub-task-2>" — <files>, <workflow>
   Depends on: #1
3. "<sub-task-3>" — <files>, <workflow>
   Depends on: #1

Order: 1 → 2 → 3 (can parallelize 2 and 3 after 1)
```

## Step 3: Report

```
Scope Analysis: <description>
================================
  Estimated size:    <Trivial|Small|Medium|Large|Epic>
  Files affected:    ~<N>
  Layers:            <list>
  Breaking changes:  yes/no
  Recommendation:    <workflow + flags>
  Split needed:      yes/no
```

Ask: "Ready to start? I'll launch `<recommended-command>`."

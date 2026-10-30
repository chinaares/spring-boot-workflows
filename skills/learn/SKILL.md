---
name: learn
description: "Extract and store successful workflow patterns for reuse. Surfaces relevant patterns during brainstorming to accelerate decisions."
rules: []
---

# Pattern Learning

```
/learn capture
/learn list
/learn apply <topic>
```

Extracts reusable patterns from completed workflows, stores as markdown in `.workflows/learned/`. Patterns with 2+ reuses are marked **proven**.

**Prerequisite**: `learning.enabled` must be `true` in `.workflows/config.yml`. If disabled, inform user and exit.

**Distinction from knowledge.jsonl**: `/learn` stores human-readable pattern descriptions for manual browsing. `knowledge.jsonl` (Rule 16) stores structured decision data for automated matching during brainstorming.

---

## `/learn capture` — Extract Patterns from Last Workflow

1. Find the most recent file in `.workflows/history/` and read its phase output documents.
2. Extract patterns: architecture decisions (BRAINSTORM/PLAN), implementation patterns (IMPLEMENT), testing strategies (TEST), problem resolutions (any phase).
3. Store each as a markdown file in `.workflows/learned/<pattern-name>.md`:

```markdown
# Pattern: <name>
Category: <architecture|implementation|testing|resolution>
Reused: 0
Tags: <tag1>, <tag2>

## Description
<what and when to use>

## Source
<history filename>
```

Print: `Captured <N> patterns from <workflow-name>.`

---

## `/learn list` — Show All Patterns

Read all `.md` files in `.workflows/learned/`. Sort by reuse count descending:

```
Learned Patterns (<N> total):
  * event-driven-state — Use event-driven state for complex forms
    Category: architecture | Reused: 4 | Tags: state, forms
    snapshot-testing — Compose snapshot tests for UI regression
    Category: testing | Reused: 0 | Tags: ui, testing

  * = proven (2+ reuses)
```

---

## `/learn apply <topic>` — Find Relevant Patterns

1. Load patterns from `.workflows/learned/`. Match by tag, name/description keywords, category.
2. Present top 5 by relevance then reuse count.
3. If selected, increment `Reused` count in the pattern file.

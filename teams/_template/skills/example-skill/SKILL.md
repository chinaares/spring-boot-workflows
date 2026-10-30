---
name: example-skill
description: Brief description of what this skill does and when to use it.
---

# Skill Name

## Command

```
/example-skill <required-arg> [--optional-flag]
```

## Overview

One paragraph explaining what this skill does, when a developer would use it,
and what the end result looks like.

Phases: **ANALYZE -> IMPLEMENT -> VERIFY**

---

## Phase 1: ANALYZE

**Goal**: Understand the current state before making changes.

### Step 1.1 — Discover Existing Patterns

```bash
# Find relevant files in the codebase
grep -rl "pattern-to-find" --include="*.kt" src/
```

Identify:
- Where similar things already exist
- What naming conventions are used
- What dependencies are involved

### Step 1.2 — Read Configuration

From `.claude/workflows.yml`, get:
- `project.language`: To determine file extensions and patterns
- Any relevant workflow-specific config

---

## Phase 2: IMPLEMENT

**Goal**: Make the changes following established patterns.

### Step 2.1 — Create/Modify Files

Describe exactly what files to create or modify, with code templates:

```kotlin
// Example template — replace with your language
class ExampleClass {
    // Follow existing patterns found in Phase 1
}
```

### Step 2.2 — Build Check

```bash
# Verify the project still compiles
# Use the project's actual build command from workflows.yml
```

---

## Phase 3: VERIFY

**Goal**: Confirm the change is correct and complete.

### Step 3.1 — Checklist

- [ ] Follows existing naming conventions
- [ ] No duplicate definitions
- [ ] Compiles without errors
- [ ] Add your team-specific checks here

---

## Error Handling

- If pattern not found in codebase: "Could not find existing <X>. Specify the location manually."
- If naming conflict: "<Name> already exists at <path>. Choose a different name."

---
name: compose-skill
description: Interactively create a custom workflow skill with proper structure, frontmatter, phases, and orchestration integration.
rules: []
---

# Skill Composer

```
/compose-skill <name>
```

Interactively build a new workflow skill for your project.

---

## Step 1: Gather Requirements

Ask sequentially:
1. "What does this skill do? (1-2 sentences)"
2. "What are the phases? List them in order (e.g., ANALYZE, PLAN, EXECUTE, VERIFY)"
3. For each phase: "What should **<phase>** produce? (1 sentence)"
4. "Does this skill need brainstorming? (y/n)"
5. "Does this skill create a PR at the end? (y/n)"
6. "Which orchestration rules apply?" — suggest based on answers:
   - Always: `[0, 1]` (state + output)
   - If has PR: add `3, 5` (quality gate + completion)
   - If multi-step execution: add `7, 11` (REPLAN + checkpoints)
   - If brainstorm: add `2` (skip support)

## Step 2: Determine Output Location

Ask: "Where should this skill live?"
- **Project-local** (default): `.workflows/skills/<name>/SKILL.md` — only available in this project
- **Team-shared**: `<plugin-root>/teams/<team>/skills/<name>/SKILL.md` — if team is configured

## Step 3: Generate Skill

Write the skill file with proper structure:

```markdown
---
name: <name>
description: "<user's description>"
rules: [<selected-rules>]
---

# <Name> Workflow

## Command

/<name> <target> [flags based on phases]

> Follow orchestration Rules <list> for state and output. Rule 5 handles completion after the last phase.

---

<For each phase:>

## Phase N: <PHASE-NAME>

**Goal**: <what this phase produces>

### Execute

<Placeholder instructions — fill in the details>

**>> Write output to**: `.workflows/<target>/NN-<phase>.md`

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Target not found | Ask user for correct name or path |
| Build fails | Fix and retry, REPLAN after 3 failures |
```

## Step 4: Validate

1. Verify file was written
2. Check phase output numbering is sequential
3. Verify frontmatter has required fields
4. Print summary with location and next steps

## Step 5: Register (Optional)

Ask: "Add an alias for this skill? (e.g., /audit → /spring-boot-workflows:<name>)"
If yes, suggest adding to `skills.aliases` in `.workflows/config.yml`.

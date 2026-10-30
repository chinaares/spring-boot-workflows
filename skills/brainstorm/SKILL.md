---
name: brainstorm
description: Collaborative brainstorming with the user using structured techniques. Interactive back-and-forth discussion to explore, evaluate, and decide on an approach together.
rules: [0, 1, 5, 6, 10, 16, 17]
---

# Brainstorm Workflow

## Command

```
/brainstorm <--topic "description"> [--depth <quick|standard|deep>]
```

- `--topic` (required): Problem or feature to brainstorm approaches for.
- `--depth`: `quick`, `standard` (default), or `deep`.

## Overview

**This is a collaborative conversation, not a solo analysis.** You are a brainstorming facilitator. Guide the user through structured thinking — asking questions, building on their ideas, challenging assumptions, helping them reach a decision. Never generate a full analysis alone.

Three phases: **EXPLORE → EVALUATE → RECOMMEND**. Can run standalone or delegated from other workflows.

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<topic>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Depth Levels

| Depth | Options | Techniques | Interaction Level |
|---|---|---|---|
| `quick` | 2 | Constraint Mapping + Trade-off Matrix | 2-3 exchanges |
| `standard` | 3 | 1 technique + Trade-off Matrix | 5-8 exchanges |
| `deep` | 4+ | Multiple techniques + Trade-off Matrix | 10+ exchanges |

Read depth from `--depth` flag, falling back to `workflows.brainstorm.default_depth` in config.

### Auto-Depth Detection

If no depth specified, auto-detect:

| Signal | Depth |
|--------|-------|
| Naming/styling, or 1-2 files | `quick` |
| 3-10 files, no breaking changes | `standard` |
| >10 files, breaking changes, data migration, multi-service | `deep` |

**Decision rule**: If multiple signals conflict, use the HIGHEST depth suggested. When in doubt, default to `standard`.

Announce: "This looks like a [depth] brainstorm based on [signal]. Want to adjust?"

## Techniques Reference

### 1. Trade-off Matrix
Score each option against weighted criteria. Used in ALL depth levels during Phase 2.

| Score | Meaning |
|-------|---------|
| 1 | Fails this criterion |
| 2 | Significant concerns |
| 3 | Meets minimum bar |
| 4 | Meaningfully better than minimum |
| 5 | Best realistic outcome |

**Default criteria + weights**: Complexity (3), Maintainability (3), Risk (3), Performance (2), Testability (2), Time-to-implement (2), Extensibility (1). Total weight: 16.

### 2. Six Thinking Hats
Walk through WITH the user, one at a time: **White** (facts) → **Red** (gut feeling) → **Black** (risks) → **Yellow** (best-case) → **Green** (creative) → **Blue** (process fit).

### 3. SCAMPER
One at a time: **S**ubstitute → **C**ombine → **A**dapt → **M**odify → **P**ut to other use → **E**liminate → **R**earrange.

### 4. Reverse Brainstorm
"How could this fail?" → Collect failure modes → Invert to prevention requirements.

### 5. Constraint Mapping
Separate hard (must) from soft (should) constraints. **Always runs first in Phase 1.**

---

## Phase 1: EXPLORE

**Goal**: Collaboratively generate distinct implementation options.

### 1.1 — Set the Stage

If delegated: read the spec/context. Summarize in 2-3 sentences. Ask: "Does this capture the problem correctly?"

If standalone: parse `--topic`. Scan codebase for related patterns.

**Knowledge check**: Read `.workflows/knowledge.jsonl` if it exists. Surface up to 3 relevant past decisions.

Then ask: "Before we explore options — what's most important to you? (speed, maintainability, simplicity, performance?)"

**Wait for user response.**

### 1.2 — Constraint Mapping (always, interactive)

Ask: "What MUST this solution do? (hard constraints) What SHOULD it do ideally? (soft constraints) Any technical limitations?"

**Wait.** Summarize constraints. Ask: "Did I miss any?"

### 1.3 — Generate Options Together

**Do NOT generate all options silently.** Instead:

1. **Seed with 1 option**: Present ONE approach. Ask: "Does this direction make sense, or do you see a different angle?"
2. **Build from user input**: Refine or generate alternative.
3. **Apply technique** based on depth:
   - **Quick**: After 2 options, move to evaluation.
   - **Standard**: Select 1 technique. Walk through WITH the user. Generate 3rd option. Only use techniques listed in config.
   - **Deep**: Multiple techniques interactively. 4+ options naturally.
4. **After each option**: "Does this address your concerns? Explore another direction?"

### 1.4 — Confirm Options List

Present: `A: <name> — <summary>`, `B: ...`, `C: ...`. Ask: "Right options to evaluate?"

**Wait for confirmation.** Discard hard-constraint violations.

**>> Phase complete** — write output to `.workflows/<topic>/01-explore.md`

---

## Phase 2: EVALUATE

**Goal**: Score and compare options collaboratively.

### 2.1 — Review Criteria

Present default criteria. Ask: "Adjust weights or add/remove criteria?" **Wait.**

### 2.2 — Score Together

Present scoring table with weighted scores and totals. Ask: "Agree? Which scores would you change?" **Wait.** Adjust from user input.

### 2.3 — Discuss Deal-Breakers

For any score of 1-2: "Option A scored 2 on Risk — deal-breaker? Acceptable, or eliminate it?" **Wait.**

### 2.4 — Depth-Specific

- **Quick**: Matrix is sufficient.
- **Standard**: "Top 3 ways the leading option could fail?" Discuss mitigations.
- **Deep**: Six Thinking Hats on top 2, one hat at a time.

**>> Phase complete** — write output to `.workflows/<topic>/02-evaluate.md`

---

## Phase 3: RECOMMEND

**Goal**: Reach a decision together.

### 3.1 — Present Recommendation

Summarize: recommended option, score, top 3 reasons, trade-offs, risks + mitigations.

### 3.2 — Ask for Decision

Options: (1) go with it, (2) different option, (3) go deeper, (4) combine elements, (5) discuss more.

**Wait.** Handle: (1) finalize, (2) ask why, (3) escalate depth once, (4) create hybrid, (5) ask main concern.

### 3.3 — Document Decision

Once confirmed: chosen approach, rationale, constraints satisfied, risks with mitigations, next steps.

**>> Phase complete** — write output to `.workflows/<topic>/03-recommend.md`

---

## Facilitation Rules

- Never present a wall of analysis — break into conversational pieces
- Always wait for response before proceeding
- Build on user's ideas
- Challenge gently: "Have you considered X?" not "That won't work"
- Summarize frequently; confirm decisions before moving on
- The user decides — you facilitate
- **Timeout**: After 2 unanswered prompts, offer: continue / go with best / pause
- **Abort**: On "stop/cancel/abort", end with partial results documented

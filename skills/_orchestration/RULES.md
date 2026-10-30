# Orchestration Rules

> **Primary execution protocol**: `<plugin-root>/PROTOCOL.md` — auto-injected at session start via hooks. It contains the core state management, phase output, and skip governance rules that apply to every workflow.
>
> **Detailed rules**: Individual rule files in `<plugin-root>/skills/_orchestration/rules/rule-NN-*.md` provide extended behavior. Each skill's frontmatter `rules` list indicates which apply.
>
> **Always-available rules**: Rules 8 (common errors) and 14 (dry-run) apply to ALL skills regardless of the `rules` list.

## Quick Reference

| Rule | File | Purpose |
|------|------|---------|
| 0 | rule-00-state-init.md | State init — create `.workflows/current-state.md` |
| 1 | rule-01-phase-output.md | Phase output + preconditions + state update |
| 2 | rule-02-skip-phases.md | Skip phases per config flags |
| 3 | rule-03-quality-gate.md | Language rules before code, proportional review before PR |
| 4 | rule-04-build-detection.md | Auto-detect build/test commands |
| 5 | rule-05-completion.md | Archive state, chain, extract knowledge |
| 6 | rule-06-pause.md | Save progress to paused file |
| 7 | rule-07-error-recovery.md | RETRY/REPLAN protocol |
| 8 | rule-08-common-errors.md | gh auth, dirty tree, branch conflicts *(always-available)* |
| 9 | rule-09-skill-composition.md | Execute another skill inline |
| 10 | rule-10-phase-statuses.md | ACTIVE, COMPLETED, SKIPPED, FAILED, RETRY |
| 11 | rule-11-checkpoints.md | Mid-phase progress tracking |
| 12 | rule-12-telemetry.md | Append to telemetry.jsonl (optional) |
| 13 | rule-13-focused-gate.md | Weight checks by changed file categories |
| 14 | rule-14-dry-run.md | Preview plan without side effects *(always-available)* |
| 15 | rule-15-chaining.md | Suggest next workflow after completion |
| 16 | rule-16-knowledge.md | Store decisions to knowledge.jsonl |
| 17 | rule-17-visual-progress.md | Mermaid diagrams in state file |

## Path Resolution

All skills reference files relative to the **plugin root** (where this RULES.md lives). To resolve paths:
1. This file is at `<plugin-root>/skills/_orchestration/RULES.md`
2. Determine `<plugin-root>` by removing `/skills/_orchestration/RULES.md` from this file's path
3. Use `<plugin-root>` wherever skills reference plugin-bundled files (rules, reviews, templates, teams, config)

For project config: read `.workflows/config.yml` in the project root. If it doesn't exist, use `<plugin-root>/config/defaults.yml`.

For user plugin settings: passed as context when the plugin is invoked (project_type, team, git_main_branch, git_dev_branch, commit_format). They serve as fallback when config.yml doesn't specify a value.

**Precedence** (highest wins): CLI flags → `.workflows/config.yml` → user plugin settings → `<plugin-root>/config/defaults.yml`

## Instruction Priority

When instructions conflict: **Skill > Rule > Config defaults**. Skills define workflow-specific behavior; rules provide cross-cutting defaults. If a skill says "max 3 attempts" and a rule says "REPLAN after 3 failures", the skill's instruction applies to that workflow.

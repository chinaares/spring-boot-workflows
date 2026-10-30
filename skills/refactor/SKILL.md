---
name: refactor
description: Safely refactor code with dependency graph mapping, behavioral contracts, incremental migration, and rollback at every step.
rules: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17]
---

# Refactor Workflow

`/refactor <target> [--scope <file|module|feature>] [--goal <description>] [--skip-brainstorm] [--auto]`

**Targets**: `class:Name`, `file:path/to/file`, `module:name`, `feature:name`

Restructure existing code while preserving all external behavior. **Phases**: ANALYZE → BRAINSTORM → CONTRACT → DESIGN → MIGRATE → VERIFY → PR.

**Core principle**: Identical outputs for identical inputs. Every step must compile and pass tests. Breaks behavior → roll back.

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<target>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases unless config allows. NEVER stop after migration — continue ALL remaining phases.**

---

## Phase 1: ANALYZE

**Goal**: Build complete dependency graph and assess blast radius.

1. **Identify target** — Locate definition and all related files
2. **Map inbound deps** — All consumers: direct callers, subclasses, DI consumers, test consumers
3. **Map outbound deps** — Imports: libraries, project modules, system resources
4. **Map public API surface** — Every public member: functions, properties, types
5. **Measure current state** — LOC, public member count, complexity estimate, dependent count, test coverage

**>> Phase complete** — write output to `.workflows/<target>/01-analyze.md`

---

## Phase 2: BRAINSTORM

**Skip if**: `--skip-brainstorm` OR `workflows.refactor.require_brainstorm` is `false`. Mark `SKIPPED`, proceed to Phase 3.

Run brainstorm inline (Rule 9): Constraint Mapping → Generate Options → Trade-off Matrix (blast radius as highest weight) → Recommend. Lowest blast radius wins ties.

**>> Phase complete** — write output to `.workflows/<target>/02-brainstorm.md`

---

## Phase 3: CONTRACT

**Goal**: Document exact behavioral contract BEFORE changing any code.

Document: **Invariants** (I/O pairs, side effects, error conditions), **Public API** (signatures that must not change), **Performance** (latency/memory bounds), **Threading** (context/dispatcher requirements), **Test coverage** (count, gaps).

Map every test assertion to an invariant. Missing coverage → add tests BEFORE refactoring.

Present contract. Ask: "Does this capture all expected behaviors?"

**>> Phase complete** — write output to `.workflows/<target>/03-contract.md`

---

## Phase 4: DESIGN

**Goal**: Create incremental migration plan where every step compiles and passes tests.

1. Describe post-refactor target state
2. Plan migration steps in `.workflows/<target>/plan.md` (this standalone file is the executable plan, referenced by MIGRATE and resume. The phase output `04-design.md` captures the design summary and approval). Each step: action, files, compile command, test command, rollback command, commit message.
3. Estimate blast radius per step

**Migration safety**: Never delete old code until new code is proven. Use deprecation during transition. Full test suite after each step. Test failure → revert immediately.

Present plan. Ask: "Approve migration plan or request changes?"

**>> Phase complete** — write output to `.workflows/<target>/04-design.md`

---

## Phase 5: MIGRATE

**Goal**: Execute migration step by step with strict verification.

Per step: Read → Implement (this step ONLY) → Compile (fail → revert, max 3, then REPLAN) → Test full suite (fail → revert) → Contract check → Commit → Record rollback hash.

**Parallel deprecation**: Create new alongside old → mark old deprecated → migrate consumers → delete old → verify no references.

**>> Phase complete** — write output to `.workflows/<target>/05-migrate.md`

**>> CONTINUE** — migration is NOT the end. Proceed to VERIFY, then PR. Update state and continue.

---

## Phase 6: VERIFY

**Goal**: Prove the refactoring preserves all behavior.

1. Full test suite — zero tolerance
2. Contract verification — each invariant: VERIFIED or FAILED
3. Metrics comparison — before/after: LOC, public members, dependents, test count
4. Cleanup check — no deprecation markers, unused imports, dead code, refactor TODOs

**>> Phase complete** — write output to `.workflows/<target>/06-verify.md`

---

## Phase 7: PR

**Quality gate** (Rule 3): proportional review. Confirm all tests pass, all contract invariants VERIFIED, no deprecation markers remain.

PR body: summary, motivation, approach, contract verification, per-step changes, metrics table, rollback plan (`git revert <first>..<last>`).

**>> Phase complete** — write output to `.workflows/<target>/07-pr.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| Target exceeds `max_dependents` (default 50) | Warn; split into smaller refactors or get confirmation |
| No tests exist for target | Write contract-based tests first, then refactor |
| Circular dependencies | Address as separate prerequisite refactor |
| Performance regression | Profile, optimize, or revert |
| Migration step breaks unrelated test | Investigate transitive dependency; likely hidden coupling |

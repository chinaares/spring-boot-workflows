---
name: test
description: Generate comprehensive tests for a target class, file, module, or feature with coverage analysis, boundary classification, and gap reporting.
rules: [0, 1, 3, 4, 5, 6, 7, 10, 11, 12, 17]
---

# Test Workflow

```
/test <target> [--coverage <pct>] [--type <unit|integration>]
```

**Targets**: `class:Name`, `file:path/to/file`, `module:name`, `feature:name` | **Defaults**: coverage from `workflows.test.default_coverage` in config (default 90%), type=unit

**Before starting**: Read `<plugin-root>/rules/` for language-specific testing conventions. Scan build files to detect test framework, runner, mocking library, and coverage tooling.

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<target>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: ANALYZE

### 1.1 Locate Target
- `class:Name` — search source tree for class/interface definition
- `file:path` — read directly
- `module:name` — find module source root, list public types
- `feature:name` — find feature directory, map all classes

### 1.2 Extract Public API
For each target: public functions (params, return type, nullability), properties/fields, constructors/dependencies, observable state (streams, callbacks), type hierarchies, static members.

### 1.3 Categorize Dependencies

| Category | Mock Strategy |
|---|---|
| Interface/protocol | Mock or fake implementation |
| Framework class | Test double or test runtime |
| External service (network, DB) | Mock or in-memory substitute |
| Side-effect only (logger, analytics) | Mock, verify calls |
| Pure data (models, DTOs) | Real instances — NEVER mock |

### 1.4 Map Code Branches
Per public function, identify: **happy path** (success), **error paths** (exceptions, error states, null returns), **edge cases** (empty collections, boundary values, null inputs), **concurrency** (races, cancellation, timeouts), **state-dependent** (behavior varies with current state).

Document as branch map:
```
functionName(params)
  1. valid input -> success
  2. empty input -> validation error
  3. dependency throws -> error propagation
  4. concurrent calls -> serialization/dedup
```

### 1.5 Check Existing Tests
Search for existing test files. If found, document covered branches and identify gaps against 1.4.

**>> Phase complete** — write output to `.workflows/<target>/01-analyze.md`.

---

## Phase 2: PLAN

### 2.1 Test Boundaries
**Inside** (test directly): target class logic. **Outside** (mock): injected deps, framework classes, system resources. **Never mock**: data classes, pure functions, value objects.

### 2.2 Test Case List
Tag each case: `[HAPPY]` success paths, `[ERROR]` error returns/exceptions, `[EDGE]` boundary conditions (empty/null/zero/max), `[STATE]` state-dependent behavior, `[INTEGRATION]` cross-boundary with real deps.

### 2.3 Coverage Estimate
Count total branches vs planned tests. If expected coverage < target, add cases.

### 2.4 File Structure
Group tests by function/behavior. For `module:` or `feature:` targets, plan multiple files.

**>> Phase complete** — write output to `.workflows/<target>/02-plan.md`.

---

## Phase 3: WRITE

### 3.1 Test Infrastructure
Detect from build files: test framework, mocking library, assertion library, async utilities, coverage tool.

### 3.2 Write Tests
Structure: mocks/fakes -> SUT setup -> test groups by behavior -> Given/When/Then in every test. Naming: `given <precondition> when <action> then <outcome>` in language-idiomatic format.

### 3.3 Edge Cases
Include where applicable: null/nil/undefined, empty collections, boundary values, cancellation/timeout for async, rapid sequential calls.

### 3.4 Compile/Lint
Run build or lint. Fix any compilation errors in test code.

**>> Phase complete** — write output to `.workflows/<target>/03-write.md`.

---

## Phase 4: VERIFY

### 4.1 Run New Tests
All must pass. On failure: if test is wrong, fix it; if code has a bug, report to user (do NOT fix production code unless asked).

### 4.2 Run Full Suite
Verify new tests don't break existing tests.

### 4.3 Quality Check
Each test: tests ONE behavior, uses Given/When/Then naming, mocks only outside boundary, is deterministic, tests behavior not implementation details.

### 4.4 Coverage
Run coverage tool if available. Compare against target from `--coverage` flag or `workflows.test.default_coverage` in config.

**>> Phase complete** — write output to `.workflows/<target>/04-verify.md`.

---

## Phase 5: REPORT

### 5.1 Summary
```
Test Report: <target>
  Test file(s):   <path(s)>
  Written/Passing: <N>/<N>
  Coverage:        <pct>% (target: <pct>%)
  Breakdown:       <happy> happy, <error> error, <edge> edge, <state> state
  Uncovered:       <list of uncovered branches>
  Gaps:            <scenario: reason>
  Quality Notes:   <observations>
```

### 5.2 Gap Analysis
If below target: list each gap with reason and recommendation (needs integration test, dead code, requires refactor to test).

### 5.3 Commit
```bash
git add <test-files>
git commit -m "test(<scope>): add tests for <target> (<coverage>% coverage)"
```

**>> Phase complete** — write output to `.workflows/<target>/05-report.md`.

Rule 5 handles completion after the last phase.

---

## Error Handling

| Error | Resolution |
|---|---|
| Target not found | Ask user for correct name or path |
| No test framework detected | Suggest adding test deps for the language |
| Cannot achieve coverage target | Report gaps; ask user to accept or adjust |
| Flaky test | Identify non-determinism and fix |

## Anti-Patterns

Do NOT: test private methods (use public API), mock data classes/value objects, depend on execution order, use real delays/sleeps, assert on implementation details, write always-passing tests, or hardcode environment-specific paths.

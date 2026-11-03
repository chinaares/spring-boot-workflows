---
name: verify
description: Run the full Spring Boot verification loop before a PR — build, static analysis (SpotBugs/PMD/Checkstyle), unit and Testcontainers integration tests with a JaCoCo coverage gate, OWASP dependency CVE scan, secret scan, and diff review — producing a PASS/FAIL readiness report with evidence.
rules: [3, 4]
---

# Verification Loop

```
/spring-boot-workflows:verify
  [--quick]              # build + test + coverage only
  [--strict]             # warnings fail the gate
  [--base <branch>]      # diff base (default: config git.pr.base_branch)
  [--skip <check>]       # skip one of: build, static, test, coverage, security, diff
  [--dependency-scan]    # force the OWASP scan (slow, needs network)
  [--dry-run]            # print the plan, run nothing
```

**Seven phases**: DETECT → BUILD → STATIC → TEST → SECURITY → DIFF → REPORT

Run this before opening a pull request, after a dependency upgrade or a large
refactor, and before a release. It answers one question: **is this change safe
to ship?** — and answers it with evidence, not opinion.

**Before starting**: Read `<plugin-root>/skills/verify/references/security-checks.md`
for the scan patterns, and `<plugin-root>/config/defaults.yml` (the `verify:` section).

---

## Step 0: Initialize Workflow (DO THIS FIRST)

**If another workflow is active** — `.workflows/current-state.md` exists and names a
different workflow — do **not** create a second state file. Run this skill as a
composed sub-step (Rule 9): write the report to the active workflow's output
directory as `verify-report.md` plus `verify-findings.json`, do not create or
modify the state file, and do not advance the active workflow's phase.

**Otherwise** create `.workflows/verify/` and `.workflows/current-state.md`
following the execution protocol — YAML frontmatter with workflow name `verify`,
feature `verification`, first phase ACTIVE, all phases list, timestamps,
replan_count=0. Add the `## Phase History` table and the `## Context` section.
Read `.workflows/config.yml` for project settings. **Verify the state file exists
before Phase 1.**

**After EVERY phase**: write the output file and update the state file (advance
phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases**
except the ones the user excluded with `--skip`.

---

## Phase 1: DETECT

**Goal**: Know exactly what will be run, and against what baseline — before
running anything.

### 1.1 — Build System and Wrapper

Apply Rule 4. Resolve the build tool and the wrapper-first command:

| System | Build | Test |
|---|---|---|
| Maven | `./mvnw -B clean verify -DskipTests` | `./mvnw -B verify` |
| Maven (no wrapper) | `mvn -B clean verify -DskipTests` | `mvn -B verify` |
| Gradle | `./gradlew assemble -x test` | `./gradlew test` |
| Gradle (no wrapper) | `gradle assemble -x test` | `gradle test` |

If a `mvnw`/`gradlew` exists but is not executable, run it via `sh ./mvnw …` —
never silently fall back to the system tool.

### 1.2 — Declared Quality Tooling

Read the build file and record which of these are **declared by the project**:

| Plugin | Enables | Notes |
|---|---|---|
| `jacoco-maven-plugin` | coverage gate | needs a `report` goal to produce `target/site/jacoco/jacoco.xml` |
| `spotbugs-maven-plugin` | SpotBugs check | needs `spotbugs:check` to be bound or invoked |
| `maven-pmd-plugin` | PMD check | needs `pmd:check` |
| `maven-checkstyle-plugin` | Checkstyle check | needs `checkstyle:check` |
| `dependency-check-maven` (OWASP) | CVE scan | slow; needs the NVD API |

For Gradle, the equivalents are the `jacoco`, `spotbugs`, `pmd`, `checkstyle`,
and `dependency-check` plugins.

**A check whose plugin is not declared is SKIPPED, never silently passed.**
Record it as `SKIPPED — <plugin> not declared in the build file` and include the
exact snippet to add it (see
`<plugin-root>/skills/verify/references/maven-quality-plugins.md`).

### 1.3 — Configuration

Read `verify:` from `.workflows/config.yml`, falling back to
`<plugin-root>/config/defaults.yml`:

| Key | Meaning | Default |
|---|---|---|
| `verify.checks` | which checks to run | `[build, static, test, coverage, security, diff]` |
| `verify.coverage_threshold` | minimum line coverage percent | `80` |
| `verify.coverage_scope` | `line` or `branch` | `line` |
| `verify.static_analysis` | which analyzers to run | `[spotbugs, pmd, checkstyle]` |
| `verify.static_fail_on` | `error` or `warning` | `error` |
| `verify.dependency_scan` | run the OWASP CVE scan | `true` |
| `verify.secret_scan` | run the secret scan | `true` |
| `verify.findings_file` | structured findings filename | `findings.json` |

The `checks` list maps onto the phases like this — `coverage` is a **sub-check
of the TEST phase**, not a phase of its own:

| `verify.checks` entry | Phase |
|---|---|
| `build` | Phase 2 — BUILD |
| `static` | Phase 3 — STATIC |
| `test` | Phase 4 — TEST (the suite) |
| `coverage` | Phase 4 — TEST (the coverage gate, 4.3) |
| `security` | Phase 5 — SECURITY |
| `diff` | Phase 6 — DIFF |

A check that is not in the list is reported `SKIPPED — not in verify.checks`.
Phase 1 (DETECT) and Phase 7 (REPORT) always run.

### 1.4 — Diff Baseline

Resolve the comparison base: `--base` flag → `git.pr.base_branch` from config →
`git merge-base HEAD <git.branches.main>`. Record the resolved base and the
changed-file count:

```bash
git diff --name-only <base>...HEAD
```

**>> Phase complete** — write output to `.workflows/verify/01-detect.md`

---

## Phase 2: BUILD

**Goal**: The code compiles and packages, with tests skipped.

```bash
./mvnw -B clean verify -DskipTests
```

A build failure here is a **hard stop**: do not run the remaining checks. Report
the failing module and the first error, and go to the error table at the end of
this skill.

**>> Phase complete** — write output to `.workflows/verify/02-build.md`

---

## Phase 3: STATIC

**Goal**: Find bugs the compiler cannot see.

Run only the analyzers that are both **configured** in `verify.static_analysis`
**and declared** in the build file (Phase 1.2):

```bash
./mvnw -B spotbugs:check
./mvnw -B pmd:check
./mvnw -B checkstyle:check
```

For each analyzer record:

- **PASS** — the goal succeeded, no violations above the threshold
- **FAIL** — violations found; list each as `file:line — rule — message`
- **SKIPPED** — the plugin is not declared in the build file (give the snippet)
- **ERROR** — the goal itself failed (misconfiguration, not a code defect); say so
  explicitly rather than reporting it as a code finding

Severity handling follows `verify.static_fail_on`: with `error` (the default)
only high-severity findings fail the gate; with `warning`, every finding does.
When `--strict` is passed, treat warnings as failures regardless of the setting.

**Do not fix findings inside this skill.** Report them. Fixing belongs to
`/refactor` or `/new-feature`.

**>> Phase complete** — write output to `.workflows/verify/03-static.md`

---

## Phase 4: TEST

**Goal**: Every test passes, and coverage clears the bar.

### 4.1 — Run the Suite

```bash
./mvnw -B verify
```

This runs unit tests (Surefire) and, when the build binds them, integration
tests (Failsafe, Testcontainers). If integration tests need CI-only
configuration or secrets, they will fail here — report that as an environment
problem, not a code defect, and offer the `--skip-it` escape hatch.

### 4.2 — Count the Results

Parse the XML reports and record exact numbers — never estimate:

| Source | Files |
|---|---|
| Unit tests | `target/surefire-reports/*.xml` |
| Integration tests | `target/failsafe-reports/*.xml` |

Report **total / passed / failed / errors / skipped**. A failed or errored test
fails the gate.

### 4.3 — Coverage Gate

Only if `jacoco-maven-plugin` is declared:

```bash
./mvnw -B jacoco:report
```

Parse `target/site/jacoco/jacoco.xml` and sum the **report-level** counters
(direct children of `<report>`) — do not sum the per-class ones, or every class
is counted twice:

```xml
<report>
  <counter type="LINE"   covered="812" missed="188"/>
  <counter type="BRANCH" covered="301" missed="199"/>
</report>
```

```
coverage = covered / (covered + missed) × 100
```

Compare against `verify.coverage_threshold` using `verify.coverage_scope`
(`line` or `branch`):

- `coverage >= threshold` → **PASS**
- `coverage < threshold` → **FAIL**, and list the worst-covered classes
  (highest `missed` counter per class) so the gap is actionable
- No JaCoCo declared → **SKIPPED**, with the snippet to add it

> `jacoco:check` is **not** used for the gate. It only fails when the build file
> already carries a `<rules>` block with a `<minimum>`, so it silently passes on
> most projects. Parsing the report makes the gate real everywhere.

**>> Phase complete** — write output to `.workflows/verify/04-test.md`

---

## Phase 5: SECURITY

**Goal**: No known CVEs in the dependency tree, no secrets in the diff.

### 5.1 — Dependency CVE Scan

The OWASP Dependency-Check analyzer is **slow** (it downloads the NVD, takes
10+ minutes on a cold cache) and needs network access. Run it when:

- `verify.dependency_scan` is `true` **and** the plugin is declared in the build
  file, or `--dependency-scan` was passed; **and** the user confirmed — ask
  before a first run, because it is slow and needs an NVD API key to be usable.

```bash
./mvnw -B org.owasp:dependency-check-maven:check
```

Report each finding as `CVE-id — severity — dependency — fixed-in-version`.
Without an NVD API key the scan is unreliable — say so rather than reporting
a clean result.

**SKIPPED** is a legitimate outcome. Record the reason exactly:
`SKIPPED — OWASP plugin not declared` or `SKIPPED — user declined (slow scan)`.

### 5.2 — Secret Scan

Scan the changed files (and the whole of `src/` when the diff is small) for
credential patterns. The pattern list, the false-positive handling, and the
scan commands are in
`<plugin-root>/skills/verify/references/security-checks.md`.

If `.workflows/guards.yml` exists, also apply its `block_patterns` and
`no_commit_patterns` to the same file set — one scan, one verdict.

Any real credential is a **hard fail**. Redact the value in the report — never
echo a live secret into a report file, a PR body, or the terminal.

**>> Phase complete** — write output to `.workflows/verify/05-security.md`

---

## Phase 6: DIFF

**Goal**: Catch the mistakes that survive a green build.

Read the diff (`git diff <base>...HEAD`) and check the changed lines against the
heuristics in
`<plugin-root>/skills/verify/references/security-checks.md` — debug prints left
behind, raw exception messages in responses, wildcard CORS, empty catch blocks,
`Thread.sleep`, field injection, `SELECT *` in native queries, and similar.

For each finding record `file:line — issue — fix`. Findings that are pre-existing
(not introduced by this diff) are reported as **notes**, not failures.

**>> Phase complete** — write output to `.workflows/verify/06-diff.md`

---

## Phase 7: REPORT

**Goal**: One verdict, backed by evidence.

### 7.1 — Human-Readable Report

Write `.workflows/verify/report.md`:

```
VERIFICATION REPORT — <project> @ <branch> (<base>...HEAD)

  Build:     PASS  (mvn -B clean verify -DskipTests, 12s)
  Static:    FAIL  (spotbugs 2 findings, pmd SKIPPED, checkstyle SKIPPED)
  Test:      PASS  (148/148 passed, 3 skipped, 22s)
  Coverage:  FAIL  (line 71.3% < 80% threshold)
  Security:  SKIPPED (OWASP plugin not declared)
  Diff:      1 finding (2 notes)

  Overall:   NOT READY

  Issues to fix:
  1. [coverage] line coverage 71.3% < 80% — worst: OrderService (18 missed)
  2. [static]  OrderService.java:42 — NP_NULL_ON_SOME_PATH — null check missing

  Skipped checks (and why):
  - pmd, checkstyle — plugins not declared in pom.xml
  - OWASP CVE scan — plugin not declared
```

Every line states **what was run**, not just the verdict. "PASS" without the
command that produced it is not evidence.

### 7.2 — Machine-Readable Findings

Write `.workflows/verify/findings.json` (or the configured
`verify.findings_file`):

```json
{
  "schema": "spring-boot-workflows/verify-findings@1",
  "generated_at": "2026-11-03T10:22:31Z",
  "base": "develop",
  "head": "a1b2c3d",
  "overall": "NOT_READY",
  "checks": [
    {
      "id": "coverage",
      "status": "FAIL",
      "detail": "line 71.3% < 80%",
      "skipped_reason": null
    }
  ],
  "findings": [
    {
      "id": "static",
      "severity": "high",
      "file": "src/main/java/com/example/OrderService.java",
      "line": 42,
      "message": "NP_NULL_ON_SOME_PATH",
      "fix": "null-check before dereference"
    }
  ]
}
```

`status` is one of `PASS`, `FAIL`, `SKIPPED`, `ERROR`. `severity` is one of
`critical`, `high`, `medium`, `low`. A `SKIPPED` check must carry a
`skipped_reason` — a skipped check is never a pass.

### 7.3 — Verdict

- **READY** — no check failed, and no check was skipped *because of a missing
  plugin the project should have*.
- **NOT READY** — any check failed.

Then print the summary and suggest the next step: fix the issues, or run
`/spring-boot-workflows:ci-fix` when a check failed because of CI environment
rather than the code.

**>> Phase complete** — write output to `.workflows/verify/07-report.md`

---

## Rules and Flags

| Flag | Effect |
|---|---|
| `--quick` | Run only `build`, `test`, and `coverage`; the rest are recorded as `SKIPPED — --quick` |
| `--skip <check>` | Skip one check — `build`, `static`, `test`, `coverage`, `security`, `diff` |
| `--strict` | Warnings fail the gate (overrides `verify.static_fail_on`) |
| `--base <branch>` | Diff base for Phase 6 |
| `--dependency-scan` | Force the OWASP scan even when the plugin is not declared |
| `--dry-run` | Print the plan for every phase and run no commands |

---

## Error Handling

| Error | Resolution |
|---|---|
| No `pom.xml` and no `build.gradle` | Stop — nothing to verify |
| Gradle project | Supported, but Gradle-only plugins apply; say which checks were Gradle-specific |
| Build fails | Hard stop — report the first error and stop; do not run later phases |
| `jacoco:report` produces no XML | Coverage is `SKIPPED` — the plugin has no `report` goal |
| Integration tests need CI-only secrets | Report as an environment failure; offer `--skip-it` |
| OWASP scan times out | Report `ERROR — scan timed out`; never report it as clean |
| `git diff` base does not exist | Fall back to `git merge-base HEAD <main>`; if that fails, ask the user |
| An analyzer goal fails to start | Report `ERROR` — it is a misconfiguration, not a code finding |

## Anti-Patterns

Do NOT: report a skipped check as a pass; echo a real secret into a report;
fix findings inside this skill; estimate test or coverage numbers instead of
parsing them; run the OWASP scan without asking; or claim a gate passed when a
required plugin was missing from the build file.

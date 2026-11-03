---
name: ci-setup
description: Generate GitHub Actions and Gitea Actions CI workflows for Java/Spring Boot projects — Maven build, tests, coverage, static analysis, and artifact upload. Use when adding CI to an existing repository, standardizing pipelines, or migrating between GitHub and Gitea.
rules: [0, 1, 4, 5, 7, 10, 12, 17]
---

# CI Setup Workflow

## Command

```
/spring-boot-workflows:ci-setup
  [--platform github|gitea|both]
  [--features test,coverage,coverage-gate,spotbugs,pmd,checkstyle,dependency-check,artifact]
  [--java <version>]
  [--runner <label>]
  [--mirror aliyun|tsinghua|none]
  [--skip-it]
  [--dry-run]
```

**Defaults**: platform auto-detected from the git remote; features `test,coverage,artifact`; Java version from `pom.xml` (fallback: 25); runner `ubuntu-latest`; mirror `none`; integration tests run when the build declares them (use `--skip-it` to opt out).

**A feature whose Maven plugin is not declared in the project's build file is
dropped with a warning** — never emitted as a step that always fails. The one
exception is `dependency-check`, which is invoked by goal and therefore works
without a `<plugin>` block (but is slow and needs the NVD API — see Phase 2.3).

**Scope (phase 1)**: Maven only. Docker, SSH deploy, Gradle, and JDK-source variants are tracked in `TODO.md`.

**Before starting**: Read `<plugin-root>/skills/ci-setup/references/platform-matrix.md` and `<plugin-root>/config/defaults.yml` (the `ci:` section).

---

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/ci-setup/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. Read `.workflows/config.yml` for project settings. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: DETECT

Identify the platform, build setup, and existing CI so the generated workflow matches the repository.

**Steps 1.1–1.4 are independent — execute in parallel.**

### 1.1 — Detect Platform and Existing CI

1. Read the remote: `git remote get-url origin`
   - `github.com` → `github`
   - Other host, or `.gitea/` exists in the repo → `gitea`
   - No remote / cannot decide → ask the user
2. Record existing workflow files:
   - `.github/workflows/*.yml`, `.github/workflows/*.yaml`
   - `.gitea/workflows/*.yml`, `.gitea/workflows/*.yaml`
3. If a CI file already exists for the target platform, plan a **diff/merge**, not a blind overwrite.

### 1.2 — Detect Build Setup

| Signal | Value to extract |
|---|---|
| `pom.xml` | Maven; artifactId, version, `<finalName>`, `java.version` / `maven.compiler.release` |
| `mvnw` / `mvnw.cmd` | Prefer `./mvnw` over system `mvn` (Rule 4) |
| `build.gradle` / `build.gradle.kts` | Gradle — out of scope for phase 1; stop and tell the user |
| `<finalName>` | Exact JAR name; otherwise default to `target/*.jar` |

### 1.3 — Detect Quality Tooling

| Plugin / file | Enables |
|---|---|
| `jacoco-maven-plugin` | `coverage` feature (`jacoco:report`) |
| `jacoco-maven-plugin` **with a `<rules>` block** | `coverage-gate` feature (`jacoco:check`) — without rules, `jacoco:check` passes trivially, so the block is dropped |
| `spotbugs-maven-plugin` + `spotbugs-include.xml` / `spotbugs-exclude.xml` | `spotbugs` feature |
| `maven-pmd-plugin` | `pmd` feature |
| `maven-checkstyle-plugin` | `checkstyle` feature |
| `dependency-check-maven` (OWASP) | `dependency-check` feature — also invocable by goal without a `<plugin>` block |
| `maven-surefire-plugin` | Test reports (always uploaded) |
| `maven-failsafe-plugin`, `*IT.java`, `org.testcontainers` | Integration tests — `verify` will run them |
| `.mvn/settings.xml` | Reuse it; read `<localRepository>` if present |
| `.mvn/jvm.config` | Leave untouched |

Integration tests often need CI-only configuration (profile properties, secrets) or a Docker socket. Detect their presence and carry the result into Phase 2 — do not silently assume `verify` will pass.

### 1.4 — Detect Branches and Java

1. Main branch: `git symbolic-ref refs/remotes/origin/HEAD` (strip `refs/remotes/origin/`); fall back to `git.branches.main` from config, then `main`.
2. Development branch: `git branch -r` — include only if the configured dev branch exists remotely.
3. Java version: `pom.xml` property → `--java` flag → config → default `25`.

   `ci.java_versions` in the config is a **list**, but phase 1 renders a **single**
   JDK — the first entry. If the list has more than one entry, use the first and
   tell the user: "the JDK matrix is phase 2 (see TODO.md) — the workflow is
   generated for JDK `<first>` only". Do not silently drop the other entries.

**>> Phase complete** — write output to `.workflows/ci-setup/01-detect.md`

---

## Phase 2: CONFIGURE

### 2.1 — Resolve Settings

Apply precedence: CLI flags → `.workflows/config.yml` `ci:` section → `<plugin-root>/config/defaults.yml` → defaults above.

### 2.2 — Present the Plan

Print a table and ask the user to confirm or correct it:

```
Platform:       github | gitea | both
Files:          .github/workflows/maven-ci.yml
                .gitea/workflows/maven-ci.yml
Java:           25 (temurin)
Runner:         ubuntu-latest
Branches:       push [main, develop], PR [main]
Maven:          ./mvnw -B verify  -s .mvn/settings.xml
Integration:    run (failsafe/testcontainers detected) | skipped (-DskipITs)
Cache:          ~/.m2/repository
Features:       test, coverage, artifact
Secrets:        none (GITEA_TOKEN only for private/cross-repo checkout)
                NVD_API_KEY only when `dependency-check` is selected
```

If a target file already exists, also show `diff` against the render and ask: **update**, **skip**, or **keep**.

### 2.3 — Feature Resolution Rules

A feature whose plugin is missing is **dropped and reported** — never emitted as a
step that fails on every run.

- `coverage` requested but no JaCoCo plugin → **drop it and warn**; do not generate a failing step.
- `coverage-gate` requested but no JaCoCo plugin → **drop it and warn**.
- `coverage-gate` requested, JaCoCo present but **no `<rules>` block** → **drop it and warn**. `jacoco:check` without a `<minimum>` passes no matter what the coverage is, so keeping the step would report a green gate that gates nothing. Recommend adding the rules from `<plugin-root>/skills/verify/references/maven-quality-plugins.md`, or run `/spring-boot-workflows:verify` locally — it computes the coverage gate from the report and needs no pom change.
- `spotbugs` requested but no SpotBugs plugin → **drop it and warn**.
- `pmd` requested but no PMD plugin → **drop it and warn**.
- `checkstyle` requested but no Checkstyle plugin → **drop it and warn**.
- `dependency-check` requested → keep it even without a `<plugin>` block, because the goal is invoked by coordinates (`org.owasp:dependency-check-maven:check`). Warn that the first run downloads the NVD feed and takes 10+ minutes, and that `NVD_API_KEY` should be set as a repository secret.
- `artifact` requested → resolve `{ARTIFACT_GLOB}`:
  - `<finalName>` present → `target/<finalName>.jar`
  - otherwise → `target/*.jar`
- `--mirror` not `none` and `.mvn/settings.xml` is absent → plan to create it.
- If `.mvn/settings.xml` exists and declares `<localRepository>`, set `{CACHE_PATH}` to **exactly that path** (expanded); otherwise use `~/.m2/repository`.

### 2.3.1 — Static Analysis Overlap

PMD and Checkstyle overlap heavily. When both are requested, keep both but tell
the user they will report many of the same findings, and recommend picking one
as the primary style gate.

### 2.4 — Integration Test Policy

`verify` runs whatever the build binds to it — including Failsafe integration tests. Those frequently need CI-only properties, secrets, or Docker.

- Failsafe / Testcontainers / `*IT.java` detected, and `--skip-it` not set:
  - Keep `verify` as-is, but tell the user: "Integration tests will run in CI. If they need local-only config or secrets, add a CI profile or re-run with `--skip-it`."
  - List the properties those tests need if they are visible in the source (for example `${app.*}` placeholders in `@SpringBootTest`).
- `--skip-it` set: append `-DskipITs` to `{MAVEN_ARGS}`. This keeps unit tests and packaging while skipping Failsafe.
- No integration tests detected: no warning.

### 2.5 — Branch Trigger Policy

- `push.branches` = main branch + development branch (only when it exists). Nothing else.
- `pull_request.branches` = the same set.
- Do **not** add `feature/**` or any other wildcard by default. Feature branches are covered by `pull_request` events; adding them to `push` double-runs every commit.
- Only add extra push patterns when the user explicitly asks for them, and record the exception in the plan.

**>> Phase complete** — write output to `.workflows/ci-setup/02-configure.md`

---

## Phase 3: GENERATE

### 3.1 — Render Templates

Read templates from `<plugin-root>/skills/ci-setup/templates/`:

| Platform | Template | Output |
|---|---|---|
| GitHub | `github/maven-ci.yml.tmpl` | `.github/workflows/maven-ci.yml` |
| Gitea | `gitea/maven-ci.yml.tmpl` | `.gitea/workflows/maven-ci.yml` |
| Mirror | `shared/settings.xml.tmpl` | `.mvn/settings.xml` |

Placeholder contract:

| Placeholder | Value |
|---|---|
| `{VERSION}` | Plugin version from `<plugin-root>/VERSION` |
| `{BRANCHES}` | Push branches, e.g. `"main", "develop"` |
| `{PR_BRANCHES}` | PR target branches, e.g. `"main"` |
| `{JAVA_VERSION}` | e.g. `25` |
| `{RUNNER}` | e.g. `ubuntu-latest` |
| `{MAVEN_CMD}` | `./mvnw` or `mvn` |
| `{MAVEN_ARGS}` | e.g. `-s .mvn/settings.xml`, `-DskipITs`, or both |
| `{CACHE_PATH}` | `~/.m2/repository` or the detected custom path |
| `{ARTIFACT_GLOB}` | e.g. `target/app.jar` |
| `{MIRROR_ID}`, `{MIRROR_NAME}`, `{MIRROR_URL}` | Mirror values (settings template only) |

Replace only the listed placeholders. Do **not** use a blanket regex — the templates contain GitHub/Gitea expressions such as `${{ runner.os }}`.

### 3.2 — Apply Optional Blocks

Template blocks are delimited by:

```yaml
      # >>> optional:<feature>
      ...
      # <<< optional:<feature>
```

Keep a block only when its feature was selected; delete the whole block (including the marker lines) otherwise. Supported: `coverage`, `coverage-gate`, `spotbugs`, `pmd`, `checkstyle`, `dependency-check`, `artifact`.

Marker rules — a malformed marker silently leaks a step into the output, so treat every deviation as an error and stop:

| Rule | On violation |
|---|---|
| Every `# >>> optional:X` has a matching `# <<< optional:X` | Stop; report the line number |
| Open and close markers name the same feature | Stop; report the mismatch |
| No block nests inside another | Stop; report the line number |
| No marker is missing its feature name | Stop; report the line number |

### 3.3 — Write Safely

1. Never overwrite an existing file without the user's Phase 2 decision.
2. Keep the first line marker: `# Generated by spring-boot-workflows ci-setup v{VERSION}`.
3. Create directories with `mkdir -p`.
4. If `--dry-run`, print each rendered file instead of writing it.
5. If a settings file is created, tell the user it is project configuration and should be committed.

**>> Phase complete** — write output to `.workflows/ci-setup/03-generate.md` (files written, placeholders, dropped features)

---

## Phase 4: VALIDATE

Run these checks on every generated file and report PASS/FAIL:

### 4.1 — Structural Checks

```bash
# YAML must parse when PyYAML is available; otherwise check the required top-level keys
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/maven-ci.yml'))" 2>/dev/null \
  || grep -q '^on:' .github/workflows/maven-ci.yml
```

- File contains top-level `on:` and `jobs:`.
- Indentation is consistent (no tabs).
- No unresolved `{PLACEHOLDER}` remains (`grep -nE '\{[A-Z_]+\}' <file>` should only match `${{ ... }}` expressions — verify manually).
- Every `# >>> optional:` has a matching `# <<< optional:`.

### 4.2 — Platform Checks

| Check | GitHub file | Gitea file |
|---|---|---|
| Context namespace | no `gitea.` | no `github.` |
| Action references | `actions/*`, `docker/*`, `appleboy/*` | every `uses:` is `https://...` or `docker://...` |
| Runner label | user-confirmed | must match an `act_runner` label |
| Cache path | matches the real Maven local repository | same |

### 4.3 — Consistency Checks

- `{CACHE_PATH}` equals the local repository Maven will actually use:
  - No `<localRepository>` → `~/.m2/repository`
  - `<localRepository>.m2/repository</localRepository>` → `.m2/repository`
- Every `secrets.*` name appears in the Phase 2 secrets list.
- `{ARTIFACT_GLOB}` resolves to a file the build actually produces.
- Push triggers contain no `*` or `feature/**` pattern unless the Phase 2 plan recorded an explicit exception.

### 4.4 — Optional Local Build

Ask: **"Run a local `./mvnw -B verify` now?"** Run only on confirmation; report the result but do not block on unrelated pre-existing failures.

**>> Phase complete** — write output to `.workflows/ci-setup/04-validate.md`

---

## Phase 5: REPORT

Print:

```
CI setup complete

  Platform:  github
  Files:     .github/workflows/maven-ci.yml
  Features:  test, coverage, artifact
  Settings:  .mvn/settings.xml (aliyun mirror)

  Secrets to configure (repository settings → secrets):
    - none by default (Gitea uses the built-in ${{ github.token }})
    - GITEA_TOKEN   (only for private or cross-repository checkout)

  Next:
    1. Review the generated files and commit them
    2. Push a branch to trigger the pipeline
    3. If it fails: /spring-boot-workflows:ci-fix
    4. To run the same checks locally before pushing: /spring-boot-workflows:verify
```

If both platforms were generated, remind the user that GitHub and Gitea each need their own secrets.

**>> Phase complete** — write output to `.workflows/ci-setup/05-report.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| Not a git repository | Ask for `--platform`; skip remote detection |
| Neither `pom.xml` nor `build.gradle` | Stop — no supported build system |
| Gradle project | Stop with: "Gradle CI is tracked in TODO.md (phase 2)" |
| Gitea host returns GitHub-style remote | Ask the user to confirm the platform |
| Target workflow file exists | Diff and ask before writing |
| `.mvn/settings.xml` has an unexpected `localRepository` | Keep it and set `{CACHE_PATH}` to the same expanded path |
| Requested feature has no plugin | Drop the feature and warn; never emit a failing step |
| Integration tests fail on CI-only config | Report the missing property; offer `--skip-it` or a CI profile |
| YAML validation fails | Show the failing line; fix before reporting completion |

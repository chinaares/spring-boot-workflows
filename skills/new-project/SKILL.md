---
name: new-project
description: Initialize a new project with Claude Code configuration, detecting build systems, conventions, and generating CLAUDE.md and task scaffolding.
rules: [0, 1, 5, 6, 10, 12, 15, 17]
---

# New Project Initialization

```
/new-project [--path <directory>] [--preset <spring-boot|java>]
```

Four phases: **DETECT -> CONFIGURE -> GENERATE -> SETUP**

**Note**: This skill supersedes `/spring-boot-workflows:setup` — it performs full project detection plus setup, including the `.workflows/` subdirectories and the `.gitignore` entries that `/setup` creates. You do NOT need to run `/setup` separately if you use `/new-project`.

## Target Root

`<root>` = the `--path` value, resolved against the current working directory. When `--path` is omitted, `<root>` is the current working directory.

Every file this skill reads or writes lives under `<root>`:

| Operation | How |
|---|---|
| File search (`Glob`) | prefix the pattern with `<root>/` — e.g. `<root>/pom.xml`, `<root>/**/pom.xml` for multi-module |
| File read / write | prefix the path with `<root>/` |
| Git commands | run as `git -C <root> ...` — do **not** `cd` |

If `--path` points to a directory that does not exist, ask the user whether to create it, then continue.

## Step 0: Initialize Workflow (DO THIS FIRST)

**Directory name**: Auto-generate `<name>` from the project name in kebab-case, max 40 chars, ASCII only, lowercase (e.g. `Task Demo` → `task-demo`, `订单服务` → `order-service`). Use `<name>` for `.workflows/<name>/` throughout this skill.

Create `<root>/.workflows/<name>/` directory and `<root>/.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `<root>/.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: DETECT

Identify project tech stack, build system, and conventions.

**Steps 1.1, 1.3, 1.4 are independent — execute in parallel.** Step 1.2 depends on 1.1. Step 1.5 depends on all of them.

### 1.1 — Scan Project Markers

Use `Glob` for each marker, scoped to `<root>`. Record ALL matches (projects can be polyglot).

| Marker File | Stack |
|---|---|
| `pom.xml` with `spring-boot-starter-parent` | Spring Boot (Maven) |
| `pom.xml` | Java (Maven) |
| `build.gradle.kts` / `build.gradle` with `org.springframework.boot` plugin | Spring Boot (Gradle) |
| `build.gradle.kts` / `build.gradle` | Java (Gradle) |
| `settings.gradle.kts` / `settings.gradle` | Multi-module Gradle |
| `mvnw` / `gradlew` | Build wrapper present — use it, not the system tool |
| `flyway-database-*`, `db/migration/` | Flyway-managed schema |
| `liquibase.properties`, `db/changelog/` | Liquibase-managed schema |
| `package.json` | Node.js / JavaScript / TypeScript (non-primary — recorded, not configured) |

For directory markers (e.g. `db/migration/`), glob `<root>/**/db/migration/*`. For build files that may sit in a submodule, glob both `<root>/pom.xml` and `<root>/**/pom.xml`.

### 1.2 — Extract Build Details

From detected markers: build/test/lint commands, build variants (e.g., Android `productFlavors`), package manager via lock files.

### 1.3 — Scan Git Conventions

Run `git -C <root> log --oneline -20`, `git -C <root> branch -a | head -20`, check for CI config files under `<root>`. Extract: commit format, branch naming, main/dev branches, CI system.

### 1.4 — Detect Architecture

Search per category: architecture pattern (MVVM, Clean, etc.), DI framework, key directories, module structure.

If fewer than 3 attributes detected, ask user for manual input. If no `--preset` was passed, offer the presets from 1.5 as the fallback.

### 1.5 — Apply Preset Fallback

`--preset` supplies values for keys that detection could not resolve. **Detected values always win** — the preset only fills gaps, it never overrides a successful detection.

| Key | `--preset spring-boot` | `--preset java` |
|---|---|---|
| `project.type` | `spring-boot` | `java` |
| `project.language` | `java` | `java` |
| `project.spring.boot_major` | ask: "Spring Boot 3 or 4?" — never guess | not applicable — leave the `defaults.yml` value |
| `project.spring.build_tool` | detected, else `maven` | detected, else `maven` |
| `project.spring.persistence` | detected, else `jpa` | detected, else `jdbc` |

Rules:
- A preset sets **no** git or CI values — those are always detected.
- `boot_major` is never guessed (Rule 4): Boot 3 and Boot 4 differ in package locations and test APIs, so loading the wrong knowledge set produces code that compiles against the wrong API.
- If a detected value contradicts the preset (e.g. `--preset java` but `pom.xml` declares `spring-boot-starter-parent`), report the conflict and ask which to use. Do not silently pick one.

**>> Phase complete** — write output to `<root>/.workflows/<name>/01-detect.md`

---

## Phase 2: CONFIGURE

### 2.1 — Present & Confirm

Display the detection summary: stack, build/test commands, CI platform, git conventions, architecture, and the `--preset` fallback in use. Also list the **user plugin settings** that will be applied, and flag any that conflict with a detected value.

Ask: "Does this look correct? Reply with corrections or 'yes' to proceed."

### 2.2 — Generate config.yml

Copy `<plugin-root>/config/defaults.yml` **in full** to `<root>/.workflows/config.yml`, then overwrite the detected values. Do not hand-pick a subset of keys — every top-level section (`project`, `git`, `ci`, `workflows`, `state`, `skills`, `chains`, `guards`, `learning`, `quality`, `progress`, `telemetry`) must survive the copy.

Overwrite with detected values:

| Key | Detected from |
|---|---|
| `project.name` | project name |
| `project.type` | detected stack (`spring-boot` / `java` / `generic`) |
| `project.language` | detected language |
| `project.spring.boot_major` | detected major version (3 or 4) |
| `project.spring.build_tool` | detected build tool (`maven` or `gradle`) |
| `project.spring.persistence` | detected persistence (`jpa` if `spring-boot-starter-data-jpa` is present, else `jdbc`) |
| `git.branches.main` | detected main branch (fallback: `main`) |
| `git.branches.development` | detected development branch (fallback: `develop`) |
| `git.commits.format` | detected commit format |
| `git.pr.base_branch` | detected PR base branch (fallback: `develop`) |
| `ci.platform` | detected platform (`github` / `gitea` / `both`); use `auto` when the remote is inconclusive |
| `ci.runner` | detected or confirmed runner label |

**Precedence per key**: detected value → `--preset` value → user plugin setting → `defaults.yml`.

Apply the **user plugin settings** layer — the values configured with `claude plugin configure spring-boot-workflows`:

| Key | Setting |
|---|---|
| `project.type` | `project_type` |
| `project.team` | `team` |
| `git.branches.main` | `git_main_branch` |
| `git.branches.development` | `git_dev_branch` |
| `git.commits.format` | `commit_format` |

Rules:
- A setting applies only where detection produced **no** value — a setting is a fallback, not an override (RULES.md puts user plugin settings between `.workflows/config.yml` and `defaults.yml`).
- `project.team` has no detectable counterpart — the setting always applies.
- When a setting conflicts with a detected value, the detected value wins and the conflict is reported in Phase 2.1. A plugin setting is a global default; detection is per-project ground truth.
- Keep every other value from `defaults.yml` unchanged — including `ci.features` and `ci.java_versions`.

### 2.3 — Validate Config

Validate the generated `<root>/.workflows/config.yml` before moving on:

1. Verify all required top-level keys exist: `project`, `git`, `ci`, `workflows`, `state`, `quality`
2. Verify `project.type` is one of: `spring-boot`, `java`, `generic`
3. Verify `git.commits.format` is one of: `conventional`, `angular`, `simple`
4. Verify `git.merge.strategy` is one of: `squash`, `merge`, `rebase`
5. Verify `project.spring.boot_major` is one of: `3`, `4` (only when `project.type` is `spring-boot`)
6. Verify `ci.platform` is one of: `auto`, `github`, `gitea`, `both`
7. Verify `ci.mirror` is one of: `none`, `aliyun`, `tsinghua`
8. Verify every `ci.features` entry is one of: `test`, `coverage`, `spotbugs`, `artifact`

If any validation fails, warn the user and offer to fix it. Do not block the workflow for warnings.

**>> Phase complete** — write output to `<root>/.workflows/<name>/02-configure.md`

---

## Phase 3: GENERATE

### 3.1 — Generate CLAUDE.md

Write `<root>/CLAUDE.md` with sections: **Build & Run** (commands), **Architecture** (pattern, DI, modules, key directories), **Code Conventions** (commits, branches, PR base), **Important Notes** (project gotchas). Keep it concise -- one-liners per command, 5-10 key directories.

### 3.2 — Validate

Read back the generated file. Verify commands are valid, paths exist, no placeholders remain.

If `CLAUDE.md` exists, ask: **overwrite**, **merge** (preserve custom, update detected), or **skip**.

### 3.3 — Offer CI Setup

If no workflow exists in `<root>/.github/workflows/` or `<root>/.gitea/workflows/`, ask:

> Generate CI for this project? (GitHub Actions / Gitea Actions / both / skip)

On confirmation, execute the `ci-setup` skill inline per Rule 9.

Delegation parameters:
- **Read**: `<plugin-root>/skills/ci-setup/SKILL.md`
- **detection**: the platform, build tool, Java version, and branches already detected in Phase 1 — **do not re-detect them**
- **output**: write to this workflow's `<root>/.workflows/<name>/` directory — the CI phase reports land in `03-generate.md`, not in a separate `.workflows/ci-setup/` tree
- **state**: **do NOT create `.workflows/ci-setup/` and do NOT overwrite `.workflows/current-state.md`** — `ci-setup`'s own Step 0 is skipped. Track its phases as sub-steps of this GENERATE phase, then continue with Phase 4

**>> Phase complete** — write output to `<root>/.workflows/<name>/03-generate.md`

---

## Phase 4: SETUP

### 4.1 — Create Scaffolding

```bash
mkdir -p <root>/tasks <root>/.workflows/specs <root>/.workflows/history <root>/.workflows/learned
```

Create `<root>/tasks/todo.md` (with `# Todo`, `## In Progress`, `## Backlog` sections).
Create `<root>/tasks/lessons.md` (with `# Lessons Learned` header).

**Do NOT add `tasks/` to `.gitignore`** — task files should be tracked.

`specs/`, `history/` and `learned/` are created here because this skill supersedes `/setup`. Later workflows depend on them: `/new-feature` writes specs, Rule 5 archives the state file into `history/`, `/learn` writes `learned/`. Creating them now keeps `/setup` unnecessary.

### 4.2 — Sync `.gitignore`

This skill supersedes `/setup`, so it must also apply the `.gitignore` entries that `/setup` Step 4 writes. Without them, workflow artifacts (`current-state.md`, per-workflow output directories, history, knowledge) get committed to the repository.

Read `<root>/.gitignore` (create it if missing) and append these entries **if not already present**:

```
# spring-boot-workflows state (transient)
.workflows/current-state.md
.workflows/paused-*.md

# spring-boot-workflows artifacts (per-workflow outputs)
.workflows/*/

# spring-boot-workflows data
.workflows/history/
.workflows/learned/
.workflows/telemetry.jsonl
.workflows/knowledge.jsonl
```

Rules:
- **Idempotent** — look for the marker comment `# spring-boot-workflows state (transient)` first. If the marker exists, leave the block untouched; never duplicate it.
- **Never add `tasks/`** — task files are meant to be tracked.
- Do not remove or reorder entries the project already has.
- `.workflows/config.yml` and `.workflows/guards.yml` are intentionally **not** ignored — they are project configuration and should be committed.

### 4.3 — Offer Safety Guards (Optional)

If `<root>/.workflows/guards.yml` does not exist, ask:

> Install safety guards (pre-commit / pre-push checks)?

On confirmation:
1. Read `<plugin-root>/templates/guards.yml.tmpl`
2. Write it to `<root>/.workflows/guards.yml`
3. Print a summary — block patterns, warn patterns, protected paths, no-commit patterns

Do not create the file without confirmation. `/guards init` does the same thing standalone.

### 4.4 — Migration Check

Check for old v2.x installation artifacts under `<root>`:

- If `.claude/workflows.yml` exists → inform the user: "Found old v2.x config. Migrating settings to `.workflows/config.yml`." Read the old config values and merge them into `.workflows/config.yml`.
- If `.claude/.workflows-version` exists → inform the user: "Old v2.x installation detected. The plugin replaces the npm CLI — you can remove `.claude/skills/`, `.claude/rules/`, `.claude/reviews/`, `.claude/templates/`, `.claude/.workflows-version`, and `.claude/.core-skills` if they were installed by spring-boot-workflows."

### 4.5 — Final Summary

Print created files (`CLAUDE.md`, `.workflows/config.yml`, `tasks/todo.md`, `tasks/lessons.md`) and next steps: review CLAUDE.md, commit files.

Also report: the `.workflows/` subdirectories created, whether `.gitignore` was updated, whether guards were installed, and whether a v2.x migration was applied.

Then apply Rule 15: check `chains` in `<root>/.workflows/config.yml`. If a chain is configured for `new-project`, offer it ("Chain detected: run `<next-command>` next? (y/n)"). If no chain is configured, suggest `/spring-boot-workflows:new-feature` as the default next step.

**>> Phase complete** — write output to `<root>/.workflows/<name>/04-setup.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| `--path` directory does not exist | Ask whether to create it, then continue |
| `--path` directory is not readable | Report and suggest fixing the path |
| Not a git repository | Offer to run `git init` in `<root>` |
| No build files detected | Fall back to `--preset` (1.5); if none was passed, offer `spring-boot` / `java` |
| Preset contradicts a detected value | Report the conflict and ask which to use |
| `boot_major` cannot be determined | Ask the user — never guess (Rule 4) |
| Permission denied | Report and suggest fix |
| `.gitignore` not writable | Report and print the entries to add manually; do not fail the workflow |
| `tasks/` already tracked by the project | Leave it as is; do not remove the entry |

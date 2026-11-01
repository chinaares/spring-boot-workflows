---
name: new-project
description: Initialize a new project with Claude Code configuration, detecting build systems, conventions, and generating CLAUDE.md and task scaffolding.
rules: [0, 1, 5, 6, 10, 12, 17]
---

# New Project Initialization

```
/new-project [--path <directory>] [--preset <spring-boot|java>]
```

Four phases: **DETECT -> CONFIGURE -> GENERATE -> SETUP**

**Note**: This skill supersedes `/spring-boot-workflows:setup` — it performs full project detection plus setup. You do NOT need to run `/setup` separately if you use `/new-project`.

## Step 0: Initialize Workflow (DO THIS FIRST)

Create `.workflows/<project-name>/` directory and `.workflows/current-state.md` following the execution protocol — YAML frontmatter with workflow name, feature, first phase ACTIVE, all phases list, timestamps, replan_count=0. Add `## Phase History` table and `## Context` section. **Verify the state file exists before Phase 1.**

**After EVERY phase**: write output file + update `.workflows/current-state.md` (advance phase, mark COMPLETED, add ACTIVE row). Print progress. **NEVER skip phases.**

---

## Phase 1: DETECT

Identify project tech stack, build system, and conventions.

**Steps 1.1, 1.3, 1.4 are independent — execute in parallel.** Step 1.2 depends on 1.1.

### 1.1 — Scan Project Markers

Use `Glob` for each marker. Record ALL matches (projects can be polyglot).

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

### 1.2 — Extract Build Details

From detected markers: build/test/lint commands, build variants (e.g., Android `productFlavors`), package manager via lock files.

### 1.3 — Scan Git Conventions

Run `git log --oneline -20`, `git branch -a | head -20`, check for CI config files. Extract: commit format, branch naming, main/dev branches, CI system.

### 1.4 — Detect Architecture

Search per category: architecture pattern (MVVM, Clean, etc.), DI framework, key directories, module structure.

If fewer than 3 attributes detected, ask user for manual input. Use `--preset` as fallback.

**>> Phase complete** — write output to `.workflows/<project-name>/01-detect.md`

---

## Phase 2: CONFIGURE

### 2.1 — Present & Confirm

Display detection summary (stack, commands, CI, conventions, architecture). Ask: "Does this look correct? Reply with corrections or 'yes' to proceed."

### 2.2 — Generate workflows.yml

Copy `<plugin-root>/config/defaults.yml` **in full** to `.workflows/config.yml`, then overwrite the detected values. Do not hand-pick a subset of keys — every top-level section (`project`, `git`, `ci`, `workflows`, `state`, `skills`, `chains`, `guards`, `learning`, `quality`, `progress`, `telemetry`) must survive the copy.

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

Keep every other value from `defaults.yml` unchanged — including `ci.features` and `ci.java_versions`.

**>> Phase complete** — write output to `.workflows/<project-name>/02-configure.md`

---

## Phase 3: GENERATE

### 3.1 — Generate CLAUDE.md

Write `CLAUDE.md` in project root with sections: **Build & Run** (commands), **Architecture** (pattern, DI, modules, key directories), **Code Conventions** (commits, branches, PR base), **Important Notes** (project gotchas). Keep it concise -- one-liners per command, 5-10 key directories.

### 3.2 — Validate

Read back generated file. Verify commands are valid, paths exist, no placeholders remain.

If CLAUDE.md exists, ask: **overwrite**, **merge** (preserve custom, update detected), or **skip**.

### 3.3 — Offer CI Setup

If no workflow exists in `.github/workflows/` or `.gitea/workflows/`, ask:

> Generate CI for this project? (GitHub Actions / Gitea Actions / both / skip)

On confirmation, execute the `ci-setup` skill inline per Rule 9, passing the platform, build tool, Java version, and branches already detected in Phase 1. Do not re-detect them.

**>> Phase complete** — write output to `.workflows/<project-name>/03-generate.md`

---

## Phase 4: SETUP

### 4.1 — Create Scaffolding

```bash
mkdir -p tasks .workflows
```

Create `tasks/todo.md` (with `# Todo`, `## In Progress`, `## Backlog` sections).
Create `tasks/lessons.md` (with `# Lessons Learned` header).

**Do NOT add `tasks/` to `.gitignore`** — task files should be tracked.

### 4.2 — Final Summary

Print created files (CLAUDE.md, .workflows/config.yml, tasks/todo.md, tasks/lessons.md) and next steps: review CLAUDE.md, commit files, run `/spring-boot-workflows:new-feature`.

**>> Phase complete** — write output to `.workflows/<project-name>/04-setup.md`

---

## Error Handling

| Error | Resolution |
|---|---|
| Not a git repository | Offer to run `git init` |
| No build files detected | Fall back to `--preset` |
| Permission denied | Report and suggest fix |

---
name: setup
description: "Initialize a project for spring-boot-workflows — detects stack, creates .workflows/ directory structure, generates config, and updates .gitignore."
rules: []
---

# Project Setup

```
/spring-boot-workflows:setup [--with-guards]
```

**Purpose**: One-time project initialization. Run this after installing the plugin to configure your project. For new projects that need full detection (CLAUDE.md, tasks/), use `/new-project` instead — it includes everything setup does plus more.

**Config**: Read `<plugin-root>/config/defaults.yml` as the template. Determine `<plugin-root>` from this skill's own path (remove `/skills/setup/SKILL.md`).

---

## Step 1: Detect Project

Scan the project root for stack markers:

| Marker file | Detected type | Language |
|-------------|--------------|----------|
| `pom.xml` with `spring-boot-starter-parent` | spring-boot | java |
| `pom.xml` without Spring Boot parent | java | java |
| `build.gradle`, `build.gradle.kts` with `org.springframework.boot` plugin | spring-boot | java |
| `build.gradle`, `build.gradle.kts` without Spring Boot plugin | java | java |
| `settings.gradle`, `settings.gradle.kts` | java | java |
| None of the above | generic | — |

For a detected `spring-boot` project, also determine the **Spring Boot major version**
(`project.spring.boot_major`) and the build tool (`project.spring.build_tool`) per Rule 4
— `<plugin-root>/skills/_orchestration/rules/rule-04-build-detection.md`. If the major
version cannot be determined from the build file, ask the user; never guess.

Compare detected type with user plugin settings (project_type). If they differ, inform the user:
> "Detected project type: `<detected>`, but plugin is configured as `<user-setting>`. Using plugin config. Run `claude plugin configure spring-boot-workflows` to change."

## Step 2: Create Directory Structure

```bash
mkdir -p .workflows/specs .workflows/history .workflows/learned
```

## Step 3: Generate Config

Read `<plugin-root>/config/defaults.yml` as the base template.

Write `.workflows/config.yml` with these substitutions from user plugin settings:
- `project.type` → project_type setting (or detected type)
- `project.team` → team setting
- `git.branches.main` → git_main_branch setting (default: `main`)
- `git.branches.development` → git_dev_branch setting (default: `develop`)
- `git.commits.format` → commit_format setting (default: `conventional`)

For a detected `spring-boot` project, also write the values detected in Step 1:
- `project.spring.boot_major` → detected major version (3 or 4)
- `project.spring.build_tool` → detected build tool (`maven` or `gradle`)
- `project.spring.persistence` → detected persistence (`jpa` if `spring-boot-starter-data-jpa` is present, else `jdbc`)

The user can further customize `.workflows/config.yml` after generation.

## Step 3b: Validate Config

After writing `.workflows/config.yml`, validate the generated config:

1. Verify all required top-level keys exist: `project`, `git`, `workflows`, `state`, `quality`
2. Verify `project.type` is one of: `spring-boot`, `java`, `generic`
3. Verify `git.commits.format` is one of: `conventional`, `angular`, `simple`
4. Verify `git.merge.strategy` is one of: `squash`, `merge`, `rebase`
5. Verify `project.spring.boot_major` is one of: `3`, `4` (only when `project.type` is `spring-boot`)

If any validation fails, warn the user and offer to fix. Do not block setup for warnings.

## Step 4: Update .gitignore

Add these entries to `.gitignore` if not already present:

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

## Step 5: Safety Guards (Optional)

If `--with-guards` flag is present:
1. Read `<plugin-root>/templates/guards.yml.tmpl`
2. Write to `.workflows/guards.yml`
3. Inform user: "Safety guards installed at `.workflows/guards.yml`. Edit to customize."

## Step 6: Migration Check

Check for old v2.x installation artifacts:
- If `.claude/workflows.yml` exists → inform user: "Found old v2.x config. Migrating settings to `.workflows/config.yml`." Read old config values and merge into the new config.
- If `.claude/.workflows-version` exists → inform user: "Old v2.x installation detected. The plugin replaces the npm CLI — you can remove `.claude/skills/`, `.claude/rules/`, `.claude/reviews/`, `.claude/templates/`, `.claude/.workflows-version`, and `.claude/.core-skills` if they were installed by spring-boot-workflows."

## Step 7: Report

```
✓ Project setup complete!

  Type:     <project_type>
  Team:     <team>
  Config:   .workflows/config.yml
  State:    .workflows/

  Next: Run /spring-boot-workflows:start to begin a workflow.
```

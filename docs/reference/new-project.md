# The `new-project` Skill: Capabilities and Mechanism

> Reference · subject of analysis: `skills/new-project/SKILL.md` (plugin v1.0.0)
>
> Written for two audiences: maintainers who need to modify this skill, and developers trying to understand how the plugin's orchestration works.

---

## 1. Positioning

`new-project` is the plugin's **project initialization entry point**. It chains "detect → configure → generate → finalize" into a single invocation, so a project enters the "workflow-ready" state the moment its first session ends — no need to run `/setup` and then `/ci-setup` separately.

It **supersedes** `/setup` (see [§6](#6-relationship-to-setup)).

### Command

```text
/spring-boot-workflows:new-project [--path <directory>] [--preset <spring-boot|java>]
```

### Scope

| Does | Does not |
|---|---|
| Detect the tech stack, git conventions, architecture | Write business code |
| Generate `config.yml`, `CLAUDE.md`, `tasks/` | Modify existing code |
| Sync `.gitignore`, install guards, check for v2.x leftovers | Create branches or commit |
| Optionally generate CI workflows | Run the build |

### How it is reached

Besides direct invocation, it is reachable through the `/spring-boot-workflows:start` menu (item 3, "New Project"). `start` gathers the arguments and dispatches straight into this skill.

---

## 2. The Four Phases

```text
DETECT ──▶ CONFIGURE ──▶ GENERATE ──▶ SETUP
```

| Phase | Sub-steps | Dependencies | Output file |
|---|---|---|---|
| **Step 0** | State initialization | — | `.workflows/<name>/`, `.workflows/current-state.md` |
| **1 DETECT** | 1.1 Marker scan<br>1.2 Build details<br>1.3 git conventions<br>1.4 Architecture<br>1.5 Preset fallback | 1.2 ← 1.1<br>1.5 ← all | `01-detect.md` |
| **2 CONFIGURE** | 2.1 Present & confirm<br>2.2 Generate config<br>2.3 Validate config | 2.2 ← 1.x<br>2.3 ← 2.2 | `02-configure.md` |
| **3 GENERATE** | 3.1 Generate CLAUDE.md<br>3.2 Read-back validation<br>3.3 Delegate CI | 3.3 optional | `03-generate.md` |
| **4 SETUP** | 4.1 Scaffolding<br>4.2 Sync `.gitignore`<br>4.3 Install guards<br>4.4 Migration check<br>4.5 Summary + Rule 15 | 4.x ← 2.x | `04-setup.md` |

### 2.1 Phase 1 — DETECT

**1.1 Marker scan** — `Glob` for each marker, scoped to `<root>/`. "Record ALL matches" is explicit — a project may be polyglot. `package.json` is treated as a secondary language: recorded, not configured.

| Marker file | Inferred stack |
|---|---|
| `pom.xml` with `spring-boot-starter-parent` | Spring Boot (Maven) |
| `pom.xml` | Java (Maven) |
| `build.gradle.kts` / `build.gradle` with the `org.springframework.boot` plugin | Spring Boot (Gradle) |
| `build.gradle.kts` / `build.gradle` | Java (Gradle) |
| `settings.gradle.kts` / `settings.gradle` | Multi-module Gradle |
| `mvnw` / `gradlew` | Wrapper present — **prefer it over the system tool** |
| `flyway-database-*`, `db/migration/` | Flyway-managed schema |
| `liquibase.properties`, `db/changelog/` | Liquibase-managed schema |
| `package.json` | Node.js / JS / TS (secondary — recorded only) |

**1.2 Build details** — Extract build/test/lint commands, build variants (e.g. Android `productFlavors`), and the package manager (by lock file) from the detected markers.

**1.3 git conventions** — `git log --oneline -20` for the commit format, `git branch -a` for main/development branch naming, CI config files for the CI system.

**1.4 Architecture** — Architecture pattern (MVVM, Clean, …), DI framework, key directories, module structure. **Fallback rule**: fewer than 3 attributes detected means ask the user; if no `--preset` was passed, offer the presets.

**1.5 Preset fallback** — Fill the keys detection could not resolve from `--preset`. **Detected values always win** — the preset only fills gaps, it never overrides a successful detection (see [§5.2](#52---preset-spring-bootjava)).

### 2.2 Phase 2 — CONFIGURE

**2.1 Present & confirm** — the workflow's **only approval gate**, placed before generation. Shows the detection summary, the user plugin settings about to be applied, and anything that conflicts with a detected value.

**2.2 Generate config** — copy `<plugin-root>/config/defaults.yml` **in full** to `.workflows/config.yml`, then overwrite the detected values.

> There is a test-enforced anti-pattern here: **never hand-pick keys**. Every top-level key in `defaults.yml` — `version` plus all 12 sections (`project` / `git` / `ci` / `workflows` / `state` / `skills` / `chains` / `guards` / `learning` / `quality` / `progress` / `telemetry`) — must survive the copy. The historical lesson is that the `ci` section was once dropped by a hand-written config generator, silently losing project-level CI settings.

Overwritten keys:

| Key | Source |
|---|---|
| `project.name` | project name |
| `project.type` | detected stack (`spring-boot` / `java` / `generic`) |
| `project.language` | detected language |
| `project.spring.boot_major` | detected major version (3 or 4) |
| `project.spring.build_tool` | detected build tool (`maven` / `gradle`) |
| `project.spring.persistence` | detected persistence (`jpa` if `spring-boot-starter-data-jpa` is present, else `jdbc`) |
| `git.branches.main` | detected main branch (fallback `main`) |
| `git.branches.development` | detected development branch (fallback `develop`) |
| `git.commits.format` | detected commit format |
| `git.pr.base_branch` | detected PR base branch (fallback `develop`) |
| `ci.platform` | detected platform (`github` / `gitea` / `both`); `auto` when the remote is inconclusive |
| `ci.runner` | detected or confirmed runner label |

The **user plugin settings layer** (5 keys, see [§5.3](#53-the-config-precedence-chain)) is applied next, and every other value from `defaults.yml` is kept as-is — **including `ci.features` and `ci.java_versions`**, so the config cannot erode across sessions.

**2.3 Validate config** — 8 checks on the generated file: the 6 required top-level keys are present, and 6 enum fields hold legal values (`project.type`, `git.commits.format`, `git.merge.strategy`, `project.spring.boot_major`, `ci.platform`, `ci.mirror`, `ci.features`). A failure warns and offers a fix; it **does not block the workflow**.

### 2.3 Phase 3 — GENERATE

**3.1 Generate CLAUDE.md** — four sections: **Build & Run** (commands) / **Architecture** (pattern, DI, modules, key directories) / **Code Conventions** (commits, branches, PR base) / **Important Notes** (project gotchas). Constrained to "one-liners per command, 5–10 key directories" so the file stays concise.

**3.2 Read-back validation** — read the file back and verify the commands work, the paths exist, and no placeholders remain. If `CLAUDE.md` already exists, offer three choices: **overwrite** / **merge** (keep custom content, update detected values) / **skip**.

**3.3 Delegate CI** — if neither `.github/workflows/` nor `.gitea/workflows/` has a workflow, ask whether to generate one; on confirmation, run the `ci-setup` skill inline per Rule 9, reusing the parameters already detected in Phase 1.

### 2.4 Phase 4 — SETUP

**4.1 Scaffolding** — `mkdir -p tasks .workflows/specs .workflows/history .workflows/learned`, plus `tasks/todo.md` (`# Todo` / `## In Progress` / `## Backlog`) and `tasks/lessons.md` (`# Lessons Learned`).

> **`tasks/` must never be added to `.gitignore`** — task files are meant to be tracked.
>
> The `specs/` / `history/` / `learned/` directories have to be created here: `/new-feature` writes specs into `specs/`, Rule 5 archives the state file into `history/`, and `/learn` writes into `learned/`. Without them later skills silently write nowhere.

**4.2 Sync `.gitignore`** — write the same 7 ignore rules as `/setup`. Idempotent (check for the marker comment before appending), never includes `tasks/`, never reorders existing entries.

**4.3 Install guards (optional)** — when `guards.yml` does not exist, ask; on confirmation read `<plugin-root>/templates/guards.yml.tmpl`, write it, and print a summary. `/guards init` does the same thing standalone.

**4.4 Migration check** — look for v2.x leftovers: if `.claude/workflows.yml` exists, merge the old config values into the new `config.yml`; if `.claude/.workflows-version` exists, tell the user which old CLI directories they can remove.

**4.5 Final summary** — print the created files, the `.workflows/` subdirectories, whether `.gitignore` was updated, and the guard/migration outcomes. Then apply Rule 15: check `chains` in `config.yml`; if one is configured, offer it, otherwise suggest `/new-feature` as the default next step.

---

## 3. Artifacts

| Path | Content | Git-tracked | Created by |
|---|---|:-:|---|
| `CLAUDE.md` | Project context: build commands, architecture, conventions, gotchas | ✅ | Phase 3.1 |
| `.workflows/config.yml` | Workflow config (every top-level key of `defaults.yml` preserved) | ✅ | Phase 2.2 |
| `tasks/todo.md` | Task checklist | ✅ | Phase 4.1 |
| `tasks/lessons.md` | Lessons learned | ✅ | Phase 4.1 |
| `.workflows/guards.yml` | Safety guard config | ✅ | Phase 4.3 (optional) |
| `.workflows/specs/` `history/` `learned/` | State directories | ❌ | Phase 4.1 |
| `.workflows/<name>/01-detect.md` … `04-setup.md` | Per-phase outputs | ❌ | each phase |
| `.workflows/current-state.md` | Workflow state machine | ❌ | phase transitions |
| `.github/workflows/*.yml` / `.gitea/workflows/*.yml` | CI workflows | ✅ | Phase 3.3 (optional) |

---

## 4. Mechanism

The skill contains **no executable code** — it is a set of procedural instructions for the model. Its reliability comes from four layers of infrastructure.

### 4.1 Protocol injection (SessionStart)

The `SessionStart` hook in [hooks.json](../../hooks/hooks.json) does two things:

1. `cat PROTOCOL.md` — injects the execution protocol in full. It defines the state-initialization template, the phase-output double action, phase-skip rules, and path-resolution precedence.
2. Runs `scripts/session-start-state.sh` — parses `current-state.md`'s frontmatter with `awk` and prints the active/paused workflow notice.

> The script's comment records a hard constraint: **SessionStart must be a command-type hook**. Claude Code rejects prompt-type hooks there (no conversation context is available yet).

The point: the protocol is not something the model has to "remember" — it is **force-injected every session**.

### 4.2 Rule assembly

The skill's frontmatter declares `rules: [0, 1, 5, 6, 10, 12, 15, 17]`, which selects which files under `skills/_orchestration/rules/` get loaded:

| Rule | Purpose |
|---|---|
| 0 | State initialization (kebab-case directory name, frontmatter template) |
| 1 | Phase output protocol + preconditions + state update |
| 5 | Workflow completion (diff report, archive into `history/`, chaining, knowledge extraction) |
| 6 | Pause (rename to `paused-<feature>.md`) |
| 10 | Phase status values (ACTIVE/COMPLETED/SKIPPED/FAILED/RETRY) |
| 12 | Telemetry (optional, writes `telemetry.jsonl`) |
| 15 | Chaining (check `chains`, offer to run the next workflow) |

Rules 8 (common errors) and 14 (dry-run) **always apply** and need no declaration.

**Assembly semantics**: `rules:` only decides which rule files load; the actual flow is defined by the skill body. Rule 5's own comment says "skills do NOT need to repeat these steps — this rule handles all completion logic universally", which is why Phase 4.5 only prints a summary and lets Rule 5 handle archiving and the diff report.

> Rule 9 (skill composition) is referenced by Phase 3.3 but is **not** in the `rules:` list. That is safe: Phase 3.3 spells out all four of Rule 9's contract points inline (execute inline, route output, create no separate state file, return to the parent flow), so it does not depend on the rule file being loaded.

### 4.3 The state machine

`.workflows/current-state.md` is the single source of truth. Its frontmatter carries `workflow` / `feature` / `phase` / `phases` / `started` / `updated` / `branch` / `output_dir` / `replan_count`; the body holds a `## Phase History` table, `## Context`, `## Constraints`, and `## Progress` (a Mermaid state diagram).

The protocol requires two things per phase, and the next phase cannot begin until both are written:

1. Write the phase output file
2. Rewrite the state file (advance `phase`, mark COMPLETED, add an ACTIVE row, append Context decisions)

The `## Context` section is explicitly labelled "the primary record that survives context compression", capped at roughly 20 entries — the key design decision for cross-session resume.

Rule 17 additionally renders a Mermaid `stateDiagram-v2`, but **what the user sees is a compressed text line** (terminals do not render Mermaid):

```text
Progress: ✓DETECT ▶CONFIGURE ·GENERATE ·SETUP
```

### 4.4 Hook-enforced state sync

The most important piece of the mechanism. The `PostToolUse` hook matches `Write(.workflows/*)` and `Edit(.workflows/*)`:

> You just wrote a file under `.workflows/. If this was a phase output file (e.g. 01-gather.md, 02-spec.md, etc.) and NOT current-state.md itself, you MUST now update .workflows/current-state.md BEFORE doing anything else … Do NOT proceed to the next phase until this is done.

**Why it matters**: it pushes the "remember to update the state after writing a phase output" convention down from the prompt layer to the **tool-call layer** — every time the model writes a `.workflows/0X-*.md`, the hook reminds it immediately.

The companion `PreToolUse` hook on `Bash(gh pr create*)` checks whether a quality gate ran before the PR (looking for review/checklist mentions). That one is a **prompt-type** hook (it can read the conversation), which is the division of labour with SessionStart's command-type hook.

### 4.5 Rule 9 inline delegation

Phase 3.3 delegates to `ci-setup` under Rule 9. Four contract points:

1. **Execute inline** — do not launch a separate skill; read the target SKILL.md and treat its steps as sub-steps of the current phase
2. **Route the output** — write into this workflow's `.workflows/<name>/`; the CI phase report lands in `03-generate.md`
3. **Create no separate state file** — **skip `ci-setup`'s own Step 0**
4. **Return to the parent flow** — continue with Phase 4

> Point 3 is the critical one. `ci-setup`'s Step 0 creates `.workflows/ci-setup/` and overwrites `current-state.md` — without skipping it explicitly, the inlined skill **destroys the parent workflow's state machine**. This constraint is locked in by a test assertion.

### 4.6 The config precedence chain

Every config key resolves in a fixed order:

```text
detected value → --preset value → user plugin setting → defaults.yml
```

| Layer | Nature | Notes |
|---|---|---|
| Detected value | Per-project fact | The actual result of Phase 1 |
| `--preset` | Explicit per-invocation choice | Engaged only where detection found nothing |
| User plugin setting | Global default | The 5 values set by `claude plugin configure spring-boot-workflows` |
| `defaults.yml` | Plugin built-in default | The template in the plugin root |

**A user plugin setting is a fallback, not an override.** RULES.md's wording is "serve as fallback" — a global default must not outrank a per-project fact. `project.team` has no detectable counterpart, so the setting always applies.

The `setup` skill was aligned to the same chain and given git convention detection — otherwise "detection wins" would be vacuous for it. Both skills have assertions keeping their precedence chain, validation list, migration check, and guards check identical, so the two cannot drift apart.

### 4.7 Path scoping and directory naming

**`<root>`** = the resolved `--path` (or the current working directory when omitted). Every read and write is confined to it:

| Operation | How |
|---|---|
| File search (`Glob`) | prefix the pattern with `<root>/` — `<root>/pom.xml`, plus `<root>/**/pom.xml` for multi-module |
| File read / write | prefix the path with `<root>/` |
| git commands | `git -C <root> ...` — **do not `cd`** |

`git -C` rather than `cd` is deliberate: `cd` mutates the shell context, `git -C` affects a single command only.

**Directory names** follow Rule 0: kebab-case, max 40 characters, ASCII only, lowercase (`Task Demo` → `task-demo`, `订单服务` → `order-service`). The name becomes part of a filesystem path, so the raw project name cannot be used.

---

## 5. Command Flags

### 5.1 `--path <directory>`

Sets the target directory. A relative path resolves against the current working directory. If the directory does not exist, **ask the user first**, then continue.

### 5.2 `--preset <spring-boot|java>`

The fallback when detection comes up short.

| Key | `--preset spring-boot` | `--preset java` |
|---|---|---|
| `project.type` | `spring-boot` | `java` |
| `project.language` | `java` | `java` |
| `project.spring.boot_major` | **ask the user**: Boot 3 or 4 — never guess | not applicable — keep the `defaults.yml` value |
| `project.spring.build_tool` | detected, else `maven` | detected, else `maven` |
| `project.spring.persistence` | detected, else `jpa` | detected, else `jdbc` |

Two hard rules:

- **A preset sets no git or CI values** — those are always detected.
- **`boot_major` is never guessed.** Rule 4's reasoning applies: Boot 3 and Boot 4 differ in package locations (`com.fasterxml.jackson` vs `tools.jackson`) and test APIs (`@MockBean` vs `@MockitoBean`), so loading the wrong knowledge set produces code that compiles against the wrong API.

When a preset contradicts a detected value (e.g. `--preset java` but `pom.xml` declares `spring-boot-starter-parent`), **report the conflict and ask** — never silently pick one.

### 5.3 The config precedence chain

See [§4.6](#46-the-config-precedence-chain).

---

## 6. Relationship to `setup`

`setup` used to be the only initialization skill. `new-project` is now its **strict superset** — it covers everything `setup` does and detects more:

| Capability | `setup` | `new-project` |
|---|---|---|
| Detect stack / Boot major version / persistence | ✅ | ✅ |
| Detect git conventions (commit format, branches, CI platform) | ✅ (after alignment) | ✅ |
| Detect architecture pattern | ❌ | ✅ |
| `.workflows/specs` `history` `learned` | ✅ | ✅ |
| Copy `defaults.yml` in full | ✅ | ✅ |
| Apply the user plugin settings layer | ✅ | ✅ |
| Validate `config.yml` (8 checks) | ✅ | ✅ |
| Sync `.gitignore` | ✅ | ✅ |
| Install `guards.yml` | ✅ | ✅ |
| v2.x migration check | ✅ | ✅ |
| Generate `CLAUDE.md` | ❌ | ✅ |
| Generate `tasks/todo.md` `tasks/lessons.md` | ❌ | ✅ |
| Delegate CI generation | ❌ | ✅ |

**The two must not be run back to back.** Both rewrite `config.yml` wholesale, so the last one wins — and `setup`'s version is the weaker one: it does not write `git.pr.base_branch` (`hotfix` and `git-flow` read it to target PRs, and it would fall back to `develop`), `project.name`, or `ci.runner`.

**Division of labour**: `new-project` for new projects; `setup` for wiring an **existing** project into the workflow system.

---

## 7. Error Handling

| Situation | Resolution |
|---|---|
| `--path` directory does not exist | Ask whether to create it, then continue |
| `--path` directory is not readable | Report and suggest fixing the path |
| Not a git repository | Offer to run `git init` under `<root>` |
| No build files detected | Fall back to `--preset`; if none was passed, offer `spring-boot` / `java` |
| Preset contradicts a detected value | Report the conflict and ask which to use |
| `boot_major` cannot be determined | Ask the user — never guess (Rule 4) |
| Permission denied | Report and suggest a fix |
| `.gitignore` not writable | Report and print the entries to add manually; **do not fail the workflow** |
| `tasks/` already tracked by the project | Leave it as is; do not remove the entry |

---

## 8. Test Coverage

`tests/validate-workflows.js` (484 assertions; 4 sections covering this skill, +41 in total):

| Section | What it covers |
|---|---|
| `validateProjectInitParity` | The two skills produce identical `config.yml` and `.gitignore` content; `.workflows/` subdirectories present; `tasks/` never gitignored; directory name kebab-case and ≤40 chars |
| `validateSkillComposition` | The Rule 9 delegation contract: output routing, no overwriting `current-state.md`, skipping the delegated skill's Step 0 |
| `validateNewProjectCli` | The `--path` / `--preset` / Rule 15 CLI contract; target-root scoping; presets never override detected values; `boot_major` never guessed |
| `validateInitFeatureParity` | Both skills run the **same** config validation list; declare the **same** precedence chain; both check for v2.x leftovers; both install guards from the template |

The value of these assertions is **preventing two copies from drifting** — `setup` and `new-project` each maintain their own `.gitignore` block and validation list, and without assertions they would eventually diverge.

---

## 9. Design Trade-offs and Known Limits

**Deliberate trade-offs**

- **A failed config validation does not block the workflow** — it warns and offers a fix. Rationale: initialization should not fail outright over one bad enum value.
- **Presets cover only stack-related keys** — git and CI values are always detected, and a preset stays out of it.
- **Installing guards requires explicit confirmation** — silently writing a security config into someone's project is intrusive.
- **Phase 2.1 is the only approval gate** — but 1.4 (insufficient detection), 3.2 (`CLAUDE.md` already exists), 3.3 (generate CI?), and 4.3 (install guards?) are interaction points too. Placing the gate before generation is deliberate: correcting a bad `config.yml` after it is written costs more.

**Limits**

- `--path` only scopes this skill's own reads and writes; it does not change the root the model uses for everything else.
- The migration check only covers the two v2.x marker files `setup` knows about; it does not do a broader legacy scan.
- `boot_major` can only be confirmed by the user — there is no reliable way to infer it, which is exactly why it is left conservative.

---

## Related Files

| File | Role |
|---|---|
| `skills/new-project/SKILL.md` | the skill under analysis |
| `skills/setup/SKILL.md` | the initialization skill it superseded |
| `PROTOCOL.md` / `PROTOCOL.zh-CN.md` | the execution protocol injected at session start |
| `skills/_orchestration/rules/` | rule files (rule-00 … rule-17) |
| `skills/_orchestration/RULES.md` | rule index and precedence definitions |
| `hooks.json` | SessionStart / PreToolUse / PostToolUse hooks |
| `config/defaults.yml` | the config template (copied in full) |
| `tests/validate-workflows.js` | structural assertions |

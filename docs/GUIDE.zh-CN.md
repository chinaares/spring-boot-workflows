# Spring Boot Workflows —— 完整指南

## 目录

1. [什么是 Spring Boot Workflows](#1-什么是-spring-boot-workflows)
2. [安装](#2-安装)
3. [配置](#3-配置)
4. [推荐路径：按项目状态选择技能](#4-推荐路径按项目状态选择技能)
5. [工作流生命周期](#5-工作流生命周期)
6. [质量门禁](#6-质量门禁)
7. [全部命令](#7-全部命令)
8. [工作流详解](#8-工作流详解)
9. [头脑风暴系统](#9-头脑风暴系统)
10. [Git Flow 管理](#10-git-flow-管理)
11. [多会话状态管理](#11-多会话状态管理)
12. [Todo 与经验教训系统](#12-todo-与经验教训系统)
13. [子 Agent 策略](#13-子-agent-策略)
14. [文件参考](#14-文件参考)
15. [升级](#15-升级)
16. [故障排查](#16-故障排查)

---

## 1. 什么是 Spring Boot Workflows

一套面向 Claude Code AI agent 的**可移植、规格驱动（spec-driven）的开发工作流系统**，以 **Claude Code 插件**形式分发，并针对 Java/Spring 项目做了特化。它为构建功能、修复缺陷、重构、测试和发布提供了结构化、可重复的流程。

**核心原则**：先规格后代码。先头脑风暴后计划。先计划后实现。状态跨会话持久化。每个 PR 之前必过质量门禁。Spring 感知（构建/测试命令与 Boot 主版本自动检测）。Git 流程可配置。

**你将获得**：24 个工作流技能（以插件斜杠命令形式提供）、27 个内置 Spring Boot 领域技能、5 种头脑风暴技法、每次执行都会强制生效的 18 条编排规则、评审清单（通用 + Java + Spring Boot）、Java/Spring 编码规则、多会话持久化，以及单一的 YAML 配置文件。

---

## 2. 安装

**前置要求**：Git 仓库、Claude Code、`gh` CLI（用于 PR 相关工作流）。

### 第 1 步：安装插件

```bash
# 在 Claude Code 内执行
/plugin marketplace add chinaares/spring-boot-workflows
/plugin install spring-boot-workflows
```

安装期间，Claude Code 会提示配置 **userConfig** 各项取值：

| 提示项 | 默认值 | 可选值 |
|--------|---------|---------|
| `project_type` | `spring-boot` | `spring-boot`、`java`、`generic` |
| `team` | `none` | `spring`、`none` |
| `git_main_branch` | `main` | 任意分支名 |
| `git_dev_branch` | `develop` | 任意分支名 |
| `commit_format` | `conventional` | `conventional`、`angular`、`simple` |

这些取值会成为项目配置的初始值，日后可用 `claude plugin configure spring-boot-workflows` 修改。

### 第 2 步：初始化项目

```bash
# 在 Claude Code 内运行：
/spring-boot-workflows:setup
```

setup 技能会：

| 动作 | 结果 |
|--------|--------|
| 检测项目技术栈 | Maven/Gradle（优先 wrapper）、Spring Boot 主版本（`3`/`4`）、持久化技术栈（`jpa`/`jdbc`） |
| 创建状态目录 | `.workflows/`、`.workflows/specs/`、`.workflows/history/`、`.workflows/learned/` |
| 生成配置 | `.workflows/config.yml`（由插件默认值 + 你的 userConfig 合成） |
| 更新 `.gitignore` | 加入工作流状态相关条目 |

### 验证并提交

```bash
ls .workflows/
cat .workflows/config.yml
git add .workflows/config.yml .gitignore
git commit -m "chore: initialize spring-boot-workflows v1.0.0"
```

然后打开 Claude Code 并运行 `/spring-boot-workflows:start`。

---

## 3. 配置

所有配置都位于 `.workflows/config.yml`，由 setup 技能基于插件的 `config/defaults.yml` 生成。

**四层解析**（优先级由高到低）：
1. **CLI 参数** —— 单次调用的覆盖项（例如 `--skip-brainstorm`）
2. `.workflows/config.yml`（项目级覆盖）
3. 插件 userConfig（在 `claude plugin install` 期间设置的值）
4. 插件默认值（`<plugin-root>/config/defaults.yml`）

```yaml
version: "3.0"

project:
  name: "My Project"
  type: "spring-boot"                # spring-boot | java | generic
  language: "java"                   # Drives rule/checklist selection
  team: ""                           # Team name (spring)
  spring:
    boot_major: 4                    # 4 | 3 — selects the Spring Boot knowledge tree
    build_tool: "maven"              # maven | gradle
    persistence: "jpa"               # jpa | jdbc

git:
  branches:
    main: "main"
    development: "develop"
    feature: "feature/{name}"
    bugfix: "bugfix/{name}"
    hotfix: "hotfix/{name}"
    release: "release/v{version}"
  commits:
    format: "conventional"           # conventional | angular | simple
    types: [feat, fix, refactor, test, docs, chore, style, perf]
    scopes: true
    ticket_reference: false
  pr:
    base_branch: "develop"
    draft: false
    reviewers: []                     # GitHub 评审人登录名
    labels: []
    template: |                       # PR 正文模板，可用 {summary}/{changes}/{test_plan}
      ## Summary
      {summary}

      ## Changes
      {changes}

      ## Test Plan
      {test_plan}
  merge:
    strategy: "squash"               # squash | merge | rebase
    delete_branch: true
  protected: ["main", "master", "develop"]

ci:
  platform: "auto"                   # auto | github | gitea | both
  java_versions: [25]
  runner: "ubuntu-latest"
  mirror: "none"                     # none | aliyun | tsinghua
  features: [test, coverage, artifact]

workflows:
  new-feature:
    require_spec: true
    require_tests: true
    require_brainstorm: true
    max_plan_phases: 10
    adaptive: true
  extend-feature:
    require_brainstorm: true
    require_tests: true
  hotfix:
    base_branch: ""                  # Empty = use git.branches.main
    require_tests: true
    max_lines: 15
  refactor:
    require_brainstorm: true
    require_tests: true
    max_dependents: 50
  migrate:
    require_brainstorm: true
  release:
    changelog: true
    tag_format: "v{version}"
  review:
    checklist: "auto"                # auto | none | <path>
    size_thresholds: { small: 10, medium: 30, large: 50 }
  test:
    default_coverage: 90
    default_type: "unit"
  brainstorm:
    default_depth: "standard"        # quick | standard | deep
    techniques: ["trade-off-matrix", "six-thinking-hats", "scamper", "reverse-brainstorm", "constraint-mapping"]

state:
  directory: ".workflows"
  history: true
  max_history: 50

skills:
  disabled: []
  aliases:
    build: "new-feature"
    fix: "hotfix"
    ship: "release"

chains: {}
  # new-feature: "review --self"
  # hotfix: "ci-fix --pr latest"

guards:
  enabled: false
  config: ".workflows/guards.yml"

learning:
  enabled: true
  storage: ".workflows/learned"
  knowledge_graph: true

quality:
  self_review: true
  focused_gate: true
  proportional: true

progress:
  visual: true                       # 状态文件里写 Mermaid 进度图

telemetry:
  enabled: false                     # opt-in
  file: ".workflows/telemetry.jsonl"
```

**建议**：从 `project.name`、`project.type` 和 `git.branches` 开始配置。`project.type` 决定了自动加载哪些编码规则和评审清单。

**关于 `require_*` 开关**：它们只在值为 `false` 时才允许跳过对应阶段，值为 `true` 时该阶段必过。`new-feature` 另有一条与配置无关的跳过路径 —— 显式传 `--depth trivial` 会跳过 SPEC、BRAINSTORM 与 TEST（自适应深度评估为 Trivial 时只跳过 SPEC 与 BRAINSTORM，TEST 仍会执行），详见 [§4.3](#43-几条容易踩的路径选择规则)。

---

## 4. 推荐路径：按项目状态选择技能

插件提供 24 个工作流技能。它们不是 24 种平级选择 —— 而是覆盖了从「想清楚要做什么」到「发布上线」的完整链路。本节按**你此刻项目所处的状态**给出选择依据。

### 4.1 先问三个问题

在挑技能之前，先回答三个问题：

1. **有没有正在运行的工作流？** 有 → `/resume`（或直接跑 `/start`，它会先提示恢复、暂停或放弃）
2. **这件事的规模有多大？** 不确定 → `/scope`，它只做复杂度预判，不碰代码
3. **是新建能力，还是改动既有代码？** 决定 `new-feature` 还是 `extend-feature`

### 4.2 30 秒决策表

| 你此刻的状态 | 用这个技能 | 一句话理由 |
|---|---|---|
| 项目还没初始化过 | `/setup` | 检测技术栈、建 `.workflows/` 目录、生成 `config.yml`、更新 `.gitignore` |
| 要开一个全新项目 | `/new-project` | 生成 `config.yml` + `CLAUDE.md` + 任务脚手架，取代 `/setup` |
| 只有模糊想法，还不知道做到什么程度 | `/scope` | 只做复杂度评估，给出该走哪条 workflow、要不要拆分 |
| 想法已明确，但方案没定 | `/brainstorm` | 交互式发散/收敛，产出一份决策记录 |
| 要新建一个功能 | `/new-feature` | 完整流水线：GATHER → … → PR |
| 要给既有功能加能力，且能保持向后兼容 | `/extend-feature` | 最小影响原则：只加不改，先新增文件后改既有文件 |
| 要给既有功能加能力，但必然破坏兼容 | 先 `/scope`，再走 `/new-feature` | `extend-feature` 的红线是不改既有签名 |
| 要动既有代码结构但行为不变 | `/refactor` | 行为契约 + 逐步可编译可回滚 |
| 要升级依赖 / 换 API / 改 schema | `/migrate` | 每一步都能独立编译且测试通过 |
| 生产出问题了，要马上修 | `/hotfix` | 最小改动 + 强制回归测试 + cherry-pick 方案 |
| bug 现象不清，不知道根因 | `/diagnose` | 只定位不修复，定位完交给下游技能 |
| 线上 CI 挂了 | `/ci-fix` | 拉日志 → 分类 → 针对性修复 → 监控重试 |
| 仓库还没有 CI | `/ci-setup` | 生成 GitHub / Gitea Actions 工作流 |
| 某段代码没测试、覆盖率不够 | `/test` | 分支映射 + 分类编写 + 缺口报告 |
| 要审一个别人的 PR | `/review` | 分层分类 + 带严重级别的行内评论 |
| 要发版 | `/release` | 变更日志 → 版本号 → 发布分支 → PR → 打标签 |
| 只想要 git 操作，不想跑完整工作流 | `/git-flow` | 分支 / 提交 / PR / 合并 |
| 担心提交了密钥或危险操作 | `/guards` | 凭据模式、受保护路径、危险命令检查 |
| 之前做过类似功能，想复用 | `/template` | 复用已保存的规格 + 计划 |
| 想让团队沉淀经验 | `/learn` | 捕获可复用模式，在后续头脑风暴中浮现 |
| 想知道流程哪里慢、哪卡 | `/metrics` | 完成率、平均耗时、瓶颈阶段、趋势对比 |
| 想改进流程本身的配置 | `/retrospective` | 从历史找问题，给出可执行的配置改动 |
| 想自定义一套流程 | `/compose-skill` | 交互式生成结构规范的 `SKILL.md` |
| 就是不知道该用哪个 | `/start` | 交互式菜单，按 6 类分组列出全部工作流 |
| 中途被打断了 | `/resume` | 校验状态文件并从中断处继续 |

### 4.3 几条容易踩的路径选择规则

#### ① 先用 `scope` 定粒度，再启动流水线

`scope` 的分档表直接给出了复杂度到工作流的映射：

| 信号 | 规模 | 推荐工作流 |
|---|---|---|
| 1-2 文件、无新 API | **Trivial** | 直接编辑，不用工作流 |
| 3-10 文件、1-2 层 | **Small** | `/new-feature --depth trivial` 或 `/extend-feature` |
| 10-25 文件、2-3 层 | **Medium** | `/new-feature`（标准深度） |
| 25-50 文件、3+ 层 | **Large** | `/new-feature`（自适应判定为 complex 深度）—— 建议拆分 |
| 50+ 文件或破坏性变更 | **Epic** | 必须拆成多个工作流 |

注意 `scope` 并非总是指向 `new-feature`：Trivial 档建议直接编辑，Small 档建议 `extend-feature`。

#### ② `--depth trivial` 会跳过 SPEC、BRAINSTORM 和 TEST

这一点与配置里的 `require_spec: true` / `require_brainstorm: true` / `require_tests: true` 无关 —— 这三个开关只在值为 `false` 时才允许跳过。要注意区分两条路径：

| 触发方式 | 跳过的阶段 | 走的链路 |
|---|---|---|
| 显式 `--depth trivial` | SPEC、BRAINSTORM、**TEST** | GATHER → PLAN → BRANCH → IMPLEMENT → PR |
| 自适应深度评估为 Trivial（1-2 文件、<20 行） | SPEC、BRAINSTORM | 走轻量计划，TEST 仍会执行 |

**要保证走完整流程，显式传 `--depth full`。**

#### ③ `extend-feature` 有向后兼容红线

不改既有签名、不改既有测试断言、修改文件数不超过新增文件数 —— PLAN 阶段会校验其中**两条**（修改文件数 ≤ 新增文件数、无签名变更），测试断言与行为兼容性由 VERIFY-COMPAT 阶段兜底。如果这次扩展必然破坏兼容，`extend-feature` 会要求你提出替代方案（必要时记录迁移方案），此时应改用 `new-feature`。

#### ④ `diagnose` 只诊断，不修复

它的 ROOT-CAUSE 阶段输出确切的文件、行号与影响范围后就结束。修复交给 `/hotfix`（线上紧急）或 `/new-feature`（常规需求）。

#### ⑤ `hotfix` 有改动量上限

默认 `max_lines: 15`，超过会警告并要求确认。改动量一大就说明它本质不是 hotfix。

#### ⑥ 领域技能是自动路由的，不是手动调用

Spring Boot 项目在实现阶段前，`spring-context` 会根据改动的文件路径决定加载哪些知识集。**改动没碰到安全相关文件，即使语义上与安全有关，也不会加载安全技能** —— 命中 `**/security/**`、`**/*SecurityConfig.java`、`**/*Jwt*.java`、`**/auth/**` 才会路由到 `spring-security-jwt`（自签令牌）或 `oauth2-resource-server`（外部 IdP）。Boot 3 项目的技能名带 `-boot3` 后缀。

#### ⑦ PR 之前一定会过质量门禁

门禁档位按改动规模自动选择：≤3 文件且 ≤50 行走 Light（仅 Critical 项）；4-15 文件走 Standard（High + Critical）；>15 文件走 Full（全量级别）。

### 4.4 常见接力路径

| 起 | 止 | 说明 |
|---|---|---|
| `/scope` | `/new-feature` | 先定粒度再启动流水线，避免在错误规模上开一条长流程 |
| `/brainstorm` | `/new-feature` | brainstorm 产出的决策可作为 SPEC 与 BRAINSTORM 阶段的输入 |
| `/template use` | `/new-feature` | 模板预填规格与计划，从 PLAN 阶段继续，GATHER/SPEC/BRAINSTORM 标记为 SKIPPED |
| `/diagnose` | `/hotfix` | 定位到根因后立即转最小修复 |
| `/diagnose` | `/new-feature` | 根因分析指向缺失的能力，走正常需求流程 |
| `/new-feature` | `/review` | 完成后的自审，也可用 `chains` 配置自动串联 |
| `/hotfix` | `/ci-fix` | 修复后确认流水线是否恢复 |
| `/test` | `/new-feature` | 补齐测试后回到实现流程 |

---

## 5. 工作流生命周期

**每个工作流都有自己的阶段链**，不是所有技能都共享同一条。共性的是状态机骨架：

```text
IDLE -> <收集/诊断> -> <方案> -> <计划> -> <实现> -> <验证> -> <PR> -> DONE
                                                        |
                                                   REPLAN -> back to 实现阶段
```

各工作流的实际阶段链：

| 工作流 | 阶段链 |
|--------|--------|
| `new-feature` | GATHER → SPEC → BRAINSTORM → PLAN → BRANCH → IMPLEMENT → TEST → PR |
| `extend-feature` | ANALYZE → BRAINSTORM → PLAN → IMPLEMENT → VERIFY-COMPAT → TEST → PR |
| `refactor` | ANALYZE → BRAINSTORM → CONTRACT → DESIGN → MIGRATE → VERIFY → PR |
| `migrate` | ANALYZE → BRAINSTORM → PLAN → EXECUTE → VERIFY → PR |
| `hotfix` | DIAGNOSE → FIX → REGRESSION-TEST → PR → CHERRY-PICK |
| `test` | ANALYZE → PLAN → WRITE → VERIFY → REPORT |
| `review` | FETCH → CATEGORIZE → CHECK → COMMENT |
| `diagnose` | REPRODUCE → HYPOTHESIZE → NARROW → ROOT-CAUSE |
| `ci-fix` | FETCH → DIAGNOSE → FIX → PUSH → MONITOR |
| `ci-setup` | DETECT → CONFIGURE → GENERATE → VALIDATE → REPORT |
| `release` | CHANGELOG → VERSION-BUMP → RELEASE-BRANCH → PR → TAG |
| `brainstorm` | EXPLORE → EVALUATE → RECOMMEND |
| `new-project` | DETECT → CONFIGURE → GENERATE → SETUP |

以 `new-feature` 为例，各阶段产出：

| 阶段 | 发生什么 | 产出 |
|-------|-------------|--------|
| **GATHER**（收集） | 收集需求（Jira、Figma、用户、规格文件） | `.workflows/<feature>/01-gather.md` |
| **SPEC**（规格） | 生成正式规格说明 | `.workflows/<feature>/02-spec.md` |
| **BRAINSTORM**（头脑风暴） | 探索方案、评估权衡 | `.workflows/<feature>/03-brainstorm.md` |
| **PLAN**（计划） | 分阶段的实现计划 | `.workflows/<feature>/plan.md` |
| **BRANCH**（分支） | 按 git 配置创建功能分支 | Git 分支 |
| **IMPLEMENT**（实现） | 逐阶段写代码并做构建检查 | 源代码 + 提交 |
| **TEST**（测试） | 编写并运行测试 | 测试文件 + 结果 |
| **PR** | 推送分支、创建拉取请求 | GitHub / Gitea PR |
| **DONE**（完成） | 归档状态、汇报总结 | 历史记录 |

**编排规则**（`<plugin-root>/skills/_orchestration/RULES.md`）对每次执行都生效：阶段产出文档写入 `.workflows/<feature>/`，每次切换都更新状态，自动检测构建/测试命令，强制执行质量门禁，支持工作流链式调用。

**可跳过的阶段**：在配置中设置 `require_spec/brainstorm/tests: false`，或传入 `--skip-brainstorm`。注意 `new-feature` 还有一条独立于配置的跳过路径：显式传 `--depth trivial` 会跳过 SPEC、BRAINSTORM 与 TEST（详见 [§4.3 路径选择规则](#43-几条容易踩的路径选择规则)）。

**决策点**：SPEC、BRAINSTORM、PLAN 之后，以及 PR 之前。未经你批准，工作流绝不会继续推进（除非传入 `--auto`）。

**REPLAN**：当编译失败 3 次以上、计划有误，或你要求变更时触发。它会停下、记录问题、重新计划，并请求批准。

---

## 6. 质量门禁

有两套机制在所有工作流中强制执行代码标准。二者都**随插件打包**，并根据 `project.type` 动态加载（本插件的语言固定为 Java）。

### 编码规则（`<plugin-root>/rules/`）

实现阶段之前加载的语言专用 DO/DON'T 模式。目前提供：Java 与 Spring Boot。由配置中的 `project.type` 选择 —— `spring-boot` 加载 `java.md` + `spring-boot.md`；`java` 只加载 `java.md`。

### 评审清单（`<plugin-root>/reviews/`）

在创建任何 PR 之前，agent 会对照以下清单自检：
1. `general-checklist.md`（始终加载）
2. Java / Spring Boot 清单（由 `project.type` 自动检测）
3. 团队清单（若已定义）

「严重」与「高」级别的违规必须在创建 PR 之前修复。清单的**加载档位随改动规模伸缩**：

| 改动规模 | 门禁档位 | 检查范围 |
|---|---|---|
| ≤3 文件且 ≤50 行 | **Light** | 仅通用清单的 Critical 项，跳过语言专用清单 |
| 4-15 文件 | **Standard** | 通用清单 + 语言专用清单的 High 与 Critical 项 |
| >15 文件 | **Full** | 全部清单、全部严重级别 |

每个 Critical 项都要给出**显式结论**（`PASS: <项> — <证据>` / `FAIL: <项> — <问题> — <修法>` / `N/A: <项> — <原因>`）。「检查过了，没问题」不算证据。

```yaml
quality:
  self_review: true      # PR 前自检清单
  focused_gate: true     # 按改动文件类别加权检查
  proportional: true     # 门禁档位随改动规模伸缩
```

---

## 7. 全部命令

所有命令的命名空间均为 `spring-boot-workflows:`。

| 命令 | 说明 |
|---------|-------------|
| `/spring-boot-workflows:setup [--with-guards]` | 初始化项目（目录、配置、.gitignore），可选同时生成守卫配置 |
| `/spring-boot-workflows:new-project [--path <dir>] [--preset <spring-boot\|java>]` | 初始化项目脚手架（生成 `CLAUDE.md` 与任务目录） |
| `/spring-boot-workflows:start` | 工作流入口：显示活动工作流、列出菜单、收集参数后直接执行 |
| `/spring-boot-workflows:resume` | 恢复已暂停/中断的工作流 |
| `/spring-boot-workflows:scope <description>` | 开始前分析任务复杂度，推荐工作流与拆分方案 |
| `/spring-boot-workflows:brainstorm --topic "<描述>" [--depth quick\|standard\|deep]` | 独立的头脑风暴 |
| `/spring-boot-workflows:new-feature <name> [--from-ticket <url-or-id>] [--from-figma <url>] [--from-spec <path>] [--skip-brainstorm] [--depth full\|trivial] [--auto]` | 端到端构建一个新功能 |
| `/spring-boot-workflows:extend-feature <feature-name> <描述> [--skip-brainstorm] [--auto]` | 在既有功能上扩展（保持向后兼容） |
| `/spring-boot-workflows:refactor <target> [--scope file\|module\|feature] [--goal "描述"] [--skip-brainstorm] [--auto]` | 安全地重构代码 |
| `/spring-boot-workflows:migrate <dependency\|api-version\|architecture\|database> [--skip-brainstorm] [--auto]` | 增量迁移 |
| `/spring-boot-workflows:hotfix <description> [--crashlytics <issue-id>] [--log <path>] [--branch <生产分支>]` | 生产环境紧急修复 |
| `/spring-boot-workflows:diagnose <symptom> [--error <错误信息>] [--file <path>] [--since <commit-or-date>]` | 系统化的缺陷排查（只定位不修复） |
| `/spring-boot-workflows:ci-fix [--run <run-id>] [--pr <pr-number>] [--platform github\|gitea]` | 修复 CI/CD 失败 |
| `/spring-boot-workflows:ci-setup [--platform github\|gitea\|both] [--features test,coverage,spotbugs,artifact] [--java <version>] [--runner <label>] [--mirror aliyun\|tsinghua\|none] [--skip-it] [--dry-run]` | 生成 GitHub/Gitea Actions CI 工作流 |
| `/spring-boot-workflows:test <target> [--coverage <pct>] [--type unit\|integration]` | 生成测试并统计覆盖率 |
| `/spring-boot-workflows:review <pr-number> [--strict] [--focus <area>]` | 评审一个拉取请求 |
| `/spring-boot-workflows:release <version> [--type major\|minor\|patch]` | 准备一个带版本号的发布 |
| `/spring-boot-workflows:git-flow branch <type> <name>` \| `commit <message>` \| `pr [--base <branch>]` \| `merge <branch>` | Git 分支/提交/PR/合并操作 |
| `/spring-boot-workflows:guards init` \| `check [--staged] [--force]` \| `report` | 凭据与危险操作的安全检查 |
| `/spring-boot-workflows:template save <name>` \| `list` \| `use <name> <feature>` | 保存与复用工作流模板 |
| `/spring-boot-workflows:learn capture` \| `list` \| `apply <topic>` | 从工作流中捕获可复用模式 |
| `/spring-boot-workflows:metrics` \| `<workflow-name>` \| `trends` | 工作流度量与遥测 |
| `/spring-boot-workflows:retrospective [--last <N>] [--workflow <name>]` | 分析工作流历史以寻找改进点 |
| `/spring-boot-workflows:compose-skill <name>` | 编排自定义技能 |

---

## 8. 工作流详解

本节按**从立项到发布**的顺序展开每个工作流。每条给出命令形式、实际阶段链与关键约束。

### 范围评估（Scope）

```text
/spring-boot-workflows:scope <description>
```

**唯一不改代码的技能** —— 不创建状态文件、不动仓库，只做预检：扫描相关文件、统计涉及分层、检查是否存在破坏性变更，输出复杂度评级（Trivial / Small / Medium / Large / Epic）、推荐工作流与拆分方案。

它是启动流水线前的第一道闸门。**Trivial 档会建议你直接编辑而不用工作流**，Small 档建议 `extend-feature`，Medium 以上才建议 `new-feature`。

### 新功能（New Feature）

最完整的工作流。把一个功能从想法一路带到合并的 PR。

```text
/spring-boot-workflows:new-feature <name> [--from-ticket <url-or-id>] [--from-figma <url>] [--from-spec <path>] [--skip-brainstorm] [--depth full|trivial] [--auto]
```

**GATHER**：从 Jira（MCP）、Figma（MCP）、规格文件或交互式提问中收集信息，多种来源可以组合使用。**SPEC**：生成包含用户故事、验收标准、范围、技术要求、边界情况的规格。**BRAINSTORM**：用结构化技法评估 2-4 种方案，产出决策文档。**PLAN**：在 `.workflows/<feature>/plan.md` 中给出分阶段实现计划，每个阶段包含涉及文件、细节、构建检查与提交信息。若 `tasks/todo.md` 已存在，则按阶段追加可勾选项。**BRANCH**：按 git 配置创建分支。**IMPLEMENT**：逐阶段实现，伴随构建检查、提交与状态更新。Java/Spring 规则从 `<plugin-root>/rules/` 加载，领域技能由 `spring-context` 路由。反复失败时触发 REPLAN。**TEST**：覆盖所有新增代码，并报告覆盖率。**PR**：先跑质量门禁清单，再用平台 CLI（`gh` 或 `tea`）创建 PR。

`--depth trivial` 跳过 SPEC、BRAINSTORM 与 TEST；`--depth full` 完整执行八个阶段，不做自动跳过。`--auto` 跳过审批门，在每个决策点采用推荐选项。

决策点位于 SPEC、BRAINSTORM、PLAN 之后，以及 PR 之前。

### 扩展功能（Extend Feature）

```text
/spring-boot-workflows:extend-feature <feature-name> <extension-description> [--skip-brainstorm]
```

**保守型**工作流：必须保持既有行为不变。优先新增文件而非修改既有文件。使用 SCAMPER 头脑风暴技法。VERIFY-COMPAT 阶段确保所有既有测试仍然通过。若既有测试被破坏，修的是新代码（而不是测试）。

### 重构（Refactor）

```text
/spring-boot-workflows:refactor <target> [--scope file|module|feature] [--goal "description"] [--skip-brainstorm] [--auto]
```

完整的依赖图分析，改动之前先记录行为契约，采用增量迁移，且**每一步都能独立编译并通过测试**。头脑风暴使用约束映射（Constraint Mapping）与权衡矩阵（Trade-off Matrix），其中影响半径权重最高。

### 诊断（Diagnose）

```text
/spring-boot-workflows:diagnose <symptom> [--error <错误信息>] [--file <path>] [--since <commit-or-date>]
```

阶段链 **REPRODUCE → HYPOTHESIZE → NARROW → ROOT-CAUSE**。复现缺陷、生成带证据的排序假设、用针对性测试或 `git bisect` 逐一排除，最后给出确切的文件、行号与影响范围。

**它不做修复** —— ROOT-CAUSE 阶段结束后即结束，把定位结果交给 `/hotfix`（线上紧急）或 `/new-feature`（常规需求）。

### 紧急修复（Hotfix）

```text
/spring-boot-workflows:hotfix <description> [--crashlytics <issue-id>] [--log <path>] [--branch <production-branch>]
```

为**速度**优化。不做头脑风暴、不写规格。改动量绝对最小，从生产分支切出。流程为：诊断 → 修复 → 回归测试 → PR → Cherry-Pick 方案。

### 测试（Test）

```text
/spring-boot-workflows:test <target> [--coverage <pct>] [--type unit|integration]
```

目标形式：`class:Name`、`file:path`、`module:name`、`feature:name`。分析公开 API、依赖、分支、边界情况。按项目既有约定编写测试。默认覆盖率目标：90%。

### 评审（Review）

```text
/spring-boot-workflows:review <pr-number>
```

通过 `gh` 拉取 PR，按分层对改动分类，检查架构/质量/安全/性能/覆盖率/规范。生成带严重级别的行内评论。由你决定提交哪些。

### 发布（Release）

```text
/spring-boot-workflows:release <version> [--type major|minor|patch]
```

根据上次标签以来的提交生成变更日志，在 `build.gradle(.kts)` / `build.gradle` / `package.json` / `Cargo.toml` / `pyproject.toml` / `version.properties` / `VERSION` 中检测并递增版本号，创建发布分支，向生产分支提 PR，并给出打标签的命令。不传具体版本时，`--type` 决定按 semver 计算下一版。

### CI 修复（CI Fix）

```text
/spring-boot-workflows:ci-fix [--run <run-id>] [--pr <pr-number>] [--platform github|gitea]
```

通过 `gh` 获取失败详情，分类（编译/测试/lint/依赖/配置/超时），实施针对性修复，推送，并给出监控命令。

### CI 生成（CI Setup）

```text
/spring-boot-workflows:ci-setup [--platform github|gitea|both] [--features test,coverage,spotbugs,artifact] [--java <version>] [--runner <label>] [--mirror aliyun|tsinghua|none] [--skip-it] [--dry-run]
```

检测平台、构建系统、Java 版本与质量工具，生成测试、覆盖率、静态分析与制品上传步骤。会校验 GitHub 与 Gitea 在上下文命名空间、Action URL 上的差异，并保证 Maven 缓存路径与实际本地仓库一致。

`--dry-run` 只预览要写入的文件而不落盘，`--skip-it` 跳过与 CI 互斥的项目级步骤。

### 迁移（Migrate）

```text
/spring-boot-workflows:migrate <dependency|api-version|architecture|database> [--skip-brainstorm] [--auto]
```

类型：`dependency`、`api-version`、`architecture`、`database`。每一步都能独立编译且测试通过。针对不同类型提供专门指导：版本对比、端点映射、模式迁移、schema 迁移。

### 新项目（New Project）

```text
/spring-boot-workflows:new-project [--path <directory>] [--preset <spring-boot|java>]
```

检测构建系统、Spring Boot 版本、持久化技术栈、CI 系统与 git 约定。生成 `.workflows/config.yml`、`CLAUDE.md`、`tasks/todo.md`、`tasks/lessons.md` 以及目录结构。对新项目而言，它取代 `/setup`。

### 初始化、入口与恢复（Setup / Start / Resume）

这三个技能构成工作流的入口层，不产出代码。

| 技能 | 命令 | 做什么 |
|---|---|---|
| **Setup** | `/spring-boot-workflows:setup [--with-guards]` | 检测技术栈（Maven/Gradle、Boot 主版本、持久化栈），建 `.workflows/` 目录结构，合成 `.workflows/config.yml`，更新 `.gitignore`。`--with-guards` 同时生成 `.workflows/guards.yml` |
| **Start** | `/spring-boot-workflows:start` | 先检查有没有活动工作流（给出恢复 / 暂停 / 放弃三个选项），再按 **Build / Fix / Improve / Ship / Think / Meta** 六组列出 17 个工作流，收集完参数后直接执行对应技能 |
| **Resume** | `/spring-boot-workflows:resume` | 定位状态文件、解析并校验状态、加载上下文与规格计划、汇报当前阶段与进度，从中断处继续 |

**Start 会替你做入口判断** —— 不确定用哪个技能时，从 `/start` 开始即可，它同时也是查看当前活动工作流的方式。

### 元流程技能（Guards / Template / Learn / Metrics / Retrospective / Compose Skill）

这六个技能改进的是**流程本身**，而非代码。

| 技能 | 命令 | 做什么 |
|---|---|---|
| **Guards** | `init` / `check [--staged] [--force]` / `report` | 按 `.workflows/guards.yml` 扫描文件：硬编码令牌（`AKIA`、`sk-`、`ghp_`、`Bearer`、私钥、JWT）、受保护路径、`rm -rf` 等危险命令。`BLOCK` 直接拦截，`WARN` 仅提示。`--force` 放行会留痕到 `.workflows/history/guard-overrides.log` |
| **Template** | `save <name>` / `list` / `use <name> <feature>` | 把已完成工作流的规格 + 计划存成带 `{feature}` 占位符的模板。`use` 会预填规格与计划并从 **PLAN 阶段**继续，GATHER/SPEC/BRAINSTORM 标记为 SKIPPED |
| **Learn** | `capture` / `list` / `apply <topic>` | 从已完成工作流中提取可复用模式（架构决策、实现套路、测试策略），带标签存入 `.workflows/learned/`。被使用 2 次以上的模式标记为「已验证」，并在后续头脑风暴中自动浮现 |
| **Metrics** | `/` / `<workflow-name>` / `trends` | 读取遥测数据（阶段结束后写入的 JSON lines），展示完成率、平均耗时、瓶颈阶段。`trends` 对比最近 10 个与此前 10 个工作流，看速度变化与 REPLAN 频率 |
| **Retrospective** | `[--last <N>]` / `[--workflow <name>]` | 从遥测与历史中找出高成功率的流程、反复触发的 REPLAN、总是出问题的阶段，给出可执行的配置改动，并可自动应用已批准的更新 |
| **Compose Skill** | `<name>` | 交互式创建自定义工作流技能：问清它做什么、有哪些阶段、每阶段产出什么、是否需要头脑风暴、是否创建 PR，然后生成结构规范的 `SKILL.md`（frontmatter、编排集成、阶段输出路径、错误处理） |

---

## 9. 头脑风暴系统

既可独立运行（`/spring-boot-workflows:brainstorm --topic "<描述>"`），也可作为任意工作流的一部分运行。`--topic` 是必填参数。

### 5 种技法

| 技法 | 方法 |
|-----------|--------|
| **权衡矩阵（Trade-off Matrix）** | 按加权维度（复杂度、可维护性、性能、可测试性、时间）为选项打分 |
| **六顶思考帽（Six Thinking Hats）** | 6 个视角：事实、感受、风险、收益、创造力、流程 |
| **SCAMPER** | 替代、组合、调整、修改、他用、消除、重排 |
| **逆向头脑风暴（Reverse Brainstorm）** | 「这怎么会失败？」—— 把失败反转为缓解措施 |
| **约束映射（Constraint Mapping）** | 分析之前先按硬性/软性约束做过滤 |

### 深度级别

| 深度 | 方案数 | 技法 | 交互轮次 | 适用场景 |
|-------|---------|-----------|--------|------|
| `quick` | 2 | 约束映射 + 权衡矩阵 | 2-3 轮 | 简单决策 |
| `standard` | 3 | 1 种技法 + 权衡矩阵 | 5-8 轮 | 大多数功能 |
| `deep` | 4+ | 多种技法 + 权衡矩阵 | 10+ 轮 | 架构决策、高风险改动 |

**默认行为**：技法选择取决于深度级别 —— 独立的头脑风暴按深度配置选择技法。extend-feature 明确使用 SCAMPER，refactor 使用约束映射。所有级别都包含权衡矩阵用于最终评估。

**自动判定深度**：未显式传 `--depth` 时按信号推断 —— 命名/样式类或 1-2 个文件 → `quick`；3-10 个文件且无破坏性变更 → `standard`；>10 个文件、破坏性变更、数据迁移或多服务 → `deep`。信号冲突时取**最高**深度，不确定时默认 `standard`。判定后会先告诉你结论，再让你调整。

**独立运行 vs 被委派**：单独跑 `/brainstorm` 时它走完整的 EXPLORE → EVALUATE → RECOMMEND 并写入 `.workflows/<topic>/`；被 `new-feature` 委派时则内联执行，并把产出写进该工作流的目录。

---

## 10. Git Flow 管理

由 `/spring-boot-workflows:git-flow` 技能处理，配置读取自 `.workflows/config.yml`。

- **分支**：基于模式（`feature/{name}`、`release/v{version}`）
- **提交**：Conventional、Angular 或 Simple 格式
- **PR**：模板中支持 `{summary}`、`{changes}`、`{test_plan}`、`{ticket}` 变量
- **受保护分支**：直接提交时发出警告，并建议改用功能分支
- **Hotfix cherry-pick**：给出把修复回移到开发分支的命令

---

## 11. 多会话状态管理

三层持久化解决了会话之间的上下文丢失问题：

| 层次 | 文件 | 用途 |
|-------|------|---------|
| 状态 | `.workflows/current-state.md` | 阶段、进度、上下文笔记 |
| 规格 + 计划 | `.workflows/<feature>/`、`.workflows/<feature>/plan.md` | 做什么与怎么做（含 `[x]` 进度） |
| Git | 分支、日志、diff | 已提交与未提交的代码 |

**会话恢复**（`/spring-boot-workflows:resume`）：读取状态、规格、计划；校验分支；汇报阶段与进度；从中断处继续。

状态文件中的**上下文笔记**贯穿整个工作流，持续记录决策与发现。

同一时间只有**一个活动工作流**。可选操作：恢复、暂停（保存为 `paused-<name>.md`）、放弃（归档到 `history/`）。

---

## 12. Todo 与经验教训系统

**`tasks/todo.md`**：由 `/new-project` 创建（`# Todo` / `## In Progress` / `## Backlog` 三段）。`/new-feature` 的 PLAN 阶段在文件已存在时按阶段追加可勾选项 —— 它不会创建这个文件。

**`tasks/lessons.md`**：由 `/new-project` 创建。记录失误 —— 出了什么问题、正确做法是什么、如何预防 —— 供你和 Claude 在类似工作开始前查阅。

| 文件 | 内容 | 更新时机 |
|------|------|---------|
| `tasks/todo.md` | 日常操作清单 | `/new-project` 创建；PLAN 阶段追加阶段条目 |
| `.workflows/<feature>/plan*.md` | 架构计划 | 计划阶段与 REPLAN |
| `.workflows/current-state.md` | 会话元数据 | 阶段边界 |

---

## 13. 子 Agent 策略

工作流可以借助子 agent 并行处理任务，并保护主上下文窗口。以下是推荐策略 —— Claude 会根据任务复杂度自行决定是否启用子 agent。

| 阶段 | 子 Agent | 目的 |
|-------|-----------|---------|
| GATHER | 1 个 Explore | 扫描代码库 |
| BRAINSTORM | 2 个并行 | 分析 + 寻找替代方案 |
| PLAN | 1 个 Plan | 设计实现方案 |
| IMPLEMENT | 无 | 主线程编写全部代码 |
| TEST | 1 个后台 | 运行测试套件 |
| REVIEW | 1 个专家 | 分析 PR diff |

规则：每个 agent 只负责一个任务。主线程编写全部代码。最多 3 个并发。结果以摘要形式返回，而不是原样倾倒。

> 这张表是**建议策略**，不是技能里的硬编码调度 —— 技能定义本身不强制创建子 agent。是否启用、启用几个，由 Claude 根据任务复杂度与上下文压力自行判断。上表给出的是各阶段值得并行化的典型场景。

---

## 14. 文件参考

### 随插件打包

这些文件随插件一同分发并自动加载。它们**不会**被复制到你的项目中。

| 路径（相对于插件根目录） | 用途 |
|-------------------------------|---------|
| `skills/*/SKILL.md` | 25 个文件：24 个工作流技能 + `spring-context` 路由器（自动发现） |
| `skills/_orchestration/RULES.md` | 全局编排规则 |
| `templates/*.tmpl` | 6 个模板（spec、plan、state、skill、changelog、guards.yml） |
| `rules/*.md` | Java 与 Spring Boot 编码规则 |
| `reviews/*.md` | 通用、Java、Spring Boot 三份评审清单 |
| `teams/*` | 团队约定（`spring`）与新建团队的 `_template` |
| `skills/spring-boot-3/`、`skills/spring-boot-4/` | 27 个内置 Spring Boot 领域技能 |
| `config/defaults.yml` | 默认配置 |
| `settings.json` | 插件权限 |

### 在你的项目中创建

| 路径 | 纳入 Git | 创建者 |
|------|:-:|-----------|
| `.workflows/config.yml` | 是 | `/spring-boot-workflows:setup` |
| `.workflows/<feature>/NN-<phase>.md` | 否 —— `.workflows/*/` 已被 gitignore | 各阶段 |
| `.workflows/<feature>/plan.md` | 否 —— `.workflows/*/` 已被 gitignore | PLAN 阶段 |
| `.workflows/current-state.md` | 否 | 阶段切换 |
| `.workflows/paused-*.md` | 否 | 暂停命令 |
| `.workflows/history/` | 否 | 完成时 |
| `.workflows/specs/` | 否 | `/setup`（预留目录） |
| `.workflows/learned/` | 否 | 学习系统 |
| `.workflows/templates/<name>/` | 否 | `/template save` |
| `.workflows/knowledge.jsonl` | 否 | 工作流结束时的决策提取（Rule 16） |
| `.workflows/telemetry.jsonl` | 否 | 各阶段结束后追加的遥测记录 |
| `.workflows/history/guard-overrides.log` | 否 | `/guards --force` 的放行留痕 |
| `tasks/todo.md` | 是 | `/new-project` 创建；PLAN 阶段追加 |
| `tasks/lessons.md` | 是 | `/new-project` |

---

## 15. 升级

```bash
claude plugin update spring-boot-workflows
```

插件会自动更新技能、模板、规则与清单。项目级配置（`.workflows/config.yml`）、状态文件与任务记录都会保留。

重新配置插件设置：

```bash
claude plugin configure spring-boot-workflows
```

查看当前版本：

```bash
cat $(claude plugin path spring-boot-workflows)/VERSION
```

---

## 16. 故障排查

| 问题 | 解决方案 |
|---------|----------|
| 技能不出现 | 运行 `claude plugin list`，确认 `spring-boot-workflows` 已安装 |
| 找不到命令 | 所有命令都带命名空间：`/spring-boot-workflows:<skill-name>` |
| Git 操作失败 | 检查 `.workflows/config.yml` 中的分支名 |
| 创建 PR 失败 | 运行 `gh auth status` |
| 状态损坏 | 删除 `.workflows/current-state.md` 后重新开始 |
| 质量门禁未运行 | 检查 `.workflows/config.yml` 中的 `quality.self_review: true` |
| 加载了错误的规则 | 检查 `.workflows/config.yml` 中的 `project.type`（`spring-boot` 会加载两份规则文件） |
| 配置缺失 | 运行 `/spring-boot-workflows:setup` 重新生成 |

### 重置

```bash
# 重置工作流状态
rm .workflows/current-state.md .workflows/paused-*.md

# 彻底重装插件（在 Claude Code 内）
/plugin uninstall spring-boot-workflows
/plugin marketplace add chinaares/spring-boot-workflows
/plugin install spring-boot-workflows

# 重新初始化项目
# 然后运行 /spring-boot-workflows:setup
```

### 查看插件内容

```bash
# 查看某个技能定义
cat $(claude plugin path spring-boot-workflows)/skills/new-feature/SKILL.md

# 查看编排规则
cat $(claude plugin path spring-boot-workflows)/skills/_orchestration/RULES.md

# 查看你的项目配置
cat .workflows/config.yml
```

# Spring Boot Workflows —— 完整指南

## 目录

1. [什么是 Spring Boot Workflows](#1-什么是-spring-boot-workflows)
2. [安装](#2-安装)
3. [配置](#3-配置)
4. [工作流生命周期](#4-工作流生命周期)
5. [质量门禁](#5-质量门禁)
6. [全部命令](#6-全部命令)
7. [工作流详解](#7-工作流详解)
8. [头脑风暴系统](#8-头脑风暴系统)
9. [Git Flow 管理](#9-git-flow-管理)
10. [多会话状态管理](#10-多会话状态管理)
11. [Todo 与经验教训系统](#11-todo-与经验教训系统)
12. [子 Agent 策略](#12-子-agent-策略)
13. [文件参考](#13-文件参考)
14. [升级](#14-升级)
15. [故障排查](#15-故障排查)

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
  pr:
    base_branch: "develop"
    draft: false
  merge:
    strategy: "squash"               # squash | merge | rebase
    delete_branch: true
  protected: ["main", "master", "develop"]

workflows:
  new-feature:
    require_spec: true
    require_tests: true
    require_brainstorm: true
    max_plan_phases: 10
    adaptive: true
  hotfix:
    base_branch: ""                  # Empty = use git.branches.main
    require_tests: true
    max_lines: 15
  release:
    changelog: true
    tag_format: "v{version}"
  review:
    checklist: "auto"                # auto | none | <path>
    size_thresholds: { small: 10, medium: 30, large: 50 }
  brainstorm:
    default_depth: "standard"        # quick | standard | deep

state:
  directory: ".workflows"
  history: true

skills:
  aliases:
    build: "new-feature"
    fix: "hotfix"
    ship: "release"

quality:
  self_review: true
  focused_gate: true
  proportional: true

telemetry:
  enabled: false                     # opt-in
  file: ".workflows/telemetry.jsonl"
```

**建议**：从 `project.name`、`project.type` 和 `git.branches` 开始配置。`project.type` 决定了自动加载哪些编码规则和评审清单。

---

## 4. 工作流生命周期

每个工作流都遵循同一个状态机：

```
IDLE -> GATHER -> SPEC -> BRAINSTORM -> PLAN -> BRANCH -> IMPLEMENT -> TEST -> PR -> DONE
                                                             |
                                                        REPLAN -> back to IMPLEMENT
```

| 阶段 | 发生什么 | 产出 |
|-------|-------------|--------|
| **GATHER**（收集） | 收集需求（Jira、Figma、用户、规格文件） | `.workflows/<feature>/01-gather.md` |
| **SPEC**（规格） | 生成正式规格说明 | `.workflows/<feature>/02-spec.md` |
| **BRAINSTORM**（头脑风暴） | 探索方案、评估权衡 | `.workflows/<feature>/03-brainstorm.md` |
| **PLAN**（计划） | 分阶段的实现计划 | `.workflows/<feature>/plan.md` |
| **BRANCH**（分支） | 按 git 配置创建功能分支 | Git 分支 |
| **IMPLEMENT**（实现） | 逐阶段写代码并做构建检查 | 源代码 + 提交 |
| **TEST**（测试） | 编写并运行测试 | 测试文件 + 结果 |
| **PR** | 推送分支、创建拉取请求 | GitHub PR |
| **DONE**（完成） | 归档状态、汇报总结 | 历史记录 |

**编排规则**（`<plugin-root>/skills/_orchestration/RULES.md`）对每次执行都生效：阶段产出文档写入 `.workflows/<feature>/`，每次切换都更新状态，自动检测构建/测试命令，强制执行质量门禁，支持工作流链式调用。

**可跳过的阶段**：在配置中设置 `require_spec/brainstorm/tests: false`，或传入 `--skip-brainstorm`。

**决策点**：SPEC、BRAINSTORM、PLAN 之后，以及 PR 之前。未经你批准，工作流绝不会继续推进（除非传入 `--auto`）。

**REPLAN**：当编译失败 3 次以上、计划有误，或你要求变更时触发。它会停下、记录问题、重新计划，并请求批准。

---

## 5. 质量门禁

有两套机制在所有工作流中强制执行代码标准。二者都**随插件打包**，并根据 `project.type` 动态加载（本插件的语言固定为 Java）。

### 编码规则（`<plugin-root>/rules/`）

实现阶段之前加载的语言专用 DO/DON'T 模式。目前提供：Java 与 Spring Boot。由配置中的 `project.type` 选择 —— `spring-boot` 加载 `java.md` + `spring-boot.md`；`java` 只加载 `java.md`。

### 评审清单（`<plugin-root>/reviews/`）

在创建任何 PR 之前，agent 会对照以下清单自检：
1. `general-checklist.md`（始终加载）
2. Java / Spring Boot 清单（由 `project.type` 自动检测）
3. 团队清单（若已定义）

「严重」与「高」级别的违规必须在创建 PR 之前修复。

```yaml
quality:
  self_review: true
  review_checklists: ["general-checklist.md"]
```

---

## 6. 全部命令

所有命令的命名空间均为 `spring-boot-workflows:`。

| 命令 | 说明 |
|---------|-------------|
| `/spring-boot-workflows:setup` | 初始化项目（目录、配置、.gitignore） |
| `/spring-boot-workflows:new-feature <name>` | 端到端构建一个新功能 |
| `/spring-boot-workflows:extend-feature <name>` | 在既有功能上扩展 |
| `/spring-boot-workflows:refactor <target>` | 安全地重构代码 |
| `/spring-boot-workflows:hotfix <description>` | 生产环境紧急修复 |
| `/spring-boot-workflows:diagnose <symptom>` | 系统化的缺陷排查 |
| `/spring-boot-workflows:test <target>` | 生成测试并统计覆盖率 |
| `/spring-boot-workflows:review <pr-number>` | 评审一个拉取请求 |
| `/spring-boot-workflows:release <version>` | 准备一个带版本号的发布 |
| `/spring-boot-workflows:ci-fix [--run <id>]` | 修复 CI/CD 失败 |
| `/spring-boot-workflows:ci-setup [--platform github\|gitea]` | 生成 GitHub/Gitea Actions CI 工作流 |
| `/spring-boot-workflows:migrate <type>` | 增量迁移 |
| `/spring-boot-workflows:new-project` | 初始化项目脚手架 |
| `/spring-boot-workflows:brainstorm <topic>` | 独立的头脑风暴 |
| `/spring-boot-workflows:scope <description>` | 开始前分析任务复杂度 |
| `/spring-boot-workflows:retrospective` | 分析工作流历史以寻找改进点 |
| `/spring-boot-workflows:start` | 启动新工作流或显示状态 |
| `/spring-boot-workflows:resume` | 恢复已暂停/中断的工作流 |
| `/spring-boot-workflows:git-flow` | Git 分支/提交/PR 操作 |
| `/spring-boot-workflows:compose-skill` | 编排自定义技能 |
| `/spring-boot-workflows:guards` | 安全守卫检查 |
| `/spring-boot-workflows:learn` | 从工作流中捕获模式 |
| `/spring-boot-workflows:metrics` | 工作流度量与遥测 |
| `/spring-boot-workflows:template` | 保存并复用工作流模板 |

---

## 7. 工作流详解

### 新功能（New Feature）

最完整的工作流。把一个功能从想法一路带到合并的 PR。

```
/spring-boot-workflows:new-feature <name> [--from-ticket <url-or-id>] [--from-figma <url>] [--from-spec <path>] [--skip-brainstorm] [--depth full|trivial] [--auto]
```

**GATHER**：从 Jira（MCP）、Figma（MCP）、规格文件或交互式提问中收集信息，多种来源可以组合使用。**SPEC**：生成包含用户故事、验收标准、范围、技术要求、边界情况的规格。**BRAINSTORM**：用结构化技法评估 2-4 种方案，产出决策文档。**PLAN**：在 `.workflows/<feature>/plan.md` 中给出分阶段实现计划，每个阶段包含涉及文件、细节、构建检查与提交信息。同时生成 `tasks/todo.md`。**BRANCH**：按 git 配置创建分支。**IMPLEMENT**：逐阶段实现，伴随构建检查、提交与状态更新。Java/Spring 规则从 `<plugin-root>/rules/` 加载，领域技能由 `spring-context` 路由。反复失败时触发 REPLAN。**TEST**：覆盖所有新增代码，并报告覆盖率。**PR**：先跑质量门禁清单，再用平台 CLI（`gh` 或 `tea`）创建 PR。

`--depth trivial` 跳过 SPEC、BRAINSTORM 与 TEST；`--depth full` 完整执行八个阶段，不做自动跳过。`--auto` 跳过审批门，在每个决策点采用推荐选项。

决策点位于 SPEC、BRAINSTORM、PLAN 之后，以及 PR 之前。

### 扩展功能（Extend Feature）

```
/spring-boot-workflows:extend-feature <feature-name> <extension-description> [--skip-brainstorm]
```

**保守型**工作流：必须保持既有行为不变。优先新增文件而非修改既有文件。使用 SCAMPER 头脑风暴技法。VERIFY-COMPAT 阶段确保所有既有测试仍然通过。若既有测试被破坏，修的是新代码（而不是测试）。

### 重构（Refactor）

```
/spring-boot-workflows:refactor <target> [--scope files|module|feature] [--goal "description"]
```

完整的依赖图分析，改动之前先记录行为契约，采用增量迁移，且**每一步都能独立编译并通过测试**。头脑风暴使用约束映射（Constraint Mapping）与权衡矩阵（Trade-off Matrix），其中影响半径权重最高。

### 紧急修复（Hotfix）

```
/spring-boot-workflows:hotfix <description> [--crashlytics <issue-id>] [--log <path>] [--branch <production-branch>]
```

为**速度**优化。不做头脑风暴、不写规格。改动量绝对最小，从生产分支切出。流程为：诊断 → 修复 → 回归测试 → PR → Cherry-Pick 方案。

### 测试（Test）

```
/spring-boot-workflows:test <target> [--coverage <pct>] [--type unit|integration]
```

目标形式：`class:Name`、`file:path`、`module:name`、`feature:name`。分析公开 API、依赖、分支、边界情况。按项目既有约定编写测试。默认覆盖率目标：90%。

### 评审（Review）

```
/spring-boot-workflows:review <pr-number>
```

通过 `gh` 拉取 PR，按分层对改动分类，检查架构/质量/安全/性能/覆盖率/规范。生成带严重级别的行内评论。由你决定提交哪些。

### 发布（Release）

```
/spring-boot-workflows:release <version>
```

根据上次标签以来的提交生成变更日志，在 `pom.xml` / `build.gradle(.kts)` 中检测并递增版本号，创建发布分支，向生产分支提 PR，并给出打标签的命令。

### CI 修复（CI Fix）

```
/spring-boot-workflows:ci-fix [--run <run-id>] [--pr <pr-number>]
```

通过 `gh` 获取失败详情，分类（编译/测试/lint/依赖/配置/超时），实施针对性修复，推送，并给出监控命令。

### 迁移（Migrate）

```
/spring-boot-workflows:migrate <type>
```

类型：`dependency`、`api-version`、`architecture`、`database`。每一步都能独立编译且测试通过。针对不同类型提供专门指导：版本对比、端点映射、模式迁移、schema 迁移。

### 新项目（New Project）

```
/spring-boot-workflows:new-project [--path <directory>] [--preset <spring-boot|java>]
```

检测构建系统、Spring Boot 版本、持久化技术栈、CI 系统与 git 约定。生成 `.workflows/config.yml`、`CLAUDE.md`、`tasks/todo.md`、`tasks/lessons.md` 以及目录结构。对新项目而言，它取代 `/setup`。

---

## 8. 头脑风暴系统

既可独立运行（`/spring-boot-workflows:brainstorm <topic>`），也可作为任意工作流的一部分运行。

### 5 种技法

| 技法 | 方法 |
|-----------|--------|
| **权衡矩阵（Trade-off Matrix）** | 按加权维度（复杂度、可维护性、性能、可测试性、时间）为选项打分 |
| **六顶思考帽（Six Thinking Hats）** | 6 个视角：事实、感受、风险、收益、创造力、流程 |
| **SCAMPER** | 替代、组合、调整、修改、他用、消除、重排 |
| **逆向头脑风暴（Reverse Brainstorm）** | 「这怎么会失败？」—— 把失败反转为缓解措施 |
| **约束映射（Constraint Mapping）** | 分析之前先按硬性/软性约束做过滤 |

### 深度级别

| 深度 | 方案数 | 技法 | 适用场景 |
|-------|---------|-----------|------|
| `quick` | 2 | 仅权衡矩阵 | 简单决策 |
| `standard` | 3 | 1 种技法 + 权衡矩阵 | 大多数功能 |
| `deep` | 4+ | 多种技法 + 权衡矩阵 | 架构决策、高风险改动 |

**默认行为**：技法选择取决于深度级别 —— 独立的头脑风暴按深度配置选择技法。extend-feature 明确使用 SCAMPER，refactor 使用约束映射。所有级别都包含权衡矩阵用于最终评估。

---

## 9. Git Flow 管理

由 `/spring-boot-workflows:git-flow` 技能处理，配置读取自 `.workflows/config.yml`。

- **分支**：基于模式（`feature/{name}`、`release/v{version}`）
- **提交**：Conventional、Angular 或 Simple 格式
- **PR**：模板中支持 `{summary}`、`{changes}`、`{test_plan}`、`{ticket}` 变量
- **受保护分支**：直接提交时发出警告，并建议改用功能分支
- **Hotfix cherry-pick**：给出把修复回移到开发分支的命令

---

## 10. 多会话状态管理

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

## 11. Todo 与经验教训系统

**`tasks/todo.md`**：由计划生成的操作清单，在实现过程中持续更新。

**`tasks/lessons.md`**：由 `/new-project` 创建。记录失误 —— 出了什么问题、正确做法是什么、如何预防 —— 供你和 Claude 在类似工作开始前查阅。

| 文件 | 内容 | 更新时机 |
|------|------|---------|
| `tasks/todo.md` | 日常操作清单 | 每一步之后 |
| `.workflows/<feature>/plan*.md` | 架构计划 | 计划阶段与 REPLAN |
| `.workflows/current-state.md` | 会话元数据 | 阶段边界 |

---

## 12. 子 Agent 策略

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

---

## 13. 文件参考

### 随插件打包

这些文件随插件一同分发并自动加载。它们**不会**被复制到你的项目中。

| 路径（相对于插件根目录） | 用途 |
|-------------------------------|---------|
| `skills/*/SKILL.md` | 24 个工作流技能（自动发现） |
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
| `tasks/todo.md` | 是 | `/new-project` 或 PLAN 阶段 |
| `tasks/lessons.md` | 是 | `/new-project` |

---

## 14. 升级

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

## 15. 故障排查

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

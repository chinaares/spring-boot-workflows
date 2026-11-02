# new-project 技能：功能与工作机制

> 参考文档 · 分析对象 `skills/new-project/SKILL.md`（插件 v1.0.0）
>
> 面向两类读者：需要修改这个技能的维护者，以及想理解插件编排机制的开发者。

---

## 1. 定位

`new-project` 是插件的**项目初始化入口**。它把「探测 → 配置 → 生成 → 收尾」四件事串成一次调用，让一个项目在第一次会话结束时就进入「工作流可用」状态——不需要用户手动跑 `/setup` 再跑 `/ci-setup`。

它**取代** `/setup`（详见 [§6](#6-与-setup-的关系)）。

### 命令

```text
/spring-boot-workflows:new-project [--path <directory>] [--preset <spring-boot|java>]
```

### 职责边界

| 做 | 不做 |
|---|---|
| 探测技术栈、git 约定、架构模式 | 不写业务代码 |
| 生成 `config.yml`、`CLAUDE.md`、`tasks/` | 不修改已有代码 |
| 同步 `.gitignore`、安装护栏、检查 v2.x 残留 | 不创建分支、不提交 |
| 可选生成 CI 工作流 | 不执行构建 |

### 入口方式

除直接调用外，还可以通过 `/spring-boot-workflows:start` 的菜单进入（菜单第 3 项「New Project」）。`start` 会收集参数后直接分发到本技能。

---

## 2. 四阶段工作流

```text
DETECT ──▶ CONFIGURE ──▶ GENERATE ──▶ SETUP
```

| 阶段 | 子步骤 | 依赖关系 | 产出文件 |
|---|---|---|---|
| **Step 0** | 状态初始化 | — | `.workflows/<name>/`、`.workflows/current-state.md` |
| **1 DETECT** | 1.1 标记扫描<br>1.2 构建细节<br>1.3 git 约定<br>1.4 架构识别<br>1.5 预设兜底 | 1.2 ← 1.1<br>1.5 ← 全部 | `01-detect.md` |
| **2 CONFIGURE** | 2.1 呈现并确认<br>2.2 生成配置<br>2.3 校验配置 | 2.2 ← 1.x<br>2.3 ← 2.2 | `02-configure.md` |
| **3 GENERATE** | 3.1 生成 CLAUDE.md<br>3.2 回读校验<br>3.3 委托 CI | 3.3 可选 | `03-generate.md` |
| **4 SETUP** | 4.1 脚手架<br>4.2 同步 `.gitignore`<br>4.3 安装护栏<br>4.4 迁移检查<br>4.5 摘要 + Rule 15 | 4.x ← 2.x | `04-setup.md` |

### 2.1 Phase 1 — DETECT

**1.1 标记扫描**：用 `Glob` 逐个匹配标记文件，限定在 `<root>/` 范围内。明确要求「记录所有匹配」——项目可能是 polyglot 的。`package.json` 被标为次要语言，只记录不配置。

| 标记文件 | 推断的技术栈 |
|---|---|
| `pom.xml` 含 `spring-boot-starter-parent` | Spring Boot (Maven) |
| `pom.xml` | Java (Maven) |
| `build.gradle.kts` / `build.gradle` 含 `org.springframework.boot` 插件 | Spring Boot (Gradle) |
| `build.gradle.kts` / `build.gradle` | Java (Gradle) |
| `settings.gradle.kts` / `settings.gradle` | 多模块 Gradle |
| `mvnw` / `gradlew` | 有 wrapper —— **优先用 wrapper，不用系统工具** |
| `flyway-database-*`、`db/migration/` | Flyway 管理 schema |
| `liquibase.properties`、`db/changelog/` | Liquibase 管理 schema |
| `package.json` | Node.js / JS / TS（非主语言，仅记录） |

**1.2 构建细节**：从标记文件提取 build/test/lint 命令、构建变体（如 Android `productFlavors`）、包管理器（按 lock 文件判断）。

**1.3 git 约定**：`git log --oneline -20` 提取提交格式，`git branch -a` 提取主/开发分支命名，检查 CI 配置文件推断 CI 系统。

**1.4 架构识别**：架构模式（MVVM、Clean 等）、DI 框架、关键目录、模块结构。**降级规则**：探测到的属性少于 3 个就转人工询问；未传 `--preset` 时主动提供预设选项。

**1.5 预设兜底**：把 `--preset` 的值填进探测没能解析的键。**探测值永远优先**——预设只填空缺，绝不覆盖成功的探测（详见 [§5.2](#52---preset-spring-bootjava)）。

### 2.2 Phase 2 — CONFIGURE

**2.1 呈现并确认** —— 全流程**唯一的人工确认门**，位于生成之前。展示探测摘要 + 将要套用的用户插件设置 + 与探测值冲突的项。

**2.2 生成配置** —— 把 `<plugin-root>/config/defaults.yml` **全量复制**到 `.workflows/config.yml`，再覆写探测值。

> 这里有一条被测试固化的反模式约束：**不得手工挑键**。`defaults.yml` 的每一个顶层键 —— `version` 加全部 12 个 section（`project` / `git` / `ci` / `workflows` / `state` / `skills` / `chains` / `guards` / `learning` / `quality` / `progress` / `telemetry`）—— 都必须存活。历史教训是 `ci` section 曾被手写的配置生成漏掉，导致项目级 CI 设置被静默丢弃。

覆写的键：

| 键 | 来源 |
|---|---|
| `project.name` | 项目名 |
| `project.type` | 探测到的技术栈（`spring-boot` / `java` / `generic`） |
| `project.language` | 探测到的语言 |
| `project.spring.boot_major` | 探测到的主版本（3 或 4） |
| `project.spring.build_tool` | 探测到的构建工具（`maven` / `gradle`） |
| `project.spring.persistence` | 探测到的持久化（有 `spring-boot-starter-data-jpa` 则 `jpa`，否则 `jdbc`） |
| `git.branches.main` | 探测到的主分支（兜底 `main`） |
| `git.branches.development` | 探测到的开发分支（兜底 `develop`） |
| `git.commits.format` | 探测到的提交格式 |
| `git.pr.base_branch` | 探测到的 PR 目标分支（兜底 `develop`） |
| `ci.platform` | 探测到的平台（`github` / `gitea` / `both`）；remote 不明时用 `auto` |
| `ci.runner` | 探测或确认的 runner 标签 |

随后叠加**用户插件设置层**（5 个键，见 [§5.3](#53-配置优先级链)），最后保留 `defaults.yml` 的其余全部值——**包括 `ci.features` 和 `ci.java_versions`**，防止配置在多轮会话中逐次退化。

**2.3 校验配置** —— 对生成的 `config.yml` 做 8 项检查：6 个必需顶层键是否齐全，6 个枚举型字段的取值是否合法（`project.type`、`git.commits.format`、`git.merge.strategy`、`project.spring.boot_major`、`ci.platform`、`ci.mirror`、`ci.features`）。校验失败只告警并提供修复选项，**不阻塞工作流**。

### 2.3 Phase 3 — GENERATE

**3.1 生成 CLAUDE.md** —— 四段式结构：**Build & Run**（命令）/ **Architecture**（模式、DI、模块、关键目录）/ **Code Conventions**（提交、分支、PR 目标）/ **Important Notes**（项目坑点）。约束「每个命令一行、关键目录 5–10 个」，避免生成冗长文档。

**3.2 回读校验** —— 读回文件验证命令可用、路径真实、无残留占位符。若 `CLAUDE.md` 已存在，给出三选一：**overwrite** / **merge**（保留自定义、更新探测值）/ **skip**。

**3.3 委托 CI** —— 若 `.github/workflows/` 与 `.gitea/workflows/` 都没有工作流，询问是否生成；确认后按 Rule 9 内联执行 `ci-setup` 技能，复用 Phase 1 已探测的参数。

### 2.4 Phase 4 — SETUP

**4.1 脚手架** —— `mkdir -p tasks .workflows/specs .workflows/history .workflows/learned`，并生成 `tasks/todo.md`（`# Todo` / `## In Progress` / `## Backlog`）与 `tasks/lessons.md`（`# Lessons Learned`）。

> **显式禁止把 `tasks/` 加进 `.gitignore`** —— 任务文件应当被版本追踪。
>
> `specs/` / `history/` / `learned/` 三个目录必须在此创建：`/new-feature` 要往 `specs/` 写规格，Rule 5 要往 `history/` 归档状态文件，`/learn` 要往 `learned/` 写知识。缺了它们，后续技能会静默写不进去。

**4.2 同步 `.gitignore`** —— 写入与 `/setup` 相同的 7 条忽略规则。幂等（先查 marker 注释再追加）、绝不加入 `tasks/`、不改动已有条目。

**4.3 安装护栏（可选）** —— `guards.yml` 不存在时询问；确认后读 `<plugin-root>/templates/guards.yml.tmpl` 写入并打印摘要。`/guards init` 可单独完成同样的事。

**4.4 迁移检查** —— 检查 v2.x 残留：`.claude/workflows.yml` 存在则合并旧配置到新的 `config.yml`；`.claude/.workflows-version` 存在则提示可清理的旧 CLI 目录。

**4.5 最终摘要** —— 打印创建的文件、`.workflows/` 子目录、`.gitignore` 是否更新、护栏与迁移的处理结果。然后应用 Rule 15：查 `config.yml` 的 `chains`，有链则询问是否执行，无链则建议 `/new-feature` 作为默认下一步。

---

## 3. 产物清单

| 路径 | 内容 | 纳入 Git | 创建者 |
|---|---|:-:|---|
| `CLAUDE.md` | 项目上下文：构建命令、架构、约定、坑点 | ✅ | Phase 3.1 |
| `.workflows/config.yml` | 工作流配置（`defaults.yml` 的每个顶层键都保留） | ✅ | Phase 2.2 |
| `tasks/todo.md` | 任务清单 | ✅ | Phase 4.1 |
| `tasks/lessons.md` | 经验教训 | ✅ | Phase 4.1 |
| `.workflows/guards.yml` | 安全护栏配置 | ✅ | Phase 4.3（可选） |
| `.workflows/specs/` `history/` `learned/` | 状态目录 | ❌ | Phase 4.1 |
| `.workflows/<name>/01-detect.md` … `04-setup.md` | 各阶段产出 | ❌ | 每阶段 |
| `.workflows/current-state.md` | 工作流状态机 | ❌ | 阶段切换 |
| `.github/workflows/*.yml` / `.gitea/workflows/*.yml` | CI 工作流 | ✅ | Phase 3.3（可选） |

---

## 4. 工作机制

这个技能本身**不含任何可执行代码**——它是一份给模型执行的程序化指令。它的可靠性来自四层基础设施。

### 4.1 协议注入（SessionStart）

[hooks.json](../../hooks/hooks.json) 注册的 `SessionStart` 钩子做两件事：

1. `cat PROTOCOL.md` —— 把执行协议全文注入会话。协议定义了状态初始化模板、阶段产出双动作、阶段跳过规则、路径解析优先级。
2. 执行 `scripts/session-start-state.sh` —— 用 `awk` 解析 `current-state.md` 的 frontmatter，输出活动/暂停工作流提示。

> 该脚本注释里记了一个硬约束：**SessionStart 必须是 command 类型钩子**。Claude Code 拒绝 prompt 类型（此时没有对话上下文可用）。

关键点：协议不是靠模型「记得」，而是**每次会话强制注入**。

### 4.2 规则装配

技能的 frontmatter 声明 `rules: [0, 1, 5, 6, 10, 12, 15, 17]`，决定加载 `skills/_orchestration/rules/` 下的哪些规则文件：

| 规则 | 作用 |
|---|---|
| 0 | 状态初始化（kebab-case 目录名、frontmatter 模板） |
| 1 | 阶段产出协议 + 前置条件 + 状态更新 |
| 5 | 工作流完成（diff 报告、归档到 `history/`、链式检查、知识提取） |
| 6 | 暂停（重命名为 `paused-<feature>.md`） |
| 10 | 阶段状态机取值（ACTIVE/COMPLETED/SKIPPED/FAILED/RETRY） |
| 12 | 遥测（可选，写 `telemetry.jsonl`） |
| 15 | 链式衔接（检查 `chains`，询问是否执行下一个工作流） |

规则 8（常见错误）与 14（dry-run）**始终生效**，无需声明。

**装配语义**：`rules:` 只决定加载哪些规则文件；具体的流程行为由技能正文定义。Rule 5 的注释写明「技能不需要重复这些步骤——该规则统一处理所有完成逻辑」，所以 Phase 4.5 只写摘要，归档与 diff 报告由 Rule 5 接管。

> Rule 9（技能组合）被 Phase 3.3 引用但**未列入 `rules:`**。这是安全的——Phase 3.3 已把 Rule 9 的四项契约（内联执行、输出路由、不建独立状态文件、完成后回到父流程）逐条内联写明，不依赖规则文件加载。

### 4.3 状态机

`.workflows/current-state.md` 是唯一的真相源。frontmatter 记录 `workflow` / `feature` / `phase` / `phases` / `started` / `updated` / `branch` / `output_dir` / `replan_count`，正文含 `## Phase History` 表、`## Context` 段、`## Constraints` 段、`## Progress`（Mermaid 状态图）。

协议要求每阶段结束前完成**双动作**，两个文件都写完才能进入下一阶段：

1. 写阶段输出文件
2. 重写状态文件（推进 phase、标记 COMPLETED、补 ACTIVE 行、追加 Context 决策）

`## Context` 段被明确标注为「**上下文压缩后仍存续的首要依据**」，上限约 20 条——这是跨会话恢复的关键设计。

Rule 17 额外生成 Mermaid `stateDiagram-v2`，但**面向用户显示的是压缩文本**（终端不渲染 Mermaid）：

```text
Progress: ✓DETECT ▶CONFIGURE ·GENERATE ·SETUP
```

### 4.4 钩子强制同步

这是机制里最关键的一环。`PostToolUse` 钩子匹配 `Write(.workflows/*)` 与 `Edit(.workflows/*)`：

> 你刚写入了 `.workflows/` 下的文件。如果这是阶段输出文件（而非 `current-state.md` 本身），**必须先更新状态文件**才能做其他事……未完成前不得进入下一阶段。

**作用**：把「写完阶段输出记得更新状态」这个易遗忘的约定，从提示词层下沉到**工具调用层**——模型每写一个 `.workflows/0X-*.md`，钩子就即时提醒一次。

配套还有 `PreToolUse` 对 `Bash(gh pr create*)` 的质量门检查（检测 PR 前是否跑过 review/checklist）。那是 **prompt 类型**钩子（可访问对话上下文），与 SessionStart 的 command 类型形成分工。

### 4.5 Rule 9 内联委托

Phase 3.3 委托 `ci-setup` 时应用 Rule 9。四项契约：

1. **内联执行** —— 不启动独立技能，读目标 SKILL.md 当作当前阶段的子步骤
2. **输出路由** —— 写入本工作流的 `.workflows/<name>/`，CI 阶段报告落在 `03-generate.md`
3. **不建独立状态文件** —— **跳过 `ci-setup` 自己的 Step 0**
4. **完成后回到父流程** —— 继续 Phase 4

> 第 3 条是关键。`ci-setup` 的 Step 0 会创建 `.workflows/ci-setup/` 并覆写 `current-state.md`——若不显式跳过，被内联技能会**摧毁父工作流的状态机**。这个约束已写成测试断言。

### 4.6 配置优先级链

每个配置键按固定顺序解析：

```text
探测值 → --preset 值 → 用户插件设置 → defaults.yml
```

| 层 | 性质 | 说明 |
|---|---|---|
| 探测值 | 逐项目事实 | Phase 1 的实际探测结果 |
| `--preset` | 单次调用的显式选择 | 只在探测不到时启用 |
| 用户插件设置 | 全局默认 | `claude plugin configure spring-boot-workflows` 设的 5 个值 |
| `defaults.yml` | 插件内置默认 | 插件根目录的模板 |

**用户插件设置是兜底，不是覆盖。** RULES.md 的原文是「serve as fallback」——全局默认不该压过逐项目的事实。`project.team` 没有可探测的对应项，因此始终生效。

`setup` 技能被对齐到同一条链，并补上了 git 约定探测——否则「探测优先」对它是空的。两个技能的优先级链、校验清单、迁移与护栏检查都有一致性断言，防止日后漂移。

### 4.7 路径作用域与目录命名

**`<root>`** = `--path` 解析后的路径（省略则当前工作目录）。所有读写都限定在它下面：

| 操作 | 方式 |
|---|---|
| 文件搜索（`Glob`） | 模式加 `<root>/` 前缀 —— `<root>/pom.xml`、多模块再扫 `<root>/**/pom.xml` |
| 文件读写 | 路径加 `<root>/` 前缀 |
| git 命令 | `git -C <root> ...` —— **不 `cd`** |

用 `git -C` 而非 `cd` 是刻意的：`cd` 会改变 shell 上下文，而 `git -C` 只影响单条命令。

**目录名**按 Rule 0 规范：kebab-case、最长 40 字符、仅 ASCII、全小写（`Task Demo` → `task-demo`，`订单服务` → `order-service`）。目录名会进入文件系统路径，所以不能用原始项目名。

---

## 5. 命令参数

### 5.1 `--path <directory>`

指定目标目录。相对路径按当前工作目录解析。目录不存在时**先问用户**是否创建，再继续。

### 5.2 `--preset <spring-boot|java>`

探测失败时的兜底。

| 键 | `--preset spring-boot` | `--preset java` |
|---|---|---|
| `project.type` | `spring-boot` | `java` |
| `project.language` | `java` | `java` |
| `project.spring.boot_major` | **问用户**：Boot 3 还是 4 —— 永不猜测 | 不适用，保留 `defaults.yml` 的值 |
| `project.spring.build_tool` | 探测，否则 `maven` | 探测，否则 `maven` |
| `project.spring.persistence` | 探测，否则 `jpa` | 探测，否则 `jdbc` |

两条硬规则：

- **预设不设置任何 git / CI 值** —— 那些总是可探测的。
- **`boot_major` 永不猜测**。沿用 Rule 4 的理由：Boot 3 与 Boot 4 的包路径（`com.fasterxml.jackson` vs `tools.jackson`）和测试 API（`@MockBean` vs `@MockitoBean`）不同，载入错误的知识集会产出对着错误 API 编译的代码。

预设与探测值冲突时（如 `--preset java` 但 `pom.xml` 声明了 `spring-boot-starter-parent`），**报出冲突并询问**，不静默取其一。

### 5.3 配置优先级链

见 [§4.6](#46-配置优先级链)。

---

## 6. 与 `setup` 的关系

`setup` 曾是唯一的初始化技能。`new-project` 现在是它的**严格超集**——覆盖它全部能力，且探测更多：

| 能力 | `setup` | `new-project` |
|---|---|---|
| 探测技术栈 / Boot 主版本 / 持久化 | ✅ | ✅ |
| 探测 git 约定（提交格式、分支、CI 平台） | ✅（本次对齐后） | ✅ |
| 探测架构模式 | ❌ | ✅ |
| `.workflows/specs` `history` `learned` | ✅ | ✅ |
| `config.yml` 全量复制 defaults.yml | ✅ | ✅ |
| 套用用户插件设置层 | ✅ | ✅ |
| 校验 config.yml（8 项） | ✅ | ✅ |
| `.gitignore` 同步 | ✅ | ✅ |
| 安装 `guards.yml` | ✅ | ✅ |
| v2.x 迁移检查 | ✅ | ✅ |
| 生成 `CLAUDE.md` | ❌ | ✅ |
| 生成 `tasks/todo.md` `tasks/lessons.md` | ❌ | ✅ |
| 委托生成 CI | ❌ | ✅ |

**两者不可先后连跑。** 两者都会全量重写 `config.yml`，谁后跑谁赢，而 `setup` 的版本更弱——它不写 `git.pr.base_branch`（`hotfix` 与 `git-flow` 靠它确定 PR 目标分支，会退回 `develop`）、`project.name`、`ci.runner`。

**分工**：`new-project` 用于新项目；`setup` 用于把**已有项目**接进工作流体系。

---

## 7. 错误处理

| 情况 | 处理 |
|---|---|
| `--path` 目录不存在 | 询问是否创建，然后继续 |
| `--path` 目录不可读 | 报告并建议修复路径 |
| 不是 git 仓库 | 提议在 `<root>` 下执行 `git init` |
| 没探测到构建文件 | 回退到 `--preset`；没传则提供 `spring-boot` / `java` 选项 |
| 预设与探测值冲突 | 报出冲突并询问用哪个 |
| `boot_major` 无法确定 | 问用户 —— 永不猜测（Rule 4） |
| 权限不足 | 报告并建议修复 |
| `.gitignore` 不可写 | 报告并打印需手动添加的条目；**不失败工作流** |
| `tasks/` 已被项目跟踪 | 保持原样，不移除该条目 |

---

## 8. 测试保障

`tests/validate-workflows.js`（484 项断言，本技能相关 4 个 section 共 +41 项）：

| Section | 覆盖内容 |
|---|---|
| `validateProjectInitParity` | 两个技能的 `config.yml` 与 `.gitignore` 产物一致；`.workflows/` 子目录齐备；`tasks/` 不进 `.gitignore`；目录名 kebab-case 且 ≤40 字符 |
| `validateSkillComposition` | Rule 9 委托契约：输出路由、禁止覆写 `current-state.md`、跳过被委托技能的 Step 0 |
| `validateNewProjectCli` | `--path` / `--preset` / Rule 15 的 CLI 契约；目标根的作用域；预设不覆盖探测值；`boot_major` 不猜测 |
| `validateInitFeatureParity` | 两个技能跑**同一份** config 校验清单；**同一条**优先级链；都检查 v2.x 残留；都从模板装护栏 |

这些断言的价值在于**防止两份副本漂移**——`setup` 与 `new-project` 各自维护了一份 `.gitignore` 块和一份校验清单，没有断言的话迟早不同步。

---

## 9. 设计取舍与已知边界

**已知的取舍**

- **配置校验失败不阻塞工作流** —— 只告警并提供修复选项。理由：初始化不该因为一个枚举值写错就整个失败。
- **preset 只覆盖栈相关键** —— git 与 CI 的值总是探测的，预设不该介入。
- **护栏安装需要显式确认** —— 静默往项目里写安全配置文件是侵入性的。
- **Phase 2.1 是唯一确认门** —— 但 1.4（探测不足）、3.2（`CLAUDE.md` 已存在）、3.3（是否生成 CI）、4.3（是否装护栏）也是交互点。确认门放在生成之前是对的——错误配置写进 `config.yml` 后再改代价更大。

**边界**

- `--path` 只影响本技能的读写，不改变模型其他行为的根目录。
- 迁移检查只覆盖 setup 已知的两个 v2.x 标记文件，不做更广的旧版扫描。
- `boot_major` 只能由用户确认——没有可靠的自动推断方式，这是刻意的保守。

---

## 相关文件

| 文件 | 作用 |
|---|---|
| `skills/new-project/SKILL.md` | 被分析的技能本体 |
| `skills/setup/SKILL.md` | 已被取代的初始化技能 |
| `PROTOCOL.md` / `PROTOCOL.zh-CN.md` | 会话开始时注入的执行协议 |
| `skills/_orchestration/rules/` | 规则文件（rule-00 … rule-17） |
| `skills/_orchestration/RULES.md` | 规则索引与优先级定义 |
| `hooks.json` | SessionStart / PreToolUse / PostToolUse 钩子 |
| `config/defaults.yml` | 配置模板（被全量复制） |
| `tests/validate-workflows.js` | 结构性断言 |

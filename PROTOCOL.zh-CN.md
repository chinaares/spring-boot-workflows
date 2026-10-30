# 工作流执行协议

> 本协议在会话开始时自动注入。对**每一个** `/spring-boot-workflows:*` 工作流技能都必须遵守。

## 状态初始化 —— 在第 1 阶段之前

1. 将功能/任务名称转换为 **kebab-case**（最长 40 字符，仅 ASCII，全小写）
2. `mkdir -p .workflows/<name>`
3. 写入 `.workflows/current-state.md`：

```yaml
---
workflow: <skill-name>
feature: <name>
phase: <first-phase>
phases: [<PHASE-1>, <PHASE-2>, ..., <PHASE-N>]
started: <ISO-8601>
updated: <ISO-8601>
branch:
output_dir: .workflows/<name>/
replan_count: 0
---
```

然后添加以下小节：

```markdown
## Phase History
| Phase | Status | Output | Notes |
|-------|--------|--------|-------|
| <first-phase> | ACTIVE | | Starting workflow |

## Context
_Key decisions and resume context:_

## Constraints
_Hard and soft requirements:_
```

4. 在进入第 1 阶段之前，**确认**该文件确实存在。

## 阶段产出 —— 在**每一个**阶段之后

在进入下一阶段之前，必须**同时**完成以下两件事：

1. **写出输出文件**，路径见各阶段中的 `>> Write output to` 一行：
   ```
   # <Phase> — <Feature>
   ## Summary
   <1-3 sentences>
   ## Details
   <phase-specific content>
   ## Next Phase Input
   <what the next phase needs>
   ```

2. **更新状态文件** `.workflows/current-state.md`：
   - 将 `phase` 设为下一阶段，`updated` 设为当前时间
   - 在 Phase History 中将已完成的阶段标记为 `COMPLETED`，并写明输出文件名
   - 为下一阶段新增一行 `ACTIVE`
   - 将关键决策追加到 `## Context`（最多约 20 条 —— 这是恢复会话的首要依据）
   - 若出现了新的硬性/软性要求，更新 `## Constraints`

**在这两个文件都写出之前，不得进入下一阶段。**

## 进度显示

每次阶段切换后，打印：

```
Progress: ✓GATHER ✓SPEC ▶BRAINSTORM ·PLAN ·IMPLEMENT ·TEST ·PR
```

图例：✓=已完成，▶=进行中，○=已跳过，·=待处理

## 阶段跳过规则

读取 `.workflows/config.yml`（若不存在则回退到 `<plugin-root>/config/defaults.yml`）：
- `require_brainstorm: false` 或 `--skip-brainstorm` 参数 → 跳过 BRAINSTORM 阶段
- `require_tests: false` → 跳过 TEST 阶段
- `require_spec: false` → 跳过 SPEC 阶段

跳过时：在状态中标记 `SKIPPED`，不写输出文件，直接进入下一阶段。

**除非技能针对该阶段明确写了「Skip if」，否则绝不允许跳过任何阶段。**

## 强制规则

- **绝不直接跳到实现** —— 按声明的顺序执行各阶段
- **绝不在实现之后就停下** —— IMPLEMENT/FIX/EXECUTE 并不是最后一个阶段。写完代码后，必须继续执行剩余阶段（TEST、VERIFY、PR 等）。只有所有阶段全部完成，工作流才算结束。
- **绝不提前推进**，直到输出文件和状态更新都已写出
- **绝不跳过阶段**，除非配置/参数明确允许
- 若在单个阶段内构建失败 3 次以上：停止，记录失败情况，请用户批准调整后的计划
- 若用户说「pause」：写出部分输出，更新状态，并重命名为 `.workflows/paused-<name>.md`

## 配置与路径解析

- **项目配置**：项目根目录下的 `.workflows/config.yml`
- **插件默认值**：`<plugin-root>/config/defaults.yml`
- **优先级**：CLI 参数 > 项目配置 > 插件默认值
- **插件根目录**：从任一技能的路径中移除 `/skills/<name>/SKILL.md` 后得到

## 活动工作流检查

若 `.workflows/current-state.md` 已存在，且属于**另一个**工作流/功能：先请用户暂停或放弃它。若它属于**同一个**工作流，则从当前阶段继续执行。

检查 `.workflows/paused-*.md` 中是否有已暂停的工作流，并一并告知用户。

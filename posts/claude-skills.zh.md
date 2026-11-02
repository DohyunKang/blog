Claude Code 提供了多种配置手段，阅读官方文档后，将其归纳为“始终告知”、“按需调用”、“强制执行”和“连接外部”，基本就理清了。

## 先通过表格查看

| 项目 | 何时使用 | 文件位置 |
|---|---|---|
| CLAUDE.md | 每次会话启动时加载的指南（构建命令、规则） | `./CLAUDE.md` 或 `./.claude/CLAUDE.md`(项目), `~/.claude/CLAUDE.md`(个人全局), `./CLAUDE.local.md`(个人及本项目) |
| 技能 (Skill) | 仅在需要特定工作流程时调用 | `~/.claude/skills/<名称>/SKILL.md`(个人), `.claude/skills/<名称>/SKILL.md`(项目) |
| 斜杠命令 | 直接通过 `/名称` 调用。自定义命令已合并到技能中 | 内置无文件。自定义为 `.claude/commands/<名称>.md` 或技能 |
| 钩子 (hooks) | 类似“始终必须”执行，如编辑后格式化、阻止危险操作 | `~/.claude/settings.json`, `.claude/settings.json` 中的 `hooks` |
| 子代理 | 针对日志、搜索等输出量大的任务单独运行，仅接收摘要 | `.claude/agents/`, `~/.claude/agents/` |
| 权限 (permissions) | 设定允许/确认/拒绝规则及模式 | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` |
| 计划模式 | 仅在修复前进行调查并接收计划 | 非文件。使用 Shift+Tab, `/plan`, `--permission-mode plan` |
| MCP | 连接外部工具，如问题追踪器、数据库等 | `.mcp.json`(项目), `~/.claude.json`(本地/用户) |

以下是根据文档逐一核对表格项后整理的详细内容。所有内容均基于打开 Claude Code 官方文档 (code.claude.com) 后的记录。

## CLAUDE.md：每次加载的指南

文档指出会话总是以新的上下文窗口开始。因此，跨越会话延续知识的机制有两种：我使用的 CLAUDE.md 和 Claude 自动记录的 auto memory。CLAUDE.md 会在每次会话中加载。由于它始终包含在 [上下文](#/post/ai-context) 中，所以越短越好。文档要求将单个文件控制在 200 行以内，过长会消耗更多上下文且导致指南执行不彻底。

输入 `/init` 会根据代码库生成包含构建命令、测试方法和惯例的 CLAUDE.md。如果已存在，不会覆盖而是提出改进建议。其他文件可通过 `@path/to/import` 语法引入，但文档指出这仅用于整理，并不能减少上下文成本。针对特定文件夹的规则可放入 `.claude/rules/` 并指定路径，仅在触碰该文件时加载。

有一个重要限制：文档将 CLAUDE.md 视为“上下文”而非“强制配置”。若要绝对阻止某种行为，建议使用钩子 (hooks)。

## 技能：按需调用的流程

技能是以 `SKILL.md` 文件为核心的文件夹。若 Claude 判断相关则会自动调用，也可直接通过 `/技能名称` 调用。内容仅在需要时加载，因此即使存放大量参考资料，平时成本也很低。这是它与 CLAUDE.md 最大的区别。

结构分为两部分：第一行以 `---` 开头的 YAML Frontmatter，以及下方的 Markdown 指南。

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

Frontmatter 中值得关注的字段如下：

| 字段 | 含义 |
|---|---|
| `name` | 在 `/` 菜单中显示的名称。省略则使用文件夹名称 |
| `description` | 描述做什么及何时使用。Claude 会据此决定是否应用（文档推荐） |
| `when_to_use` | 触发该技能的示例语句或请求，附在 description 之后 |
| `disable-model-invocation` | 若为 `true`，Claude 不会自动调用，仅通过 `/` 手动调用 |
| `user-invocable` | 若为 `false`，则在 `/` 菜单中隐藏，仅由 Claude 调用 |
| `allowed-tools` | 技能运行期间无需批准即可使用的工具 |
| `context: fork` | 在子代理中执行技能 |
| `paths` | 仅当文件位于指定路径时自动加载 |

文件夹中可以放置辅助文件，如 `reference.md`、`examples.md` 和 `scripts/` 等，而不仅仅是 `SKILL.md`。文档建议将 `SKILL.md` 控制在 500 行以内，将详细内容移至其他文件并在 `SKILL.md` 中引用。若文件名发生冲突，优先级顺序为：enterprise > 个人 > 项目。

### 如何撰写 description（说明）

Claude 在每个会话中仅查看所有技能的 description。这一行决定了是否调用该技能。文档给出的技巧有三点：将核心用途放在最前面；同时说明“做什么”和“何时用”，并包含可触发调用的表达；描述需足够具体，以避免在不相关场景下被误调用。示例如下：

> Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.

由于 description 与 when_to_use 合并后的文本在列表中会被截断至 1,536 字符，因此切勿将重要内容置于末尾。

对于具有副作用的操作（如部署或提交），文档建议设置 `disable-model-invocation: true`，以便由用户自行决定执行时机。若某项操作不属于背景知识类行为，则应设置为 `user-invocable: false`。

## 斜杠命令：技能与命令合二为一

基于文档标准，自定义命令已合并到技能中。`.claude/commands/deploy.md` 和 `.claude/skills/deploy/SKILL.md` 均可创建 `/deploy` 命令且行为一致。现有 command 文件保持不变，新建时推荐使用技能形式。若名称冲突，技能优先级更高。内置命令在文档中提及的包括 `/help`、`/compact`、`/skills`、`/add-dir`、`/status`、`/usage` 等，完整列表请参阅命令参考。

## Hook：确保必然触发的机制

Hook 是在 Claude Code 生命周期特定时点执行的 Shell 命令。文档的核心观点是：并非期望 LLM 自行处理，而是“必须始终触发”。在设置文件（`~/.claude/settings.json` 或项目内的 `.claude/settings.json`）的 `hooks` 块中，以事件名称作为键进行配置。可用事件包括 `PreToolUse`（工具执行前，可拦截）、`PostToolUse`（成功后）、`PostToolUseFailure`、`Notification`（等待输入时）和 `SessionStart` 等。例如，可在 `PostToolUse` 中匹配 `Edit|Write`，从而在编辑完成后运行 Prettier。注册后可通过 `/hooks` 命令查看。

退出码遵循特定规则：0 表示无异常；2 表示阻止执行，且 stderr 中的原因会作为反馈传递给 Claude。需要注意的是，在 `PreToolUse` 中返回 0 并不代表批准，常规权限流程仍将继续。此外，即使 Hook 授予了 allow 权限，deny 和 ask 规则依然适用，文档对此有明确说明。

## 子代理：独立运行并仅接收摘要

子代理是拥有独立上下文窗口、系统提示词及工具权限的辅助代理。若任务符合 description 描述，Claude 会将工作移交；主对话中仅返回摘要。正如文档所列举的优势包括：保留上下文、限制工具使用、复用配置、以及使用更经济的模型（如 Haiku）运行。文档也指出子代理与主代理共享相同的用量配额。

在 Markdown 文件中编写 Frontmatter（必需字段为 `name` 和 `description`），正文内容即作为系统提示词。位置分为项目级 `.claude/agents/` 和个人级 `~/.claude/agents/`。默认提供的包括 Explore（只读浏览）、Plan 和 general-purpose。文档建议：对于输出量大、需独立运行且仅关注失败结果的测试类任务，使用子代理；而对于需要交互打磨的任务，则保留在主对话中。从 [Harness](#/post/ai-harness) 的角度来看，这也是节省上下文的一种方法。

## 权限与 Plan 模式

权限规则在 `permissions` 下通过 `allow`、`ask`、`deny` 定义，评估顺序为 deny > ask > allow，首个匹配项决定结果。配置位置包括：`.claude/settings.json`（共享）、`.claude/settings.local.json`（个人）和 `~/.claude/settings.json`（全局）。文档警告称，由于 Bash 规则是依据 Claude 生成的命令字符串进行匹配，因此即使以不同形式调用同一程序也可能绕过限制，故 deny 和 ask 并非绝对的安全边界。

模式共分为六种。

| 模式 | 摘要 |
|---|---|
| `default` | 自动仅读取，其余需确认 |
| `acceptEdits` | 自动批准工作文件夹内的文件编辑 |
| `plan` | 仅调查并提议计划，在批准前不修改源代码 |
| `auto` | 由独立的分类模型在审查时执行 |
| `dontAsk` | 仅执行预先允许的操作，其余拒绝（适用于 CI） |
| `bypassPermissions` | 无检查地全部执行。仅限隔离的容器或 VM 环境 |

进入计划模式可通过按下 Shift+Tab 旋转状态栏直到显示 "plan mode"，或在提示词前添加 `/plan`，或使用 `claude --permission-mode plan` 启动。出现计划后，可批准并切换至其他模式，或继续制定计划；也可通过 Ctrl+G 在编辑器中修改计划。

## MCP：连接外部系统

[MCP](#/post/ai-mcp) 是一个公开标准，用于将 AI 工具与外部工具和数据进行连接。连接后，可直接读取和写入问题追踪器或数据库，而无需手动粘贴内容。命令为 `claude mcp add --transport <类型> <名称> <地址或命令>`，并通过 `claude mcp list`、`claude mcp remove` 以及会话内的 `/mcp` 进行管理。范围（scope）分为三类：

| 范围 | 加载位置 | 团队共享 | 存储位置 |
|---|---|---|---|
| local（默认） | 仅当前项目 | 否 | `~/.claude.json` |
| project | 仅当前项目 | 是 | 项目根目录 `.mcp.json` |
| user | 所有个人项目 | 否 | `~/.claude.json` |

传输方式方面，推荐对远程服务器使用 HTTP，SSE 则被认为已不再常用。本地进程使用 stdio。文档中强调的注意事项是：从外部获取内容的服务器存在提示注入风险，因此仅连接可信的服务器。

## 如何选择

- 若需始终知晓相关信息，请使用 CLAUDE.md（内容应简短）。
- 若偶尔需要特定流程，则使用技能（skill），平时仅上传描述即可。
- 禁止执行的操作应通过钩子（hook）或 deny 规则实现；CLAUDE.md 是请求，而钩子是强制性的。
- 输出较大的独立任务应使用子代理（subagent）。
- 重大变更应从计划模式开始规划。
- 外部系统连接请使用 MCP。

## 常见误解

- 写在 CLAUDE.md 中就必须遵守：文档提供上下文而非强制设置。
- 技能与斜杠命令原本是独立的：现已合并，统一为相同的 `/名称` 格式。
- 钩子返回 exit 0 即表示批准：在 `PreToolUse` 中，0 不代表批准，而是表示无异议。
- 将操作加入 deny 列表即完成安全加固：若文档更改命令形式，仍可能被绕过，需警惕此类风险。

<details>
<summary>详细解析：钩子配置示例（文档流程摘要）</summary>

文档中的第一个示例是在 `~/.claude/settings.json` 中添加 `Notification` 钩子，以便 Claude 等待输入时弹出桌面通知。如果已存在 `hooks` 键，请勿整体替换，而是将事件键作为兄弟节点添加。编辑后的格式化规则为 `PostToolUse` + `Edit|Write` 匹配器；保护文件阻断则由 `PreToolUse` 实现，该脚本检查文件路径，若匹配则向 stderr 输出原因并执行 `exit 2`。文档还提到存在基于提示（prompt）和代理（agent）的钩子需模型进行评估，但尚未亲自验证。

</details>

## 参考链接

- Claude Code 文档，Skills: https://code.claude.com/docs/en/skills
- Claude Code 文档，How Claude remembers your project(CLAUDE.md): https://code.claude.com/docs/en/memory
- Claude Code 文档，Hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code 文档，Subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code 文档，Permissions: https://code.claude.com/docs/en/permissions
- Claude Code 文档，Permission modes: https://code.claude.com/docs/en/permission-modes
- Claude Code 文档，MCP: https://code.claude.com/docs/en/mcp
- Claude Code 文档，Slash commands: https://code.claude.com/docs/en/slash-commands

← [概念图](#/post/ai-map)

相关文章：[节省 Claude 令牌的方法](#/post/claude-tokens) · [MCP](#/post/ai-mcp) · [上下文与上下文工程](#/post/ai-context)
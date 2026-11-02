Claude、OpenAI Codex、Gemini CLI 和 Cursor 的扩展方式名称虽异，但结构相似。它们都包含一个始终被读取的指令文件、仅在需要时调用的技能（Skill），以及用于打包部署的组合包（插件/扩展）。

## 扩展解决了什么问题

模型每次启动都处于空状态。我们项目的构建命令、代码规范、常用操作流程等都需要记录在某个地方供其阅读。编码代理工具通过文件来解决这一问题。但若将所有内容始终加载，[上下文](#/post/ai-context) 会迅速填满。因此，大多数情况将其分为两层：

- **始终读取层**：简短的指令文件（如 CLAUDE.md、AGENTS.md、GEMINI.md、Cursor 规则）
- **按需读取层**：技能。仅保留名称和描述，正文在使用时再加载。原理已在 [技能](#/post/ai-skills) 文章中整理。

此外，还会挂载外部工具的 [MCP](#/post/ai-mcp) 服务器，以及一次性安装多个组件的包。

## 工具对比表

下表内容仅来源于官方文档。

| 工具 | 名称 | 方式 | 文件位置 | 示例 |
|---|---|---|---|---|
| Claude Code | CLAUDE.md | 始终加载的指令 | 项目 `./CLAUDE.md` 或 `./.claude/CLAUDE.md`，个人 `~/.claude/CLAUDE.md`，规则分割位于 `.claude/rules/` | 构建·测试命令、编码规范 |
| Claude Code | 技能 | 仅常驻描述，正文按需加载 | 个人 `~/.claude/skills/<名称>/SKILL.md`，项目 `.claude/skills/<名称>/SKILL.md` | `/deploy`、变更摘要技能 |
| Claude Code | 插件 | 将技能·代理·钩子·MCP 服务器打包安装 | `.claude-plugin/plugin.json`，已安装位于 `~/.claude/plugins/` | 从市场以 `/plugin` 安装 |
| OpenAI Codex | AGENTS.md | 始终加载的指令 | 全局 `~/.codex/AGENTS.md`，项目根目录至当前文件夹下各子文件夹的 `AGENTS.md` | 仓库操作规范 |
| OpenAI Codex | 技能 | 仅常驻描述，选中时加载正文 | `$HOME/.agents/skills`，仓库 `.agents/skills` | `$changelog-writer` |
| Gemini CLI | GEMINI.md | 始终加载的指令 | 全局 `~/.gemini/GEMINI.md`，工作文件夹及其上级文件夹的 `GEMINI.md` | 语气·风格指南 |
| Gemini CLI | 扩展 (extension) | 打包提示词·MCP·命令·技能·钩子·子代理 | `~/.gemini/extensions/<名称>/gemini-extension.json` | `gemini extensions install <仓库 URL>` |
| Cursor | 规则 (Rules) | 按类型附加的指令 | `.cursor/rules/*.mdc`，用户规则在设置界面 | 仅针对特定文件模式生效的规则 |
| Cursor | AGENTS.md | 无前缀的指令 | 项目根目录或子文件夹 | 分文件夹的指令 |
| ChatGPT | GPTs | 将指令·知识文件·功能·应用·动作打包定制的聊天机器人 | 非文件形式，在 ChatGPT 内部创建 | 特定用途的聊天机器人 |

## 各工具的补充说明

### Claude

Claude Code 的扩展层级划分最为细致。指令为 CLAUDE.md，流程为技能，组合包为插件。文档中 CLAUDE.md 仅保留“必须携带的事实”，并指导将多阶段流程或部分代码相关的内容移至技能或路径级规则中。

技能部分通过 `SKILL.md` 的头部内容控制行为。若设置 `disable-model-invocation: true`，则用户只能通过 `/名称` 调用；若设置 `user-invocable: false`，则仅由模型使用。旧的 `.claude/commands/deploy.md` 格式仍有效，但若技能同名，则以技能为准。当名称冲突时，优先级顺序为：企业 > 个人 > 项目。使用技巧详见 [Claude 技能利用](#/post/claude-skills) 和 [热门技能](#/post/claude-popular-skills) 文章。

启用插件后，技能和代理的名称与描述会在每轮上下文中加载。这意味着即使在不使用的会话中也会消耗少量令牌。因此文档会提前说明这一点，官方市场插件在安装前还会显示上下文成本估算。此外，Claude Code 表示可以读取仓库中的 `AGENTS.md` 文件，而非 CLAUDE.md。

### OpenAI Codex

Codex 的 `AGENTS.md` 会在开始时创建一次指令链。它会从全局文件夹（`~/.codex`）读取一个文件，然后向下遍历到项目根目录下的当前文件夹，每个文件夹最多读取一个并拼接。由于靠近当前文件夹的文件排在后面，因此会覆盖前面的指令。如果同一位置存在 `AGENTS.override.md`，则将其用作普通文件的替代。合并后的大小上限为默认的 32KiB。

技能与 Claude 的形式相同。在 `SKILL.md` 中，`name` 和 `description` 是必需的，旁边可以放置 `scripts/`、`references/`、`assets/` 文件夹。调用可以通过 `$技能名` 或 `/skills` 直接进行，或者由 Codex 根据任务描述自动选择。首次上传的技能列表限制在上下文窗口的大约 2%。如果希望禁用此功能，可在 `agents/openai.yaml` 中设置 `allow_implicit_invocation: false`。

### Gemini CLI

`GEMINI.md` 会从全局、工作文件夹及其上级文件夹以及工具访问文件的位置这三个地方读取并拼接。可以通过 `@文件.md` 导入其他文件，如果在 `context.fileName` 中设置为 `["AGENTS.md", "GEMINI.md"]` 等，则会更改要读取的文件名。可以使用 `/memory show` 查看合并后的结果。

扩展包在其中起到分组的作用。在根目录下放置 `gemini-extension.json`，可以包含 `commands/`（TOML 命令）、`skills/`、`agents/`（子代理、预览）、`hooks/hooks.json`、`policies/` 等内容。清单中应填写 `mcpServers`、`contextFileName`、`excludeTools`、`settings`（如 API 密钥等用户值）等信息。安装方式是通过复制副本，因此如果原文件发生变化，需要运行 `gemini extensions update` 进行更新。

文档顶部曾有一条通知，自 2026 年 6 月 18 日起，免费套餐和 Google One 用户将使用 Antigravity CLI 替代 Gemini CLI。在撰写本文时，具体使用哪一方需要另行确认。

### Cursor

Cursor 的规则是 `.cursor/rules` 目录下的 `.mdc` 文件，普通的 `.md` 文件会被忽略。根据开头部分的 `description`、`globs`、`alwaysApply` 分为四种类型。

| 类型 | 适用时机 |
|---|---|
| Always Apply | 所有对话 |
| Apply to Specific Files | 当 glob 匹配的文件出现在上下文中时 |
| Apply Intelligently | 代理根据 description 判断适用时 |
| Apply Manually | 通过 `@规则名` 直接调用时 |

前三种工具将“始终读取的文件”和“需要时读取的技能”分开，而 Cursor 则是将类型统一归纳在一个规则内。团队和企业套餐中，可以在仪表板管理团队规则，管理员可以强制执行。

### ChatGPT

ChatGPT 的 GPTs 与将文件放入文件夹的方式截然不同。它通过屏幕上的指南、上传的知识文件、功能、应用和动作组合成一个定制聊天机器人。OpenAI 的帮助文档指出，不能在同一 GPT 中同时使用应用和动作。

## 共同点

- 尽管指令文件名不同，但 `AGENTS.md` 被用作通用术语。Codex 原生支持，Cursor 提供支持，Claude Code 可以读取，Gemini CLI 可以通过设置文件名来启用读取。
- 技能形式呈现出向 `SKILL.md` 文件夹收敛的趋势。Claude、Codex 和 Gemini CLI 扩展均使用相同的文件名。
- 常驻部分包含名称和描述，正文仅在需要时提供。因此，描述语句决定了调用的准确性。
- 分组单位是插件（Claude）或扩展（Gemini CLI），外部工具连接通过 MCP 实现。

## 常见误解

- 容易认为只需在指令文件中写满所有内容即可，但作为始终读取的层级，文件越长越消耗上下文和令牌。建议将流程提取到技能中，这是文档的建议做法。
- 指令并非强制。Claude 文档也指出 `CLAUDE.md` 是作为上下文处理而非配置，并且必须通过 hook 来阻止某些操作。
- 同名的技能文件夹并不会原封不动地在工具间迁移。位置（`.claude/skills`、`.agents/skills`）和开头字段因工具而异。
- 安装更多插件并非总是好事。即使未使用已启用的插件，其描述也会进入上下文。

<details>
<summary>各工具的 SKILL.md 开头部分比较</summary>

| 项目 | Claude Code | Codex |
|---|---|---|
| 必填字段 | 无（建议填写 description） | name, description |
| 仅调用人类 | `disable-model-invocation: true` | - |
| 禁用模型自动调用 | 同上 | `agents/openai.yaml`中的`allow_implicit_invocation: false` |
| 直接调用 | `/名字` | `$名字` |
| 运行子代理 | `context: fork` | - |

</details>

← 概念图 (#/post/ai-map)

相关文章：[技能](#/post/ai-skills), [MCP](#/post/ai-mcp), [Harness](#/post/ai-harness)

## 参考链接

- Claude Code 技能：https://code.claude.com/docs/en/skills
- Claude Code 插件：https://code.claude.com/docs/en/plugins
- Claude Code 记忆 (CLAUDE.md)：https://code.claude.com/docs/en/memory
- Codex 技能：https://learn.chatgpt.com/docs/build-skills
- Codex AGENTS.md：https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Gemini CLI 扩展：https://geminicli.com/docs/extensions/
- Gemini CLI 扩展参考：https://geminicli.com/docs/extensions/reference/
- Gemini CLI GEMINI.md：https://geminicli.com/docs/cli/gemini-md/
- Cursor 规则：https://cursor.com/docs/context/rules
- OpenAI GPTs 帮助（仅查看搜索结果摘要）：https://help-lb.openai.com/en/articles/8554407
2026 年秋季，我在浏览即将发布的开发者工具报告时选择了 OpenCode。在当季的列表中，“编码代理（Coding Agent）”板块最为拥挤，而这份报告在该板块中评分颇高。以下仅记录我查阅了官方文档和 README 后的确认内容。

## 这是一个什么样的仓库

GitHub 仓库地址为 `anomalyco/opencode`，描述为 "The open source coding agent."，采用 MIT 许可证。截至检查时间（2026-11-02），Star 数约为 22.39 万，Fork 数约为 3.1 万。由于 Star 数量是动态变化的，此数据以该日期为准。

默认通过终端界面（TUI）使用，文档中也提到了有桌面应用（Beta 版）和 IDE 扩展。桌面应用支持 macOS（Apple Silicon/Intel）、Windows 和 Linux，详见 README。

安装方式除了一行脚本（`curl -fsSL https://opencode.ai/install | bash`）外，文档中还列出了 npm、Bun、pnpm、Yarn、Homebrew、Arch 的 pacman 以及 Windows 下的 Chocolatey·Scoop 等包管理器。对于 Windows，文档建议优先使用 WSL。

文档中有一段值得注意的内容：V1 和 V2 均使用相同的命令 `opencode`，两者可能会发生冲突。Homebrew 的默认公式安装的是 V2 版本。

模型不绑定特定厂商。你可以设置任何 LLM 提供商的 API 密钥来使用，连接路径为 `/connect`。文档首先推荐使用其自行验证过的列表（OpenCode Models）。

## 首次启动时可见的内容

默认有两个代理（Agent），可通过 Tab 键切换。

| 代理 | 功能 |
|---|---|
| build | 默认模式。开启所有工具并修改文件 |
| plan | 仅分析与规划，禁止编辑 |

`plan` 模式拒绝编辑操作，但例外情况是可以在 `.opencode/plans/` 目录下编写 Markdown 计划文件。`bash` 则遵循权限设置。这种模式适用于在修改代码前先看计划的场景。

其下还有子代理（Sub-agent）。`general` 用于复杂的搜索或多步骤任务，并使用除 `todowrite` 之外的所有工具；`explore` 为只读模式。你可以像 `@general` 那样直接用 @ 符号调用，也可以由默认代理自动调用。如果对这个概念感到陌生，可参考 [详细介绍 → 子代理](#/post/ai-subagent)。此外，还有 compaction、title、summary 等系统代理在后台自动运行，无法在 UI 中手动选择。

在项目根目录下执行 `/init` 会扫描代码并在根目录生成 `AGENTS.md` 文件。文档建议将该文件提交至 Git 仓库。这相当于代理每次读取的项目指南。关于此类指令如何进入 [上下文](#/post/ai-context)，另有专门的文章整理。

## 权限设置比想象中更细致

这是我在该仓库中阅读时间最长的部分。权限值共有三种：

- allow：无需批准即可执行
- ask：执行前询问
- deny：禁止执行

可设置权限的对象包括 read、edit、glob、grep、list、bash、task、todowrite、webfetch、websearch、lsp、skill、question、external_directory、doom_loop 等。其中 `edit` 一项涵盖了所有文件修改操作（edit·write·patch）。`task` 用于决定可以调用哪些子代理，若设为 deny，则该子代理将从任务工具列表中完全消失。

默认值大多为 allow，但也有例外。`doom_loop`（指同一工具调用在相同输入下重复三次）和 `external_directory`（指向项目外部路径）的默认为 ask；读取 `.env` 和 `.env.*` 文件也默认为 ask，唯独 `.env.example` 默认为 allow。

`bash` 支持按命令模式进行划分。文档中的示例如下：

```json
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny"
    }
  }
}
```

规则按从上到下的顺序评估，最后匹配的规则生效。因此应将通配符 `*` 放在最前面，具体规则写在后面。按照此配置，`git status` 将通过，`rm -rf build` 将被阻止，而 `npm test` 则会触发询问。

读到这里我不禁想到：代理所使用的 [工具调用](#/post/ai-tool-use) 被一层审批机制包裹，这构成了仓库的核心组件之一。无论模型多么智能，其能做什么最终由配置文件决定。

## 配置文件的存放位置

配置文件已分离为 `opencode.json`（或 `opencode.jsonc`），而 TUI 设置则单独放在 `tui.json` 中。之前位于 `opencode.json` 中的 `theme`、`keybinds`、`tui` 键已被弃用，并迁移至 `tui.json`。

<details>
<summary>配置文件位置与优先级</summary>

文档中提到的位置如下：

- 远程：`.well-known/opencode`（组织默认值）
- 全局：`~/.config/opencode/opencode.json`
- 自定义：环境变量 `OPENCODE_CONFIG` 指向的路径
- 项目：项目根目录下的 `opencode.json`（从当前目录向上查找，直到最近的 Git 目录）
- 内联：环境变量 `OPENCODE_CONFIG_CONTENT`
- 托管：macOS `/Library/Application Support/opencode/`、Linux `/etc/opencode/`、Windows `%ProgramData%\opencode`

优先级遵循后项覆盖前项的原则：远程 → 全局 → 自定义 → 项目 → `.opencode` 目录 → 内联 → 托管文件 → macOS 托管环境设置。由于是合并而非覆盖，不冲突的键会保留所有来源的值。

主要键包括 `model`、`small_model`、`provider`、`permission`、`mcp`、`instructions`、`agent`、`default_agent`、`plugin`、`compaction` 等。模式定义位于 `https://opencode.ai/config.json`。

</details>

像代理、命令、插件等内容应放在 `.opencode/`（项目）或 `~/.config/opencode/`（全局）文件夹中。值得注意的是，组织通过托管设置提供默认值的专用路径。这似乎是一个从个人工具起步但已考虑到企业使用场景的结构设计。

## 创建自定义代理

自定义代理可通过两种方式定义：在 `opencode.json` 的 `agent` 键中以 JSON 格式编写，或将 Markdown 文件放置在 `.opencode/agents/`（项目）或 `~/.config/opencode/agents/`（全局）目录中。若使用 Markdown 文件，文件名即为代理名称，正文则作为提示词。

<details>
<summary>代理选项列表</summary>

- `description`（必需）
- `mode`：可选值为 `primary`、`subagent`、`all`，默认为 `all`
- `model`：格式为 `provider/model-id`
- `temperature`、`top_p`
- `steps`：旧名称 `maxSteps` 已被弃用
- `prompt`：相对于配置文件的相对路径
- `permission`：仅适用于该代理的权限
- `hidden`：在 `@` 菜单中隐藏子代理
- `disable`、`color`
- `tools`：已被 `permission` 替代并弃用

可通过 CLI 命令 `opencode agent create` 交互式创建代理，使用 `opencode agent list` 查看列表。各代理的 `permission` 优先级高于全局权限。

</details>

例如，若要创建一个仅具有读取权限的审查员代理，可将 `mode` 设为 `subagent`，并将 `edit` 权限设为 `deny`。这是在相同的权限体系下对角色进行划分。关于此类代理如何形成循环的原理，将在 [代理循环](#/post/ai-agent-loop) 文章中另行讨论。

## 继续阅读相关文章

在设置的 `mcp` 键中注册 MCP 服务器，并查看 `skill` 是否位于权限键列表中，这表明 [MCP](#/post/ai-mcp) 和 [技能](#/post/ai-skills) 也在同一框架下处理。不过，这两个项目的详细用法在我撰写的文档页面中仅作为侧边栏标题出现，因此不再赘述。直接运行并连接本地模型的部分可参考 [开源分析：Ollama](#/post/repo-ollama)，两者结合便能理清整体图景。所有这些工具的统称是 [Harness](#/post/ai-harness)。

与其关注“星星有 22 万”这样的数字，不如说权限的三个值与最后一条规则的模式匹配对于理解本仓库更为有用。通过单个配置文件将读取、写入和 Shell 操作分开并允许的方式，在观察其他编码代理时也可作为比较基准。

← [概念图](#/post/ai-map)

相关文章：[子代理与多代理](#/post/ai-subagent) · [工具调用 (Function calling)](#/post/ai-tool-use) · [代理与代理循环](#/post/ai-agent-loop)

## 参考链接

- [anomalyco/opencode（GitHub 仓库，2026-11-02 确认）](https://github.com/sst/opencode)
- [OpenCode 文档：介绍·安装](https://opencode.ai/docs/)
- [OpenCode 文档：Agents](https://opencode.ai/docs/agents/)
- [OpenCode 文档：Config](https://opencode.ai/docs/config/)
- [OpenCode 文档：Permissions](https://opencode.ai/docs/permissions/)
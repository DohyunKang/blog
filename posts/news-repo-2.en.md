Looking for a developer tool report launching in the fall of 2026, I chose OpenCode. Coding agents occupied the most crowded slot in this season's list, and among them, this repo had many stars. Below are only the details confirmed by checking the official documentation and README.

## What kind of repo is it?

The GitHub repository is `anomalyco/opencode`, with the description "The open source coding agent." The license is MIT. At the time of verification (2026-11-02), it showed approximately 223,900 stars and about 31,000 forks. The star count is a continuously changing value, so this is based on that date.

The default interface is a terminal screen (TUI), but the documentation also mentions a desktop app (beta) and IDE extensions. The README lists support for macOS (Apple Silicon·Intel), Windows, and Linux for the desktop app.

Installation options include a single script (`curl -fsSL https://opencode.ai/install | bash`) in addition to npm·Bun·pnpm·Yarn, Homebrew, pacman for Arch, and Chocolatey·Scoop for Windows. The documentation recommends using WSL for Windows. There is one odd note in the docs: both V1 and V2 use the same command `opencode` and may conflict with each other. The default Homebrew formula installs V2.

The model is not tied to a specific vendor. You can use any LLM provider by setting an API key, and the connection is made via `/connect`. The documentation first recommends its own verified list (OpenCode Models).

## What you see when you first start it

There are two default agents. Switch between them using the Tab key.

| Agent | Function |
|---|---|
| build | Default. All tools are enabled and files are modified |
| plan | Analysis and planning only. Editing is disabled |

The `plan` agent refuses editing, with an exception for Markdown plan files under `.opencode/plans/`. The `bash` agent follows permission settings. This mode was used when you want to review the plan before touching code.

Below these are sub-agents. `general` is for complex searches or multi-step tasks and uses all tools except `todowrite`. `explore` is read-only. You can call them directly with `@`, such as `@general`, or let the default agent call them automatically. If this concept feels unfamiliar, see [details → sub-agents](#/post/ai-subagent). Additionally, hidden system agents named compaction, title, and summary run automatically and cannot be selected from the UI.

Running `/init` within a project scans the codebase and creates `AGENTS.md` at the root. The documentation recommends committing this file to Git, as it serves as the project guide that agents read every time. There is a separate article explaining how such instructions are uploaded to [context](#/post/ai-context).

## Permission settings were more granular than expected

This was the part I spent the most time reading in this repo. There are three permission levels:

- allow: Execute without approval
- ask: Prompt before execution
- deny: Block

Permissions can be applied to read, edit, glob, grep, list, bash, task, todowrite, webfetch, websearch, lsp, skill, question, external_directory, doom_loop, and others. A single `edit` permission covers all file modifications (edit·write·patch). The `task` permission determines which sub-agents can be invoked; setting it to `deny` causes that sub-agent to disappear entirely from the Task tools list.

Defaults are mostly `allow`, with exceptions. `doom_loop` (when the same tool is called three times with identical input) and `external_directory` (paths outside the project) default to `ask`. Reading `.env` and `.env.*` files also defaults to `ask`, while only `.env.example` is allowed.

The `bash` agent can be configured using command patterns. Here is an example from the documentation:

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

Rules are evaluated top-to-bottom, and the last matching rule wins. Therefore, place `*` at the beginning followed by specific rules. With this configuration, `git status` passes, `rm -rf build` is blocked, and `npm test` prompts for approval.

After reading up to here, my thought was that the approval layer wrapping the [tool calls](#/post/ai-tool-use) used by the agent is a core component of the repo, independent of how smart the model becomes. Whether anything can be done is determined by the configuration file.

## Where settings are placed

The configuration file is `opencode.json` (or `opencode.jsonc`), while TUI settings are separated into `tui.json`. Keys such as `theme`, `keybinds`, and `tui` that were previously in `opencode.json` are now deprecated and have been moved to `tui.json`.

<details>
<summary>Configuration File Locations and Priority</summary>

The locations mentioned in the documentation are as follows:

- Remote: `.well-known/opencode` (organization defaults)
- Global: `~/.config/opencode/opencode.json`
- Custom: The path pointed to by the environment variable `OPENCODE_CONFIG`
- Project: `opencode.json` at the project root (searched upwards from the current directory up to the nearest Git directory)
- Inline: Environment variable `OPENCODE_CONFIG_CONTENT`
- Managed: macOS `/Library/Application Support/opencode/`, Linux `/etc/opencode/`, Windows `%ProgramData%\opencode`

Priority follows the order listed above, with later entries overriding earlier ones. Since this is a merge rather than an override, keys that do not conflict are retained from all sources.

Key settings include `model`, `small_model`, `provider`, `permission`, `mcp`, `instructions`, `agent`, `default_agent`, `plugin`, `compaction`, and others. The schema can be found at `https://opencode.ai/config.json`.

</details>

Agents, commands, and plugins are typically stored in the `.opencode/` folder (project-level) or `~/.config/opencode/` (global). It was notable that there is a separate path for organization-managed default configurations via managed settings. Although this tool started as a personal utility, its structure clearly anticipates enterprise usage.

## Creating Your Own Agents

Custom agents can be defined in two ways: either as JSON under the `agent` key in `opencode.json`, or as Markdown files placed in `.opencode/agents/` (project-level) or `~/.config/opencode/agents/` (global). When using Markdown, the filename becomes the agent name, and the file content serves as the prompt.

<details>
<summary>Agent Options List</summary>

- `description` (required)
- `mode`: One of `primary`, `subagent`, or `all`; default is `all`
- `model`: Format `provider/model-id`
- `temperature`, `top_p`
- `steps`: The previous name `maxSteps` is deprecated
- `prompt`: Relative path based on the configuration file
- `permission`: Permissions applicable only to this agent
- `hidden`: Hides subagents from the `@` menu
- `disable`, `color`
- `tools`: Deprecated, replaced by `permission`

Via CLI, use `opencode agent create` for interactive creation and `opencode agent list` to view the list. Agent-specific `permission` takes precedence over global permissions.

</details>

For example, to create a read-only reviewer agent, you would set the `mode` to `subagent` and deny `edit` permissions. This approach divides roles within the same permission framework. The principle behind such agents entering loops is covered separately in the [Agent Loop](#/post/ai-agent-loop) article.

## Continuing with Other Articles

Registering MCP servers via the `mcp` key in the configuration, along with seeing `skill` listed among permission keys, suggests that [MCP](#/post/ai-mcp) and [Skills](#/post/ai-skills) are handled within the same framework. However, detailed usage instructions for these two items appear at the sidebar title level on my documentation pages, so I will not elaborate further here. For connecting to local models directly, see [Open Source Analysis: Ollama](#/post/repo-ollama), which completes the picture. The term used to refer to this entire suite of tools is [Harness](#/post/ai-harness).

Rather than the figure of 220,000 stars, the pattern matching involving three permission values and a final rule proved more useful for understanding this repository. The approach of separating read, write, and shell operations within a single configuration file seems like a solid benchmark when evaluating other coding agents.

← [Concept Map](#/post/ai-map)

Related posts: [Subagent and Multi-agent](#/post/ai-subagent) · [Tool calling (Function calling)](#/post/ai-tool-use) · [Agent and Agent Loop](#/post/ai-agent-loop)

## Reference Links

- [anomalyco/opencode (GitHub repository, verified 2026-11-02)](https://github.com/sst/opencode)
- [OpenCode documentation: Introduction & Installation](https://opencode.ai/docs/)
- [OpenCode documentation: Agents](https://opencode.ai/docs/agents/)
- [OpenCode documentation: Config](https://opencode.ai/docs/config/)
- [OpenCode documentation: Permissions](https://opencode.ai/docs/permissions/)
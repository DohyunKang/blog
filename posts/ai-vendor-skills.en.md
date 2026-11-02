Claude, OpenAI Codex, Gemini CLI, and Cursor all share a similar underlying structure despite having different names for their extensions. They typically include a single file that is always read, skills that are loaded only when needed, and packages (plugins or extensions) that bundle these components together for deployment.

## What Extensions Solve

Models start from a blank state every time. Instructions regarding our project's build commands, coding rules, and frequent workflows must be written somewhere to be read. Coding agent tools solve this by using files. However, loading everything all the time quickly fills up the [context](#/post/ai-context). Therefore, most are divided into two layers:

- **Always-read layer**: Short instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, Cursor rules)
- **On-demand layer**: Skills. Only the name and description are kept; the body is read when needed. The principles are summarized in the [skills](#/post/ai-skills) post.

External tools can be attached via [MCP](#/post/ai-mcp) servers, and packages that install multiple pieces at once can be added on top.

## Tool Comparison Table

This table includes only information verified from official documentation.

| Tool | Name | Method | File Location | Example |
|---|---|---|---|---|
| Claude Code | CLAUDE.md | Always-loaded instructions | Project `./CLAUDE.md` or `./.claude/CLAUDE.md`, personal `~/.claude/CLAUDE.md`, rules split in `.claude/rules/` | Build/test commands, coding rules |
| Claude Code | Skills | Description stays resident; body loaded on demand | Personal `~/.claude/skills/<name>/SKILL.md`, project `.claude/skills/<name>/SKILL.md` | `/deploy`, change summary skill |
| Claude Code | Plugins | Install as a bundle of skills, agents, hooks, and MCP servers | `.claude-plugin/plugin.json`, installed in `~/.claude/plugins/` | Install from marketplace with `/plugin` |
| OpenAI Codex | AGENTS.md | Always-loaded instructions | Global `~/.codex/AGENTS.md`, project root to current folder's `AGENTS.md` for each subfolder | Repository work rules |
| OpenAI Codex | Skills | Description stays resident; body loaded when selected | `$HOME/.agents/skills`, repository `.agents/skills` | `$changelog-writer` |
| Gemini CLI | GEMINI.md | Always-loaded instructions | Global `~/.gemini/GEMINI.md`, work folder and parent folders' `GEMINI.md` | Tone/style guide |
| Gemini CLI | Extensions | Bundle of prompts, MCP, commands, skills, hooks, and sub-agents | `~/.gemini/extensions/<name>/gemini-extension.json` | `gemini extensions install <repository URL>` |
| Cursor | Rules (Rules) | Instructions appended by type | `.cursor/rules/*.mdc`, user rules in settings screen | Rules applying only to specific file patterns |
| Cursor | AGENTS.md | Instructions without frontmatter | Project root or subfolders | Folder-specific instructions |
| ChatGPT | GPTs | Custom chatbots bundling instructions, knowledge files, features, apps, and actions | Created inside ChatGPT, not as files | Chatbots for specific purposes |

## A Bit More on Each Tool

### Claude

Claude Code has the most distinct extension layers. Instructions are in CLAUDE.md, procedures are handled by skills, and bundles are plugins. The documentation advises keeping only "facts to always carry" in CLAUDE.md, moving multi-step procedures or content applicable to specific code sections to skills or path-specific rules.

The `SKILL.md` header controls the action. Setting `disable-model-invocation: true` allows invocation only via `/name`, while `user-invocable: false` restricts usage to the model alone. The old `.claude/commands/deploy.md` format still works, but if a skill has the same name, the skill takes precedence. In case of name conflicts, priority follows the order: Enterprise, Personal, then Project. Tips for usage are covered separately in [Claude Skills Usage](#/post/claude-skills) and [Popular Skills](#/post/claude-popular-skills).

Plugins add the names and descriptions of skills and agents to the context on every turn when activated. This means tokens are consumed even in inactive sessions, so documentation should warn about this. Official marketplace plugins show estimated context costs before installation. Additionally, Claude Code can read a repository's `AGENTS.md` instead of CLAUDE.md.

### OpenAI Codex

Codex's AGENTS.md creates a single instruction chain at startup. It reads and concatenates files from the global folder (`~/.codex`) down to the current project root folder, reading at most one file per folder. Files closer to the current folder appear later, so earlier instructions are overridden. If an `AGENTS.override.md` exists in the same location, it is used instead of a regular file. The combined size defaults to 32KiB.

Skills have the same form as Claude's. `name` and `description` are required in `SKILL.md`, and you can place `scripts/`, `references/`, and `assets/` folders alongside them. Invocation can be done directly via `$skill_name` or `/skills`, or Codex will choose based on whether the task matches the description. The initial list of skills uploaded is limited to about 2% of the context window. To disable it, set `allow_implicit_invocation: false` in `agents/openai.yaml`.

### Gemini CLI

GEMINI.md reads and concatenates files from three locations: the global folder, the workspace folder, and the parent folder, as well as scanning the location when a tool accesses a file. You can import other files using `@file.md`, and by setting `context.fileName` to `["AGENTS.md", "GEMINI.md"]`, you can change which files are read. The combined result can be viewed with `/memory show`.

Extensions serve as bundles among these. Place a `gemini-extension.json` at the root, and include `commands/` (TOML commands), `skills/`, `agents/` (sub-agents, previews), `hooks/hooks.json`, and `policies/`. The manifest should contain `mcpServers`, `contextFileName`, `excludeTools`, and `settings` (user values like API keys). Installation works by creating a copy, so if the original changes, you must run `gemini extensions update`.

The documentation noted that as of June 18, 2026, Gemini CLI is being replaced by Antigravity CLI for free tier users and Google One subscribers. You need to check which one is in use at the time of reading this.

### Cursor

Cursor rules are `.mdc` files in `.cursor/rules`, while regular `.md` files are ignored. The preamble's `description`, `globs`, and `alwaysApply` divide them into four types:

| Type | When Applied |
|---|---|
| Always Apply | All conversations |
| Apply to Specific Files | When files matching the glob are in the context |
| Apply Intelligently | When the agent judges it matches based on the description |
| Apply Manually | When invoked directly via `@rule_name` |

The previous three tools divided functionality into "always-read files" and "skills read when needed," whereas Cursor divides this within a single rule using types. Team and Enterprise tiers include team rules managed from the dashboard, which administrators can enforce.

### ChatGPT

ChatGPT's GPTs differ fundamentally in how they organize files into folders. They bundle instructions, uploaded knowledge files, features, apps, and actions on-screen to create a single customized chatbot. OpenAI documentation states that apps and actions cannot be used simultaneously within a single GPT.

## Common Similarities

- Although instruction file names vary, AGENTS.md is used as a common term. Codex uses it originally, Cursor supports it, Claude Code can read it, and Gemini CLI can be configured to read it via file name settings.
- The skill format converges on the `SKILL.md` folder. Claude, Codex, and the Gemini CLI extension all use the same file names.
- Persistent items are just names and descriptions; content is loaded when needed. Therefore, the description sentence dictates invocation accuracy.
- Bundles are plugins (Claude) or extensions (Gemini CLI), and external tool connections go through MCP.

## Common Misconceptions

- It's easy to think that putting everything in the instruction file is sufficient, but since it's always read, longer files consume more context and tokens. The procedure recommends extracting steps into skills as per documentation guidance.
- Instructions are not mandatory. Claude documentation states that CLAUDE.md is treated as context rather than a setting, and hooks should be used for things that must be blocked.
- Skills with the same name do not transfer directly between tools. Locations (`.claude/skills`, `.agents/skills`) and preamble fields differ per tool.
- Installing more plugins isn't always better. Even if enabled items aren't used, their descriptions still appear in the context.

<details>
<summary>Comparison of SKILL.md Preambles by Tool</summary>

| Item | Claude Code | Codex |
|---|---|---|
| Required fields | None (description recommended) | name, description |
| Call only humans | `disable-model-invocation: true` | - |
| Disable automatic model invocation | Same as above | `allow_implicit_invocation: false` in `agents/openai.yaml` |
| Direct call | `/name` | `$name` |
| Run sub-agent | `context: fork` | - |

</details>

← Concept map (#/post/ai-map)

Related posts: [Skills](#/post/ai-skills), [MCP](#/post/ai-mcp), [Harness](#/post/ai-harness)

## Reference Links

- Claude Code Skills: https://code.claude.com/docs/en/skills
- Claude Code Plugins: https://code.claude.com/docs/en/plugins
- Claude Code Memory (CLAUDE.md): https://code.claude.com/docs/en/memory
- Codex Skills: https://learn.chatgpt.com/docs/build-skills
- Codex AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Gemini CLI Extensions: https://geminicli.com/docs/extensions/
- Gemini CLI Extension Reference: https://geminicli.com/docs/extensions/reference/
- Gemini CLI GEMINI.md: https://geminicli.com/docs/cli/gemini-md/
- Cursor Rules: https://cursor.com/docs/context/rules
- OpenAI GPTs Help (verified via search result summary only): https://help-lb.openai.com/en/articles/8554407
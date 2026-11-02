Claude Code offers several configuration options. After reading the official documentation, I've organized them into four categories: "Always inform," "Invoke only when needed," "Strictly enforce," and "Connect to external tools."

## First, let's look at a table

| What | When to use | File location |
|---|---|---|
| CLAUDE.md | Guidelines for every session (build commands, rules) | `./CLAUDE.md` or `./.claude/CLAUDE.md` (project), `~/.claude/CLAUDE.md` (global personal), `./CLAUDE.local.md` (personal & project-specific) |
| Skill | Load specific workflows only when needed | `~/.claude/skills/<name>/SKILL.md` (personal), `.claude/skills/<name>/SKILL.md` (project) |
| Slash command | Invoke directly via `/name`. Custom commands are merged into skills | Built-ins have no file. Custom ones go in `.claude/commands/<name>.md` or as a skill |
| Hook | "Always enforce" actions like formatting after edits or blocking risky operations | `~/.claude/settings.json`, `.claude/settings.json` under the `hooks` key |
| Sub-agent | Run tasks with high output (like logs/search) separately and receive only summaries | `.claude/agents/`, `~/.claude/agents/` |
| Permissions | Set allow/deny rules, verification modes | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` |
| Plan mode | Receive only plans after investigation before making changes | Not a file. Use Shift+Tab, `/plan`, or `--permission-mode plan` |
| MCP | Connect to external tools like issue trackers or databases | `.mcp.json` (project), `~/.claude.json` (local/user) |

Below is an expanded explanation of each table item based on the official documentation. All content comes from reviewing the Claude Code docs (code.claude.com).

## CLAUDE.md: Guidelines loaded every session

The documentation states that sessions always start with a fresh context window. Therefore, there are two mechanisms to carry knowledge across sessions: my custom CLAUDE.md and auto memory written by Claude itself. CLAUDE.md is loaded for every session. Since it's always included in the [context](#/post/ai-context), shorter is better. The documentation recommends keeping the file under 200 lines, as longer files consume more context and may cause guidelines to be less adhered to.

Running `/init` analyzes your codebase and generates a CLAUDE.md containing build commands, testing methods, and conventions. If one already exists, it won't overwrite but will suggest improvements instead. Other files can be imported using `@path/to/import` syntax, though the documentation notes this is for organization and doesn't reduce context costs. Rules applicable only to specific folders should be split into files under `.claude/rules/` with paths specified so they load only when those files are touched.

One important limitation exists: the documentation treats CLAUDE.md as "context" rather than a "strict setting." To strictly block certain actions, it recommends using hooks instead.

## Skill: Procedures invoked only when needed

A skill is a folder centered around a single `SKILL.md` file. Claude loads it if it deems it relevant, or you can invoke it directly via `/skillname`. The content loads only when used, so even long reference materials incur minimal cost during idle time. This is the key difference from CLAUDE.md.

The structure consists of two parts: a YAML frontmatter starting with `---`, followed by Markdown instructions below.

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

Key fields to note in the frontmatter are:

| Field | Meaning |
|---|---|
| `name` | Name displayed in the `/` menu. Omitting it uses the folder name |
| `description` | What it does and when to use it. Claude uses this to decide applicability (recommended by docs) |
| `when_to_use` | Example phrases or requests that trigger the skill, appended after description |
| `disable-model-invocation` | If `true`, Claude won't invoke it itself; you must call via `/` |
| `user-invocable` | If `false`, hidden from the `/` menu; only Claude can invoke |
| `allowed-tools` | Tools the skill can use without approval during its turn |
| `context: fork` | Execute the skill within a sub-agent |
| `paths` | Automatically load only when files in these paths are accessed |

Folders can contain auxiliary files such as `reference.md`, `examples.md`, and a `scripts/` directory in addition to `SKILL.md`. The documentation advises keeping the main document under 500 lines for `SKILL.md` and moving detailed content to other files, which are then referenced from `SKILL.md`. In case of naming conflicts, the precedence order is enterprise > personal > project.

### How to write description (description)

Claude only reviews the descriptions of all skills at each session; this single line determines whether a skill will be invoked. The guidance provided in the documentation includes three key points: place the core purpose at the very beginning; combine what the skill does with when it is used, and include trigger phrases; write specifically enough so that the skill is not invoked for unrelated tasks. An example from the documentation is as follows:

> Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.

Since the combined text of `description` and `when_to_use` is truncated at 1,536 characters in the list, do not place important information at the end.

For tasks with side effects like deployment or commits, the documentation recommends setting `disable-model-invocation: true`. This allows you to control the timing yourself. For actions that are not behavioral but rather background knowledge, set `user-invocable: false`.

## Slash Commands: Skills and Commands United

Custom commands are now merged into skills based on the documentation. Both `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` create `/deploy` and function identically. Existing command files remain unchanged, but new creations are recommended as skills. In case of naming conflicts, skills take precedence. Built-in commands mentioned in the documentation include `/help`, `/compact`, `/skills`, `/add-dir`, `/status`, and `/usage`; the complete list can be found in the command reference.

## Hooks: Devices That Must Always Execute

Hooks are shell commands executed at specific points in the Claude Code lifecycle. The core idea of the documentation is not to rely on the LLM to act autonomously, but rather to ensure that certain actions "always happen." In the settings file (`~/.claude/settings.json` or the project's `.claude/settings.json`), insert the event name as a key within the `hooks` block. Available events include `PreToolUse` (before tool execution, interruptible), `PostToolUse` (after success), `PostToolUseFailure`, `Notification` (while waiting for input), and `SessionStart`. For example, a setting that runs Prettier after editing by matching `Edit|Write` in `PostToolUse` is provided. Once registered, hooks can be verified via `/hooks`.

Exit codes follow specific rules: 0 indicates no objection, while 2 blocks execution and sends the reason written to stderr as feedback to Claude. However, ending with 0 in `PreToolUse` does not constitute approval; normal permission procedures still apply. Additionally, even if a hook grants allow permissions, deny and ask rules remain applicable, as noted in the documentation.

## Subagents: Run Separately and Receive Only Summaries

Subagents are auxiliary agents possessing their own context window, system prompt, and tool permissions. If the task aligns with the description, Claude delegates it to the subagent, and only a summary returns to the main conversation. As highlighted in the documentation, benefits include context preservation, tool restriction, setting reuse, and running on cheaper models (such as Haiku). It is also noted that they are subject to the same usage limits.

Markdown files should include frontmatter (mandatory fields: `name`, `description`), where the body becomes the system prompt. Locations for subagents are `.claude/agents/` (project-level) and `~/.claude/agents/` (personal). Pre-built options include Explore (read-only exploration), Plan, and general-purpose. Documentation tips suggest using these for independent tasks with high output volume where failure is acceptable after testing, while refining through interaction should remain in the main conversation. Viewing this through the lens of [Harness](#/post/ai-harness) reveals it as a method to conserve context.

## Permissions and Plan Mode

Permission rules are defined under `permissions` using `allow`, `ask`, or `deny`. The evaluation order is deny, ask, allow, with the first match determining the outcome. Locations for settings include `.claude/settings.json` (shared), `.claude/settings.local.json` (personal), and `~/.claude/settings.json` (global). The documentation warns that Bash rules match against command strings written by Claude; therefore, invoking the same program in different forms could bypass restrictions, meaning deny and ask do not constitute a security boundary.

Modes are summarized into six categories.

| Mode | Summary |
|---|---|
| `default` | Auto-read only; the rest requires confirmation |
| `acceptEdits` | Automatically approves edits to files within the working folder |
| `plan` | Investigates and proposes plans only; does not modify sources until approved |
| `auto` | Executes after review by a separate classification model |
| `dontAsk` | Executes only pre-approved items; rejects the rest (for CI use) |
| `bypassPermissions` | Executes everything without inspection. Use only in isolated containers or VMs |

To enter plan mode, press Shift+Tab to cycle until "plan mode" appears on the status bar, prefix your prompt with `/plan`, or start with `claude --permission-mode plan`. Once a plan is generated, you can approve it and switch to another mode, continue planning, or edit the plan in the editor using Ctrl+G.

## MCP: Connecting to External Systems

[MCP](#/post/ai-mcp) is an open standard for connecting AI tools to external tools and data. By connecting, you can read from and write to issue trackers and databases directly without manual copy-pasting. The command is `claude mcp add --transport <type> <name> <address or command>`, and management is handled via `claude mcp list`, `claude mcp remove`, and `/mcp` within a session. There are three scopes:

| Scope | Where it loads | Shared with team | Storage location |
|---|---|---|---|
| local (default) | This project only | No | `~/.claude.json` |
| project | This project only | Yes | Project root `.mcp.json` |
| user | All my projects | No | `~/.claude.json` |

For transport, HTTP is recommended for remote servers; SSE is described as a less-used method. Local processes use stdio. The caution noted in the documentation is that servers fetching external content pose prompt injection risks, so connect only to trusted servers.

## How to Choose

- Use CLAUDE.md if you always need something: keep it short.
- For procedures needed only occasionally, use Skills; they upload only a description by default.
- Things that must not happen are hooks or deny rules. CLAUDE.md is a request, while hooks are mandatory.
- Large independent tasks should use subagents.
- Major changes should start with plan mode.
- External systems use MCP.

## Common Misconceptions

- If written in CLAUDE.md, it must be followed: the documentation states that this is context, not a forced setting.
- Skills and slash commands are separate: they have now been merged into the same `/name`.
- An exit code of 0 in a hook means approval: in `PreToolUse`, 0 indicates no objection, not approval.
- Adding something to deny does not end security: the documentation warns that changing command forms in documents can be bypassed.

<details>
<summary>Detailed explanation: Hook configuration example (document flow summary)</summary>

The first example in the document adds a `Notification` hook to `~/.claude/settings.json` so that Claude displays a desktop notification when waiting for input. If the `hooks` key already exists, do not replace it entirely; instead, add the event key as a sibling. After editing, format with `PostToolUse` + `Edit|Write` matchers. Protection against modifying files is handled by a script in `PreToolUse` that checks file paths and, if they match, writes the reason to stderr and executes `exit 2`. The document mentions condition-based hooks evaluated by the model (prompt-based and agent-based) for decisions requiring judgment, though I did not verify these directly.

</details>

## Reference Links

- Claude Code documentation, Skills: https://code.claude.com/docs/en/skills
- Claude Code documentation, How Claude remembers your project (CLAUDE.md): https://code.claude.com/docs/en/memory
- Claude Code documentation, Hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code documentation, Subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code documentation, Permissions: https://code.claude.com/docs/en/permissions
- Claude Code documentation, Permission modes: https://code.claude.com/docs/en/permission-modes
- Claude Code documentation, MCP: https://code.claude.com/docs/en/mcp
- Claude Code documentation, Slash commands: https://code.claude.com/docs/en/slash-commands

← [Concept map](#/post/ai-map)

Related posts: [How to save Claude tokens](#/post/claude-tokens) · [MCP](#/post/ai-mcp) · [Context and context engineering](#/post/ai-context)
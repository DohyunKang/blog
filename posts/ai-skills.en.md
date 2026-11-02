Skills are a method of bundling specific ways to perform tasks (procedures, reference materials, scripts) into a single folder, which the model retrieves and reads only when it determines they are needed. Only a name and a couple of lines of description always appear in the context.

## What is a Skill?

Anthropic documents introduce skills as "filesystem-based reusable resources that bundle instructions, metadata, and optional resources (scripts, templates)." In engineering articles, this is compared to writing an onboarding guide for new employees.

The structure is simple: every skill must contain a `SKILL.md` file within a folder, with reference documents or scripts placed alongside it as needed.

```
pdf-processing/
  SKILL.md        # 메인 지침 (필수)
  FORMS.md        # 양식 채우기 가이드
  REFERENCE.md    # API 상세
  scripts/
    fill_form.py  # 돌려서 쓰는 도구
```

The `SKILL.md` file begins with a YAML header (`name`, `description`) at the top, followed by the main content. A simplified example of such a document looks like this:

```markdown
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start
(pdfplumber로 텍스트 뽑는 코드)

양식 채우기는 FORMS.md를 본다.
```

## Principle: Progressive Disclosure

The core idea is that information is not uploaded all at once. This approach is called progressive disclosure and is divided into three stages:

| Stage | When it appears | Token cost (per document) | Content |
|---|---|---|---|
| 1. Metadata | Always at the start | ~100 tokens per skill | `name`, `description` |
| 2. Body | When the skill is used | Under 5k tokens | Body of `SKILL.md` |
| 3. Resources & Code | Only when needed | 0 until read | Attached files, scripts |

In terms of flow: At the start, system prompts include the name and description for each skill. When a user requests something, the model reviews the descriptions to determine if a matching skill exists. If one does, it reads `SKILL.md` via bash, bringing the body into the [context](#/post/ai-context-window). If the body states "See FORMS.md for templates," that file is read only when needed. In the document example, since the request was for PDF text summarization, `FORMS.md` is not read.

Scripts are executed rather than read. According to the documentation, script code does not enter the context; only the execution results are included. This saves tokens compared to rewriting code for the same task repeatedly and ensures consistent results.

Thanks to this structure, installing many skills imposes little burden. The documents state that "only the name and description occupy context space until a skill is used." However, since the model selects based solely on descriptions, a single line of description effectively serves as the entry point.

## How does it differ from Prompts, Tools, and MCP?

| | Purpose | When it appears in context |
|---|---|---|
| [Prompt](#/post/ai-prompt) | Instructions for the current conversation | Written directly each time |
| Skill | Work procedures and knowledge organized in folders | Description always; body only when needed |
| [Tool Call](#/post/ai-tool-use) | Model executes external functions | Tool definition appears; results appear upon invocation |
| [MCP](#/post/ai-mcp) | Connects tools to external servers via standard methods | Connected tool definitions appear |

The documents explain that skills differ from prompts given once per conversation by being "loaded only when needed, avoiding repetitive guidance." If tools answer "what can be done," skills are closer to answering "how it is done." While the documentation does not strictly enforce this distinction, they are often used together (e.g., skill bodies instructing to call MCP tools). The documents also note that when using MCP tools within a skill, you should specify the server name in the format `server_name:tool_name`.

## Where are they used?

According to Anthropic documentation, skills can be used in several places with different methods:

- **Claude API**: Pass a `skill_id` to the `container`, and an accompanying code execution tool is required. Skills you create are uploaded via `/v1/skills` and used across the entire workspace. There is no network access, and you cannot install new packages.
- **claude.ai**: Upload as a zip file from settings. These are personal and cannot be shared or managed organization-wide. Basic document processing skills (pptx, xlsx, docx, pdf) are available.
- **Claude Code**: Place in `~/.claude/skills/<name>/SKILL.md` (personal) or `.claude/skills/<name>/SKILL.md` (project). Network access matches your local machine.

An important point is that these three environments do not synchronize with each other. Skills uploaded to claude.ai will not automatically appear in the API or Claude Code.

The Claude Code documentation includes several additional details. In the introduction, setting `disable-model-invocation: true` prevents the model from invoking tools automatically; it will only run when you call them via `/name`. Conversely, `user-invocable: false` hides commands from the `/` menu and makes them available only to the model. Legacy custom slash commands (`.claude/commands/`) have been merged into skills, but existing files continue to function. A separate article [Claude Code Skills & Settings](#/post/claude-skills) explains how these configuration methods are used overall.

## Best Practices: What the Documentation Says

I extracted only the rules and numbers from the best practices documentation.

- `name`: Must be 64 characters or fewer, using only lowercase letters, digits, and hyphens. Reserved words like `anthropic` and `claude` cannot be used.
- `description`: Cannot be empty and must be under 1,024 characters. It should describe both what the skill does and when to use it. Write in the third person (e.g., "Processes Excel files" is correct; "I can help you" is not). The description is included in the system prompt; mixing tenses may cause selection instability.
- Keep the `SKILL.md` body under 500 lines; split into multiple files if it exceeds this limit.
- Limit references to one level deep within `SKILL.md`. If a file links to another inside itself, the model may only scan the beginning (similar to `head -100`) and skip the rest.
- Keep instructions concise. Assume the model is already intelligent and include only what it doesn't know.
- For delicate tasks (e.g., database migrations), reduce freedom by instructing "Run this script as-is," while increasing freedom for tasks requiring judgment (e.g., code reviews).
- Create evaluations first. Test the skill without instructions, identify where it gets stuck, and then write only the minimum needed to fix those gaps.

The Claude Code documentation also notes that long descriptions get truncated. The combined `description` and `when_to_use` fields are truncated at 1,536 characters in the list, so place core usage information at the beginning.

## Common Misconceptions

- Installing many skills breaks context: Normally, only the skill name and description (about 100 tokens per skill according to the docs) are loaded into context. The body content is loaded only when used. However, if you have hundreds of skills, the list of descriptions itself grows large, so it's not free.
- Once a skill is invoked, its content persists: According to Claude Code documentation, when a skill is used, its body enters the conversation and remains in subsequent turns. Thus, in long-running tasks, it occupies that much space.
- You can trust all skills: Since skills provide both instructions and code, bad skills can cause the model to invoke tools incorrectly. The docs advise using only skills you created yourself or received from Anthropic, and to treat files (including scripts and images) from unknown sources with caution. Skills fetching external URLs are noted as more dangerous; treat them like software installation.
- A skill doesn't guarantee the model will use it: Whether a skill is used depends on the model's assessment of the description. Vague descriptions (e.g., "Helps with documents") may not be invoked. This is why the documentation emphasizes names and descriptions.
- Skills are not just renamed prompts: While they appear as bundles of instructions, they differ due to their filesystem structure, step-by-step loading, and script execution capabilities. Conversely, simply putting a long prompt in a folder doesn't confer the benefits of a skill. You must split content into readable chunks.

<details>
<summary>Detailed Explanation: How Skills Accumulate in Context</summary>

I follow the PDF example from the documentation exactly.

1. Start: A single line like "pdf-processing - Extracts text and tables from PDFs and fills forms..." is added to the system prompt.
2. Request: "Extract text from this PDF and summarize it."
3. The model reads the body via `cat pdf-processing/SKILL.md`. Now the body is in context.
4. Since form filling isn't needed, `FORMS.md` is not read.
5. Work proceeds according to the body instructions.

Claude Code adds one more feature: during automatic compaction, the most recently used skill is reattached, retaining only the first 5,000 tokens per skill, with a total budget of 25,000 tokens. The budget is filled starting from recently used skills, so older skills may be dropped. Therefore, placing critical instructions at the beginning of `SKILL.md` is safer. (This reflects documented content; I haven't tested it myself.) Compaction itself is covered in the [Context](#/post/ai-context) article.

</details>

<details>
<summary>Detailed Explanation: Relationship with Subagents and Hares</summary>

I understood that once the skill body enters and leaves the context, it will be treated like an ordinary instruction. The difference lies in what happens before it enters: deciding when to read it and how to execute the script is handled by the [harness](#/post/ai-harness) surrounding the model. The concept of a "skill" is closer to a promise made by the harness than by the model itself.

The Claude Code documentation states in its introduction that adding `context: fork` allows skills to be run separately in a dedicated [subagent](#/post/ai-subagent). I interpreted this as running tasks with large outputs separately and receiving only summaries, but I haven't tried it directly yet.

</details>

## Reference Links

- Anthropic Documentation, Agent Skills Overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic Documentation, Skill Authoring Best Practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Anthropic Engineering, Equipping agents for the real world with Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Claude Code Documentation, Skills: https://code.claude.com/docs/en/skills

← [Concept Map](#/post/ai-map)

Related posts: [Tool Use](#/post/ai-tool-use) · [Subagent](#/post/ai-subagent) · [Claude Code Skills & Configuration](#/post/claude-skills)
Before writing skills yourself, I checked out the Anthropic official repository (github.com/anthropics/skills) to see what others are using. For details on what a skill is and where it should be placed, refer to [Skills & Settings Summary](#/post/claude-skills); here, we only look at which skills are available.

## Things to Know First

Under the `skills/` directory in the official repository, there were 19 folders as of this writing (2026-11-02), with a star count of approximately 186,000. The repository README describes these folders as categories for creative/design, development/technology, corporate communications, and document skill examples. The four document skills (`docx`, `pdf`, `pptx`, `xlsx`) are noted as source-available rather than open source.

There are two installation methods. Since the repository itself acts as a plugin marketplace, you register these directly in Claude Code like this:

```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

Opening `marketplace.json` reveals that `document-skills` includes `xlsx`, `docx`, `pptx`, and `pdf`, while `example-skills` contains the remaining twelve (algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing). `claude-api`, `academy-guide`, and `discernment-nudge` are each separate plugins. Alternatively, you can manually copy a folder to `~/.claude/skills/<name>/SKILL.md` for use.

The Claude Code documentation also provides examples of installing from the official marketplace (`claude-plugins-official`) using commands like `/plugin install skill-creator@claude-plugins-official`. Additionally, Anthropic's built-in skills such as `pdf` and `xlsx` are synchronized from your claude.ai account and downloaded to `~/.claude/skills/synced/`.

## Official Skills: Categorized Table

I have summarized the descriptions found at the top of each skill's `SKILL.md` file.

### Document Creation & Editing

| Name | Function | When to Use |
|---|---|---|
| docx | Create, read, and edit Word documents (`.docx`) and templates (`.dotx`) | When generating documents with a table of contents, headers/footers, or page numbers |
| pptx | Create slides (`.pptx`), extract text, edit, merge, or split | When creating presentation decks or modifying existing ones |
| xlsx | Create spreadsheets (`.xlsx`, `.csv`, `.tsv`), formulas, formatting, charts, and organization | When a spreadsheet file is an input or output |
| pdf | Extract text/tables, merge/split, rotate, add watermarks, fill forms, OCR | For any task involving PDFs |
| doc-coauthoring | Procedures for collaborative document writing (context gathering, refining, reader testing) | When drafting proposals, technical specifications, or decision documents for the first time |

### Design & Visuals

| Name | Function | When to Use |
|---|---|---|
| frontend-design | Guide direction and typography choices to create UIs that don't look like generic templates | When creating new screens or overhauling existing ones |
| theme-factory | Apply themes to slides, documents, or landing pages. Includes 10 pre-made themes plus on-the-fly generation | When ensuring consistent color and font schemes across deliverables |
| brand-guidelines | Apply Anthropic's official colors and fonts | When matching the Anthropic style (not for other company brands) |
| canvas-design | Define design philosophy and create `.png`/`.pdf` posters and visuals | When creating posters or static design works |
| algorithmic-art | Seed-based generative art using p5.js with a parameter adjustment viewer | For code art like flow fields or particles |
| slack-gif-creator | Create and validate animations in GIF format compliant with Slack specifications | When making GIFs for Slack |
| web-artifacts-builder | Build complex HTML artifacts for claude.ai using React, Tailwind, and shadcn/ui | For artifacts requiring state or routing; not recommended for simple single-file outputs |

### Development & Testing

| Name | Function | When to use |
|---|---|---|
| skill-creator | Create, fix, and evaluate skills; optimize descriptions | When building your own skills |
| mcp-builder | Guides for building MCP servers (Python FastMCP, Node/TypeScript SDK) | When integrating external services via [MCP](#/post/ai-mcp) |
| webapp-testing | Test local web apps with Playwright, capture screenshots, and inspect browser logs | When verifying UI behavior or debugging |
| claude-api | Claude API & SDK reference (model IDs, pricing, streaming, tool calling, caching, etc.) | When invoking Claude from code |

### Writing & Work

| Name | Function | When to use |
|---|---|---|
| internal-comms | Internal document formats for status reports, leadership updates, newsletters, FAQs, and incident reports | When writing company-wide announcements or reports |
| academy-guide | Recommends Claude Academy courses and tutorials when asked about usage methods | When you want to attach learning materials to a usage question |
| discernment-nudge | Encourages double-checking before providing advice, plans, or estimates | When the user is ready to act on and trust that answer |

The purposes of `academy-guide` and `discernment-nudge` aren't obvious from their names alone, so I read the beginning of SKILL.md.

<details>
<summary>Detailed explanation: What distinguishes the four document skills?</summary>

Descriptions for docx, pptx, xlsx, and pdf are all phrased like "if this extension is involved, use this skill unconditionally." For example, `pptx` is used whether `.pptx` appears in input or output, even when extracting only text from the file to summarize it for email. `xlsx` covers tasks where spreadsheets are the primary input or output. This broad trigger scope aligns with the description-writing guidelines recommended in the [skill documentation](#/post/claude-skills), which emphasize defining what the skill does, when it's used, and relevant trigger expressions.

</details>

## Community Skills

There are many repositories beyond the official one. Below are only the major ones found via GitHub search. Star counts reflect values retrieved from the GitHub API on 2026-11-02.

| Name | Stars | Function | Installation |
|---|---|---|---|
| obra/superpowers | ~310,000 | Development methodology for coding agents: first asks requirements, then plans, and proceeds with implementation and review via sub-agents. Emphasizes TDD, YAGNI, and DRY. | `/plugin install superpowers@claude-plugins-official` |
| epoko77-ai/im-not-ai | ~6,400 | Polishes AI-generated Korean text to sound human while preserving facts, claims, and figures; adjusts style, rhythm, and expression only. | After `/plugin marketplace add epoko77-ai/im-not-ai`, run `/plugin install humanize-korean@im-not-ai` |
| IsaacEryn/humanizer-ko | 6 | Detects 33 Korean AI writing patterns (e.g., ChatGPT style, excessive passive voice, translationese) | See repository README |
| dotoricode/korean-humanizer | 17 | Removes the "AI feel" from generated text using Korean prompts and skills | See repository README |

The `superpowers` skill folder contained subfolders named brainstorming, writing-plans, test-driven-development, systematic-debugging, requesting-code-review, verification-before-completion, and using-git-worktrees. As the names suggest, each handles a distinct stage: planning, testing, debugging, and review.

Among Korean text-polishing skills, `im-not-ai` had the most stars. According to its README, it identifies issues such as translationese, mechanical parallel structures ("First, Second, Third"), clichés like "In conclusion" or "It implies that...", and overuse of passive voice across 10 categories and 85 sub-patterns, assigning severity levels (S1~S3). In Claude Code, invoke it with `/humanize-korean` or say "Remove the AI feel from this text." Installation instructions for Codex CLI, Gemini CLI, and Copilot CLI are also provided. Note that the Gemini extension uses a separate rulebook (47 patterns), as stated in the README. The license is MIT. Similar-named variant repositories (e.g., `im-not-ai-codex` with 72 stars, `im-not-ai-kiro` with 28) appear to be forks.

A high star count doesn't guarantee suitability for your workflow; a repository with only 6 stars might fit your needs better.

## How to Choose and Use

- For tasks with a specified file format (Word, PPT, Excel, PDF), the Document Skills are the best starting point.
- Create screens using frontend-design; verify them with webapp-testing.
- Set up your workflow procedures in skill-creator and store them in `~/.claude/skills` or the project's `.claude/skills`.
- Korean text refinement is a community skill and is not included in the official repository.

## Things to Note

- Only the `description` of a skill is loaded into the session context; the body code is loaded when needed. However, installing many skills causes their descriptions to accumulate, so install only what you need.
- Skills from marketplaces or external repositories are instructions and scripts written by others. Before installing, it's advisable to read the `SKILL.md` and `scripts/` directories.
- The four document skills have a source-available license, not an open-source one. Check each folder's LICENSE.txt before using them.

## Reference Links

- anthropics/skills repository: https://github.com/anthropics/skills
- anthropics/skills marketplace.json: https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json
- Claude Code documentation, Skills: https://code.claude.com/docs/en/skills
- epoko77-ai/im-not-ai: https://github.com/epoko77-ai/im-not-ai
- obra/superpowers: https://github.com/obra/superpowers

← [Concept map](#/post/ai-map)

Related posts: [When to use Claude skills and settings](#/post/claude-skills) · [MCP](#/post/ai-mcp) · [How to save Claude tokens](#/post/claude-tokens)
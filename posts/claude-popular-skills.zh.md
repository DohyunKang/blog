在亲自编写技能之前，我先查看了 Anthropic 官方仓库 (github.com/anthropics/skills) 中大家都在使用什么。关于技能的定义及存放位置，已在 [技能与设置整理](#/post/claude-skills) 中说明，此处仅列举现有的技能。

## 首先需要了解的内容

在官方仓库的 `skills/` 目录下，截至本文撰写时（2026-11-02），共有 19 个文件夹，Star 数约为 18.6 万。仓库 README 将这些文件夹分类为：创作与设计、开发与技术、企业沟通、以及文档技能示例。其中四个文档技能 (docx, pdf, pptx, xlsx) 标注为开源可用 (source-available)，而非完全开源。

安装方式分为两种。由于该仓库本身就是一个插件市场，因此可以在 Claude Code 中直接进行如下注册：

```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

打开 `marketplace.json` 可以看到，`document-skills` 插件包含了 xlsx、docx、pptx、pdf 这四个技能；而 `example-skills` 则包含其余十二个技能 (algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing)。`claude-api`、`academy-guide`、`discernment-nudge` 则是各自独立的插件。此外，也可以直接将文件夹复制到 `~/.claude/skills/<名称>/SKILL.md` 来使用。

Claude Code 的文档中也提到了类似 `/plugin install skill-creator@claude-plugins-official` 这样的示例，即从官方市场 (`claude-plugins-official`) 获取。另外，像 `pdf`、`xlsx` 等 Anthropic 基础技能会通过 claude.ai 账户进行同步，并下载到 `~/.claude/skills/synced/` 目录中。

## 官方技能分类表

下表是根据各技能 `SKILL.md` 文件顶部的描述整理而成的。

### 文档创建与编辑

| 名称 | 功能 | 适用场景 |
|---|---|---|
| docx | 创建 Word (.docx) 及模板 (.dotx)，读取与编辑 | 需要生成包含目录、页眉页脚、页码的文档时 |
| pptx | 创建幻灯片 (.pptx)，提取文本，编辑，合并或拆分 | 制作演示文稿或修改现有演示文稿时 |
| xlsx | 创建电子表格 (.xlsx, .csv, .tsv)，处理公式、格式与图表，整理数据 | 当表格文件作为输入或输出结果时 |
| pdf | 提取文本与表格，合并或拆分，旋转页面，添加水印，填写表单，OCR | 任何需要处理 PDF 的场景 |
| doc-coauthoring | 协作编写文档的流程（收集上下文、润色、读者测试） | 初次撰写提案、技术规格书或决策文件时 |

### 设计与界面

| 名称 | 功能 | 适用场景 |
|---|---|---|
| frontend-design | 指导选择布局与排版，以创建不似平庸模板的 UI | 创建新界面或重构现有界面时 |
| theme-factory | 为幻灯片、文档、落地页应用主题。支持使用预制的 10 个主题或即时生成 | 为产出物赋予统一的色彩与字体风格时 |
| brand-guidelines | 应用 Anthropic 官方的颜色与字体 | 需要符合 Anthropic 风格时（不适用于其他公司品牌） |
| canvas-design | 确立设计哲学，并生成 .png/.pdf 海报及视觉作品 | 制作海报或静态设计作品时 |
| algorithmic-art | 基于种子的 p5.js 生成艺术，参数调节查看器 | 代码艺术，如流体场、粒子系统等 |
| slack-gif-creator | 创建并验证符合 Slack 规范的动画 GIF | 制作用于 Slack 的 GIF 时 |
| web-artifacts-builder | 使用 React、Tailwind、shadcn/ui 为 claude.ai 构建复杂的 HTML 工件 | 需要状态管理与路由的工件。文档明确指出不要用于简单的单文件场景 |

### 开发与测试

| 名称 | 用途 | 何时使用 |
|---|---|---|
| skill-creator | 创建/修改技能、运行评估、优化描述 | 创建我的技能时 |
| mcp-builder | 构建 MCP 服务器的指南（Python FastMCP、Node/TypeScript SDK） | 将外部服务连接到 [MCP](#/post/ai-mcp) 时 |
| webapp-testing | 使用 Playwright 测试本地 Web 应用、截图、检查浏览器日志 | 验证界面行为或调试时 |
| claude-api | Claude API·SDK 参考（模型 ID、费用、流式传输、工具调用、缓存等） | 在代码中调用 Claude 时 |

### 文章/工作

| 名称 | 用途 | 何时使用 |
|---|---|---|
| internal-comms | 内部文档格式，如现状汇报、领导力更新、通讯稿、FAQ、故障报告等 | 撰写内部公告或汇报时 |
| academy-guide | 询问 Claude 用法时，会推荐 Claude Academy 的课程/教程 | 想附带资料回答用法问题时 |
| discernment-nudge | 在给出建议、计划、推测等答案前，促使再思考一次 | 用户可能轻信并据此行动时 |

仅凭 `academy-guide` 和 `discernment-nudge` 的名称无法看出其用途，所以我阅读了 `SKILL.md` 的前半部分。

<details>
<summary>详细解析：四个文档技能有何不同</summary>

docx、pptx、xlsx、pdf 的描述均采用“一旦涉及该扩展名就无条件使用此技能”的写法。对于 pptx，无论是作为输入还是输出，只要出现 .pptx 文件就会触发；同时也涵盖了仅从结果中提取文本用于邮件摘要的情况。xlsx 则涵盖以电子表格为主要输入或输出的所有任务。这种广泛设定触发范围的做法，符合 [技能文档](#/post/claude-skills) 中关于撰写描述的建议（说明做什么、何时用、触发表达）。

</details>

## 社区技能

除了官方仓库外，还有许多其他仓库。以下仅列出通过 GitHub 搜索发现的主要项目。星数数据截至 2026-11-02，来自 GitHub API。

| 名称 | 星标数 | 用途 | 安装方式 |
|---|---|---|---|
| obra/superpowers | 约 31 万 | 面向代码智能体的开发方法论：先询问需求、制定计划，再由子智能体进行实现与审查；强调 TDD、YAGNI、DRY 原则 | `/plugin install superpowers@claude-plugins-official` |
| epoko77-ai/im-not-ai | 约 6,400 | 润色 AI 生成的韩文，使其更像人类写作；保留事实、主张和数据，仅调整文体、节奏和表达方式 | 先执行 `/plugin marketplace add epoko77-ai/im-not-ai`，再执行 `/plugin install humanize-korean@im-not-ai` |
| IsaacEryn/humanizer-ko | 6 | 检测韩语 AI 文风（如 ChatGPT 风格、双重被动语态、翻译腔等）的 33 种模式 | 参考仓库 README |
| dotoricode/korean-humanizer | 17 | 消除生成文本中 AI 痕迹的韩语提示词/技能 | 参考仓库 README |

`superpowers` 技能文件夹中包含 brainstorming、writing-plans、test-driven-development、systematic-debugging、requesting-code-review、verification-before-completion、using-git-worktrees 等名称。正如字面意思，其结构分别负责计划、测试、调试、审查等阶段。

在韩语润色类技能中，`im-not-ai` 的星标数最高。根据 README，它将翻译腔、机械式并列（“第一·第二·第三”）、“总之”、“意义重大”等惯用语、过度使用被动语态等分为 10 个类别、85 个子模式，并按严重程度（S1~S3）进行识别。在 Claude Code 中，可直接调用 `/humanize-korean` 或说“去掉这篇文章的 AI 感”。README 中还提供了适用于 Codex CLI、Gemini CLI 和 Copilot CLI 的安装方法。不过 README 指出，Gemini 扩展使用了单独的规则书（47 个模式）。其许可证为 MIT。名称相似的变体仓库（如 im-not-ai-codex 72、im-not-ai-kiro 28 等）似乎已停止维护。

星标数多少并不代表适用性。拥有 31 万星标并不意味着一定适合我的工作，而只有 6 个星标的仓库可能更契合我的需求。

## 如何选择和使用

- 对于文件格式固定的任务（如 Word、PPT、Excel、PDF），文档技能（Document Skills）是最优先的选择。
- 创建界面时使用 `frontend-design`，进行验证则使用 `webapp-testing`。
- 将我的工作流程配置为 `skill-creator`，并将其放置在 `~/.claude/skills` 或项目目录下的 `.claude/skills` 中。
- 韩语润色属于社区技能，官方存储库中并不包含。

## 注意事项

- 技能（Skill）仅将 `description` 上传至每个会话的上下文中，正文在使用时才会加载。尽管如此，安装的越多，`description` 积累得也越多，因此只保留必要的部分。
- 来自市场或外部存储库的技能是他人编写的指令和脚本。在安装之前，最好先阅读 `SKILL.md` 和 `scripts/` 目录下的内容。
- 文档技能并非开源许可（Open Source），而是源码公开（Source Available）。在使用前，请查看各文件夹中的 `LICENSE.txt` 文件。

## 参考链接

- anthropics/skills 存储库：https://github.com/anthropics/skills
- anthropics/skills marketplace.json：https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json
- Claude Code 文档，Skills：https://code.claude.com/docs/en/skills
- epoko77-ai/im-not-ai：https://github.com/epoko77-ai/im-not-ai
- obra/superpowers：https://github.com/obra/superpowers

← [概念地图](#/post/ai-map)

相关文章：[Claude 技能与配置，何时使用什么](#/post/claude-skills) · [MCP](#/post/ai-mcp) · [节省 Claude Token 的方法](#/post/claude-tokens)
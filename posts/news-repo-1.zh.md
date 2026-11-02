本周 GitHub 趋势列表中绝大多数都是关于 Agent Skills 和 Harness 的项目，其中夹杂着一个风格迥异的仓库：TauricResearch 的 TradingAgents。这是一个将交易公司的职能分工迁移到 LLM Agent 上的项目。

## 本周趋势中观察到的内容

在每周趋势的前 15 个项目中，有 13 个与 AI 相关。其中大多数是附加给 Coding Agent 的技能、CLAUDE.md、记忆功能以及 Harness 等工具。而在这些项目中，真正以“Agent 之间分工协作”这一结构本身为主题的是 TradingAgents。

检查的时间点是 2026 年 11 月 2 日。根据 GitHub 页面显示，该项目拥有约 119,000 颗星标（头部数据显示为 12 万），Fork 数量为 22,900 次。这些数值每天都在变化。许可证类型为 Apache-2.0，最新发布的版本标记为 v0.7.1（发布于 2026 年 10 月）。

## 这是一个什么样的项目

README 将其介绍为构建在 LLM 和 LangGraph 之上的多 Agent 交易框架。其核心在于模仿实际交易公司的组织架构。Agent 们会先就市场情况进行讨论，随后做出决策。

角色分配如下：

| 阶段 | 角色 | 职责 |
|---|---|---|
| 分析组 | 分析师 | 基本面、情绪（新闻·StockTwits·Reddit）、宏观新闻、技术指标（MACD, RSI 等） | 并行地各自查阅资料并撰写报告 |
| 研究员组 | 多头研究员、空头研究员 | 针对分析师的报告进行相互辩论 |
| 交易员 | 交易员 | 综合报告，确定买卖时机和规模 |
| 风险与运营 | 风险管理、投资组合经理 | 评估建议并予以批准或拒绝。获批的订单将发送至模拟交易所 |

用一句话概括流程即为：分析 → 讨论 → 决策 → 风险审查 → 批准。这种结构并非由单一模型一次性给出答案，而是将同一问题从多个角度进行分析，并让各方相互反驳。

这种结构与 Agent 设计文章中提到的模式高度重合。分析师同时工作的部分属于并行化；多头与空头交锋的部分则接近于对单个 Agent 结果进行审查的评估阶段。这些模式已在 [详见 → Agent 设计模式](#/post/app-agent-design) 中单独整理。此外，每个角色都使用独立上下文这一点，也与 [详见 → Sub-Agent 与 Multi-Agent](#/post/ai-subagent) 相关联。

## 可以使用哪些模型

支持的提供商列表非常长。包括 OpenAI、Google、Anthropic、xAI、DeepSeek、Qwen、GLM、MiniMax、OpenRouter、Mistral、Kimi、Groq、NVIDIA NIM、AWS Bedrock 和 Azure OpenAI，本地模型则通过 Ollama 连接。只要是兼容 OpenAI 的端点即可使用，README 中还提到 ChatGPT Plus/Pro 订阅用户也可以使用。

一个仓库能支持如此多的提供商，意味着在保持 Agent 结构不变的情况下仅替换模型已成为一种常见的用法。这也印证了每个 Agent 本质上只是一个调用 [LLM](#/post/ai-llm) 的薄层。

## 如何开始使用

根据 README 要求，需要 Python 3.11 或更高版本，示例代码使用的是 3.13。克隆仓库后，通过 `pip install .`（或 `uv pip install .`）进行安装，然后运行 `tradingagents` 或 `python -m cli.main` 来启动 CLI。在 Python 代码中也可以导入并使用 `TradingAgentsGraph`。若要通过 Docker 运行，请复制 `.env.example` 为 `.env` 并填入密钥，随后执行 `docker compose run --rm tradingagents`。

此外，功能列表中还包含了持久化记忆日志、从检查点继续运行、按股票代码/日期网格进行回测、考虑投资组合的执行策略，以及通过 Yahoo Finance Ticker 支持非美国市场等功能。

<details>
<summary>论文内容是什么</summary>

README 中挂出的论文是 arXiv:2412.20138 "TradingAgents: Multi-Agents LLM Financial Trading Framework"。该论文首次发布于 2024 年 12 月 28 日，最新版本 v7 更新于 2025 年 6 月 3 日。

根据摘要，其主张主要有三点：以类似实际交易公司的方式组织 LLM Agent 的领域尚未得到充分探索；该框架在累计收益率、夏普指数和最大回撤方面表现优于基准模型；因此证明了多 Agent 结构的潜力。这些数值均出自论文的实验条件，并非实际资金运作的业绩。

</details>

## 附带的相关线索

README 声明本项目是出于研究目的而构建，并非用于金融、投资或交易建议。性能表现取决于所选模型、温度参数、数据质量以及结果的不确定性；即使输入相同，对话内容也可能不同，因此难以将单次输出作为可靠依据。

建立这种讨论结构的原因也与此相关：相较于单次调用，多次相互验证能带来更稳定的预期。不过，调用次数会随角色数量增加而相应增多，成本也随之上升。[Agent Loop](#/post/ai-agent-loop) 的轮数不同，每次运行所需的 token 数量也会有显著差异。

我将本 repo 视为多智能体结构的示例，而非投资工具；在观察如何拆解角色以及按何种顺序触发交互方面，它是一个很好的样本。若要亲自运行测试，建议仅在模拟交易环境中进行。

## 参考链接

- [TauricResearch/TradingAgents (GitHub)](https://github.com/TauricResearch/TradingAgents)
- [GitHub Trending 每周榜单](https://github.com/trending?since=weekly)
- [TradingAgents 论文 (arXiv:2412.20138)](https://arxiv.org/abs/2412.20138)

---

← [概念地图](#/post/ai-map)

相关文章：[智能体设计模式](#/post/app-agent-design) · [子智能体与多智能体](#/post/ai-subagent) · [智能体与智能体循环](#/post/ai-agent-loop)
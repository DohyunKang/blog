10 月 7 日，Anthropic 发布了 Claude Haiku 5.5。Haiku 是 Claude 系列中体积最小、速度最快的模型，本次发布说明将其描述为“迄今为止推出的小模型中价格最低、速度最快且最聪明”。逐一查看各项数据后，价格方面尤为引人注目。

## 适用场景

发布说明中列举的用途包括摘要、压缩（compaction）、数据库查询和分类等需要处理大量数据但单条成本较低的任务。在编码代理（coding agent）场景中，Opus 5.5 或 Sonnet 5.5 负责做出重大判断，而 Haiku 5.5 则作为子代理（sub-agent）在一旁协同工作。此外还提到了对响应速度要求较高的场景，如实时客户支持和浏览器操作等。

模型概述文档中的单行描述也类似：适用于大规模且对延迟敏感的任务，例如分类、提取和路由；相反，复杂的代理编码任务则推荐使用 Sonnet 5.5 或 Opus 5.5，发布说明中直接指出了这一点。

相关概念已有专门整理的文章。关于压缩（compaction），请参见 [详情 → 压缩与内存](#/post/ai-compaction)；关于子代理（sub-agent），请参见 [详情 → 子代理与多代理](#/post/ai-subagent)。

## 规格参数

以下数据来自模型概述文档。由于文档内容可能更新，此处以 2026 年 11 月 2 日版本为准。

| 项目 | Claude Haiku 5.5 |
|---|---|
| API 模型 ID | claude-haiku-5-5 |
| 上下文窗口 | 1M 令牌 |
| 最大输出 | 128K 令牌 |
| 知识截止时点 | 2026 年 6 月 |
| 思考（thinking） | 自适应（adaptive） |
| 默认 effort | medium |
| 提供商 | Claude Platform, AWS, Google Cloud, Microsoft Azure |

Haiku 首次引入了效果调节级别。根据发布说明，共有 Low、Med、High、Xhigh、Max 五个等级。即使是小模型，现在也能设定“思考多久”了。关于思考令牌（thinking tokens）的详情，请参见 [详情 → 推理模型与思考令牌](#/post/ai-reasoning)；关于窗口大小的讨论，请参见 [详情 → 上下文窗口与令牌](#/post/ai-context-window)。

## 价格

以下表格按百万令牌为单位整理自发布说明。Haiku 5.5 在请求长度低于或超过 10 万令牌时单价不同。

| 类别 | Haiku 5.5 (≤10 万) | Haiku 5.5 (>10 万) | Haiku 4.5 | Sonnet 5.5 |
|---|---|---|---|---|
| 输入 | $0.10 | $0.50 | $1.00 | $2.00 |
| 输出 | $0.50 | $2.50 | $5.00 | $10.00 |
| 缓存读取 | $0.01 | $0.05 | $0.10 | $0.10 |
| 缓存写入 | $0.125 | $0.625 | $1.25 | $2.50 |

发布说明指出，Haiku 5.5 的平均价格比 Haiku 4.5 低约 75%。脚注补充称，对于不超过 10 万令牌的请求便宜 90%，超过 10 万令牌的请求便宜 50%。此外还提到，由于新的 tokenizer 原因，完成相同任务时可能会略微多消耗一些令牌。因此，仅比较表格中的单价会显得比实际账单更为乐观。

批量 API 享受 50% 折扣，缓存读取价格为基本输入价的 10%，这些信息来自模型概述文档。关于缓存机制的具体运作方式，请参见 [详情 → 提示词缓存](#/post/ai-prompt-caching)。

<details>
<summary>简单计算示例</summary>

假设请求量为 1 万次，每次请求输入 2,000 令牌、输出 300 令牌。全部属于 10 万令牌以下区间，且不使用缓存和批量处理。此处忽略 tokenizer 差异，仅作简化计算。

- 输入总量：2,000 万令牌
- 输出总量：300 万令牌
- Haiku 5.5: 20 × $0.10 + 3 × $0.50 = $3.50
- Haiku 4.5: 20 × $1.00 + 3 × $5.00 = $35
- Sonnet 5.5: 20 × $2.00 + 3 × $10.00 = $70

如果原本使用 Sonnet 处理分类或摘要等任务，仅将这部分切换到 Haiku，该阶段的成本按单价计算可降至原来的五十分之一。当然，前提是性能质量能够匹配。

</details>

## 性能数据

发布说明中列出的基准测试与 Haiku 4.5、GPT-6 Luna 和 Sonnet 5.5 一同呈现，所有数据均由 Anthropic 发布。

| 基准测试 | Haiku 5.5 | Haiku 4.5 | GPT-6 Luna | Sonnet 5.5 |
|---|---|---|---|---|
| OSWorld 2.1 (部分离线) | 72.4% | 15.7% | 48.9% | 83.9% |
| Humanity's Last Exam (无工具) | 45.9% | 10.2% | - | 56.9% |
| Humanity's Last Exam (有工具) | 57.4% | 18.7% | - | 64.5% |
| Terminal-Bench 4.0 | 39.2% | 0.0% | 16.4% | 70.6% |
| FrontierCode 1.1 (Main) | 46.4% | - | 42.4% | 52.1% (Xhigh) |

代际差异显著。计算机操作基准测试 OSWorld 从 15.7% 提升至 72.4%，Terminal-Bench 也从 Haiku 4.5 的 0.0% 提升至 39.2%。不过，终端任务与 Sonnet 5.5 的 70.6% 仍有较大差距。发布会论文中提到将复杂的代理编码交由大模型处理的原因，便体现在这一栏中。

<details>
<summary>客户案例中的数值</summary>

以下是发布会论文中引用的客户方结果。由于各方均在各自评估环境中进行测试，因此相互比较较为困难。

- Asana：任务完成延迟减少超过 30%，代理单次推理速度最快提升 2.5 倍。
- HubSpot：在自有 CRM 评估中平均得分为 92.8%（三次测试）。
- AlphaSense：在 400 个查询中得分为 0.84，而 Haiku 4.5 为 0.76。
- Box：分数比 Haiku 4.5 高出 11 分，延迟约为后者的一半。
- Cognition：作为 Devin Fusion 中的辅助模型使用时，FrontierCode 得分为 66.2。

</details>

## 同期发布内容

Sonnet 5.5 的缓存读取价格从每百万令牌 $0.20 降至 $0.10。官方解释称，这使大多数代理任务的成本降低了约 20%。Max、Ultra 和 Team 订阅用户还将获得每月 API 信用额度（Max 为 $100，Ultra 为 $200，Team 合计最高 $500）。此外，Python 和 TypeScript SDK 现已支持计算机使用和浏览器使用的 beta 功能。

## 安全相关说明

发布会论文指出，与 Haiku 4.5 相比，Haiku 5.5 的乱序行为大幅减少，对滥用请求的配合倾向也有所降低。其网络安全防护机制比 Haiku 4.5 更为严格，但比 Sonnet 5.5 稍显宽松；针对渗透测试等攻击者视角的技术手段仍会被阻止。在生物学领域，其表现与 Sonnet 5、Sonnet 5.5 和 Opus 5 处于同一水平。需要更广泛解决方案的组织可以申请加入 Life Sciences 或 Cyber Verification 项目。

## 阅读感想

相较于小模型价格更低，更引人注目的是小模型被明确定位为“子代理·压缩·分类”等特定角色。从单一大型模型处理所有任务的架构，转向在每一步骤中分配不同模型的架构，这一转变似乎发出了明确的信号。若想重新审视模型究竟是何种工具，可参考 [详细介绍 → LLM 是什么](#/post/ai-llm)。

不过，在我自己的工作中，小模型的质量是否足够仍需亲自验证。基准测试往往由发布方精心挑选。

← [概念地图](#/post/ai-map)

相关文章：[AI 模型地图](#/post/ai-models)、[提示词缓存](#/post/ai-prompt-caching)、[子代理与多代理](#/post/ai-subagent)

## 参考链接

- [Introducing Claude Haiku 5.5 (Anthropic)](https://www.anthropic.com/news/claude-haiku-5-5)
- [Anthropic 新闻室](https://www.anthropic.com/news)
- [Models overview (Claude 文档)](https://platform.claude.com/docs/en/about-claude/models/overview)
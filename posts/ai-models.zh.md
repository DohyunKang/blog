模型名称每三个月就会更新，死记硬背毫无用处；只需按公司、规模以及是开源还是闭源来分类，即便出现新名字也能迅速找到对应位置。下表中的名称、价格及数值均仅摘录自各公司官方页面在 2026-11-02 的数据。

## 什么是模型

此处的“模型”指的是像 [LLM](#/post/ai-llm) 那样能够进行文本读写的大型神经网络。即使是同一家公司，也会发布多种不同规模的模型：大模型擅长处理复杂任务，但运行速度慢且成本高；小模型则速度快、成本低，但在复杂任务上表现较弱。因此，“哪家公司的模型最好”往往不如“哪种规模适合我的工作”来得重要。

## 各公司当前有哪些模型

下表整理了从官方模型页面获取的信息。价格为每百万令牌（MTok）的输入/输出费用（美元）。

| 公司 | 模型 (API 名称) | 价格 (输入/输出) | 上下文窗口 | 备注 |
|---|---|---|---|---|
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`) | $10 / $50 | 1M | 适用于最困难的推理及长代理任务，相对较慢 |
| Anthropic | Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | 1M | 多数任务的起点，文档推荐首选 |
| Anthropic | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | 1M | 速度与性能的平衡点 |
| Anthropic | Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10~ / $0.50~ | 1M | 最快且最便宜，适用于分类与提取任务 |
| OpenAI | GPT-6 Astra (`gpt-6-astra`) | $10 / $50 | 1.05M | 擅长困难推理与编程 |
| OpenAI | GPT-6.1 Sol (`gpt-6.1-sol`) | $2 / $10 | 1.05M | 性能接近 Astra，但价格更低 |
| OpenAI | GPT-6.1 Terra (`gpt-6.1-terra`) | $1 / $5 | 1.05M | 快速高效，适用于计算机操作与写作 |
| OpenAI | GPT-6 Luna (`gpt-6-luna`) | $0.10 / $0.50 | 1.05M | 适用于简单及批量任务 |
| Google | Gemini 4 Argon (`gemini-4-argon`) | $2 / $10 (至 11/30，12/1 起调整为 $4 / $20) | 1M | 旗舰推理模型 |
| Google | Gemini 3.8 Flash (`gemini-3.8-flash`) | $0.75 / $3.75 (至 12/31，之后调整为 $1.5 / $7.5) | - | Flash 系列，适用于长代码与代理任务 |
| Google | Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | $0.30 / $2.50 | - | 3.5 系列中价格最低且速度最快 |
| DeepSeek | deepseek-v4-pro | $0.66 / $1.98 (基于峰值，含缓存未命中) | 1M | 最大输出长度 384K |
| DeepSeek | deepseek-flash | $0.15 / $0.6 (基于峰值，含缓存未命中) | 1M | 最大输出长度 384K |

阅读过程中有几点值得注意：

- 三家主要公司（Anthropic、OpenAI、Google）的旗舰模型上下文窗口均约为 1M。仅凭上下文窗口大小已无法作为判断依据，并非越大越好，这一点在 [上下文窗口](#/post/ai-context-window) 一文中已有说明。
- 各公司的命名体系不同：Claude 的名称（Fable、Opus、Sonnet、Haiku）代表模型规模；OpenAI 的名称（Astra、Sol、Terra、Luna）表示性能等级；Google 则使用 Pro/Flash/Flash-Lite 等词汇来区分规模。需结合价格表才能准确判断所属层级。
- DeepSeek 的价格随时间段波动，差异可达两倍。文档中标注平日 UTC 01~04 时及 06~10 时为峰值时段，其余时间为半价。

## 开源模型与闭源模型

闭源模型仅可通过 API 使用，无法获取权重（即训练所得的参数集合）。开源权重（open weights）模型则允许用户下载权重并在本地计算机或服务器上部署运行。这并不意味着源代码完全公开，且各模型的许可条款各不相同，需单独确认其是否允许商业使用。

| 公司 | 开放版本中确认的模型 | 许可证 | 规模 |
|---|---|---|---|
| Qwen(阿里巴巴) | Qwen3.8-27B | Apache-2.0 | 27B 密集，图像·视频理解 |
| Qwen(阿里巴巴) | Qwen3.8-Flash-Next, Qwen3.8-2.4T-A95B | - | 180B / 2.4T（Hugging Face 列表显示的规模） |
| DeepSeek | V4.1-Flash, V4-Pro-0813 等 | Mistral 文档中显示 V4.1 Flash 为 MIT | 基于 Hugging Face 列表，规模为 763B / 1.7T |
| Mistral | Mistral Large 4 | Mistral Ecosystem Open Weight License | - |
| Mistral | Mistral Small 4, Ministral 3 (3B/8B/14B) | Apache 2.0 | 较小规模 |
| Meta | Llama 4 Scout/Maverick | - | Hugging Face 显示为 109B / 402B（自 2025-05 后无更新） |

Meta 的信息整理尚不完整。从官方 Hugging Face 列表中读到的最新 Llama 是 Llama 4（2025 年 5 月更新）。搜索结果中虽有文章称 Meta 将在 2026 年以"Muse"之名发布开放权重，但来源仅有一两处。

OpenAI 此次阅读的模型页面并未出现如 gpt-oss 之类的开放模型。这并非表示不存在，而是该页面未涉及相关内容。

[详细 → LLM](#/post/ai-llm)

## 规模系列：大·中·小

从表格可以看出，各公司对规模的划分大致相似。

| 系列 | 示例 | 适合委托的任务 | 单价感觉 |
|---|---|---|---|
| 大 | Fable 5.1, GPT-6 Astra, Gemini 4 Argon | 复杂推理、运行数小时的代理任务 | 输入 $10 级 |
| 中 | Opus 5.5, Sonnet 5.5, GPT-6.1 Sol/Terra, Gemini 3.8 Flash | 编程·文档·一般办公 | $0.75 ~ $4 |
| 小 | Haiku 5.5, GPT-6 Luna, Gemini 3.5 Flash-Lite | 分类·提取·路由、批量处理 | $0.10 ~ $0.30 |

Anthropic 文档最初介绍最便宜的 Haiku，并说明在资源不足时如何升级，同时也介绍了从最强模型开始逐步缩减的方法。无论哪种方式，都建议用自己的数据进行评估验证。

## 推理模型

推理模型是指在输出答案前先进行思考 token 消耗的模型。目前似乎更倾向于在一个模型内部调节思考量，而非单独选择“推理模型”。

- Claude：此次阅读的四个模型均采用自适应（adaptive）思考模式，Fable·Opus 则始终开启。通过 `effort` 值调节深度。文档指出，调整 effort 往往比更换模型更为有效。
- OpenAI：表格中包含“推理阶段”选项。Astra·Sol 范围为 low 到 max，Terra·Luna 则为 none 到 max。
- DeepSeek：同时支持思考模式与非思考模式，默认启用思考模式。
- Qwen3.8-27B：思考模式默认为开启状态，每次请求时可手动关闭。

增加思考量会导致输出 token 增多，从而相应增加成本和时间消耗。这是通用架构层面的问题。

## 多模态

多模态指除文本外，还支持图像·语音·视频等内容。Claude 文档指出当前所有模型均支持文本与图像输入及文本输出。OpenAI 的最新模型同样支持文本与图像输入、文本输出；而生成图像·语音·视频的功能则由独立模型提供。OpenAI 发布了 GPT-Image-2.5 和实时语音（GPT-Live·GPT-Realtime）系列，Google 则分别推出了 Nano Banana（图像）、Gemini Omni Flash（视频）、Lyria（音乐）及 TTS 系列。在开源方面，Qwen3.8-27B 支持图像与视频理解，DeepSeek V4.1 Flash 也标注为支持图像 - 文本输入。

<details>
<summary>详细解析：五大选择标准</summary>

1. 性能：此次未单独查看基准测试排名。正如官方文档所述，运行包含自身工作负载的评估集最为可靠。
2. 价格：输入与输出价格不同，且输出通常更贵。读取缓存的费用仅为输入费用的一部分（Claude 文档显示为 2.5%~10%），而 Claude 批量 API 享有 50% 折扣。推理模型的思考 token 会计入输出费用（Gemini 价格表中以"incl. thinking"标示）。
3. 速度：根据 Claude 文档，相对延迟表现为 Fable 较慢、Opus 中等、Sonnet 较快、Haiku 最快。
4. 上下文：此次查阅的代表性模型大多为 1M。但质量是独立评估的。
5. 本地部署可行性：仅支持开放权重的模型。权重大小即代表所需的内存。Qwen3.8-27B 标注为 27B，量化后规模适合在个人 GPU 上运行。推测 DeepSeek V4（数百 B~1.7T）或 Qwen 2.4T 等模型难以在个人设备上部署。

</details>

## 常见误区

- **昂贵的模型总是更好**：文档也指出，对于分类、提取等批量任务，建议从小模型开始；仅在处理困难任务时才启用大模型的价值。
- **开放模型是免费的**：即使获取了权重，运行所需的 GPU、电力及运维成本依然存在。若作为服务使用，需核算这些成本。在构建 AI 功能时，应从计算单个用户每月消耗的 token 费用开始评估。
- **上下文为 1M 即代表同一级别**：窗口大小相同并不意味着处理能力处于同一水平。
- **开源与开放权重等同**：许多情况仅公开权重，而不提供训练数据或代码。许可证也从 Apache 2.0 到企业专用许可证不等。上表中的 Mistral Large 4 即为实例。
- **名称中数字越大代表越新**：Claude Fable 5.1 与 Opus 5.5 均为当前最新版本。数字仅在系列内部进行比较。

← 概念地图 (#/post/ai-map)

相关文章：[LLM](#/post/ai-llm) · [上下文窗口](#/post/ai-context-window) · [幻觉](#/post/ai-hallucination)

## 参考链接（阅读日期：2026-11-02）

- Anthropic, Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic, Choosing the right model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- OpenAI, Models: https://developers.openai.com/api/docs/models
- Google, Gemini API models: https://ai.google.dev/gemini-api/docs/models
- Google, Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek, Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Mistral, Models overview: https://docs.mistral.ai/getting-started/models/models_overview/
- Qwen3.8-27B 模型卡：https://huggingface.co/Qwen/Qwen3.8-27B
- Qwen Hugging Face 组织：https://huggingface.co/Qwen
- DeepSeek Hugging Face 组织：https://huggingface.co/deepseek-ai
- Meta Llama Hugging Face 组织：https://huggingface.co/meta-llama
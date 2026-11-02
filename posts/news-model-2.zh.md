Moonshot AI 已将 Kimi K3 的权重上传至 Hugging Face，通过直接阅读模型卡片和许可证文件发现，“公开”的含义比想象中更为复杂。（确认时间：2026-11-02）

## 这是什么模型

Kimi K3 是一个接收文本和图像的混合专家（Mixture-of-Experts）模型。模型卡片将其介绍为“open-weight, native multimodal agentic model"。数字均按卡片原文记录。

| 项目 | 值 |
|---|---|
| 总参数量 | 2.8T |
| 每 token 激活参数量 | 104B |
| 层数 | 93（其中 1 层为 dense） |
| 专家 (expert) | 从 896 个中选择 16 个，共享 2 个 |
| 上下文长度 | 1,048,576 tokens |
| 视觉编码器 | MoonViT-V2 (401M) |
| 词表大小 | 160K |

MoE 结构并非使用全部参数，而是针对每个 token 仅激活部分专家。在 2.8 万亿总参数量中，每 token 仅使用 1040 亿个参数，因此计算量更接近于激活参数，而内存占用则接近于总参数量。这一差异将在后文引出“能否逆转”的讨论。基本概念可参考 [详细说明 → LLM 是什么](#/post/ai-llm)。

## 结构中引人注目的部分

卡片与 GitHub 仓库传达了相同的信息。在 93 层中，有 69 层采用 KDA（Kimi Delta Attention），24 层采用 Gated MLA 注意力机制。博客将 KDA 称为“培养注意力的有效基础”，并介绍了另一个新元素 Attention Residuals（AttnRes）：它并非在层间均匀堆叠表达，而是沿深度方向按需选取并获取所需内容。博客声称，通过这种结构变更，与 K2 相比整体缩放效率提升了约 2.5 倍，但这属于 Moonshot 方面的说法。

关于实际使用百万 token 上下文时的成本与质量问题，已在 [详细说明 → 上下文窗口与 token](#/post/ai-context-window) 中单独整理。

## 权重格式：量化是基础

根据卡片说明，从 SFT 阶段起已进行量化感知训练（QAT），权重采用 MXFP4，激活值采用 MXFP8。该模型自训练之初即针对低精度设计，因此与后期常见的量化方式出发点不同。Hugging Face 文件中的张量类型显示为 F32、BF16、U8。

<details>
<summary>MXFP4 意味着容量大约是多少（粗略估算）</summary>

每个参数占 4 比特即 0.5 字节。2.8 万亿 × 0.5 字节约为 1.4TB。由于还包含缩放因子及部分高精度张量，实际存储将大于此值。此为粗略估算，准确容量需查看存储库的文件列表。

尽管激活参数为 104B，并不意味着只需 104B 的模型内存即可。由于哪些专家被激活取决于每个 token，因此所有专家必须加载到内存中才能快速响应。通用的 VRAM 计算方法可参考 [详细说明 → 本地运行模型](#/post/ml-local-models)。
</details>

## 如何运行

卡片提供了四种运行方式：

- **托管 API**：在 platform.kimi.ai 上使用模型名称 `kimi-k3`，兼容 OpenAI·Anthropic 端点；
- **自行服务**：推荐使用 vLLM、SGLang、TokenSpeed 作为引擎；
- **Docker Model Runner**：使用 `docker model run hf.co/moonshotai/Kimi-K3`；
- **llama.cpp·Ollama·LM Studio 用 GGUF 量化**：通过卡片中的 quantizations 列表进行连接。

服务引擎如何批处理请求及管理 KV 缓存的原理，已在 [详细说明 → 推理优化](#/post/ml-inference) 中说明。

## 思考模式始终开启

这一点在使用 API 时尤为明显。根据卡片标准，Thinking 始终处于开启状态，结果包含在 `reasoning_content` 字段中。`reasoning_effort` 可接收 low、high、max 三种值，默认值为 max。在多轮对话中使用工具时，助手消息不仅需包含 `content`，还需完整重传 `reasoning_content` 和 `tool_calls`。思考 token 对输出费用和延迟的影响已在 [详细说明 → 推理模型与思考 token](#/post/ai-reasoning) 中讨论。

API 价格已在博客中公布：每百万 token 缓存命中输入 $0.30，未命中输入 $3.00，输出 $15.00。由于缓存命中成本仅为未命中的十分之一，在长对话中固定前缀变得尤为重要。这一原理可参考 [详细说明 → 提示词缓存](#/post/ai-prompt-caching)。

## 性能数字

模型卡表格（基于最大推理强度标准）仅列出部分数据：

| 基准测试 | 分数 |
|---|---|
| GPQA Diamond | 93.5 |
| Terminal-Bench 2.1 | 88.3 |
| BrowseComp | 91.2 |
| OSWorld-Verified | 84.8 |
| MCPMark-Verified | 94.5 |
| HLE-Full (无工具 / 有工具) | 43.5 / 56.0 |

以上均为 Moonshot 在模型卡上发布的官方报告数据。博客文章整体指出，与 Claude Fable 5 和 GPT 5.6 Sol 相比，“仍然落后”（still trails），但在其他评估的模型中表现持续领先。解读基准测试分数需要随着新模型的发布不断更新，因此已单独汇总在 [AI 模型地图](#/post/ai-models) 中。

<details>
<summary>卡片上的其他分数</summary>

DeepSWE 67.5, FrontierSWE 81.2, ProgramBench 77.8, SWE-Marathon 42.0, MCP-Atlas 84.2, Toolathlon-Verified 76.5, GDPval-AA v2 1686(Elo), OmniDocBench 91.1, Video-MME(含字幕) 90.0, MMMU-Pro 81.6 / 83.4(无工具 / 有工具), MathVision 94.3 / 97.8。卡片内各项的基准日期各不相同：部分以 2026 年 7 月 23 日 Artificial Analysis 为基准，而 FrontierSWE 则以 7 月 16 日为基准。
</details>

## 许可证：既非 MIT 也非 Apache

Hugging Face 模型卡上的许可证名称为"Kimi K3 License"，并适用于代码和权重。打开 LICENSE 文件阅读的内容如下：

- 允许免费使用、复制、修改、分发、重新许可和销售，以及运行、部署、微调及制作衍生作品。
- 条件是保留版权声明并遵守法律法规。
- 向第三方以 API 等形式提供推理或微调服务的"Model as a Service"(MaaS) 业务，若连续 12 个月的合计营收超过 2000 万美元，则需与 Moonshot 另行签订合同。
- 月活跃用户超过 1 亿或月营收超过 2000 万美元的产品，必须在 UI 中显著显示"Kimi K3"标识。
- 内部使用，以及通过 Moonshot 官方产品或认证推理合作伙伴的使用，可豁免上述 MaaS 及标识义务。

个人或小团队使用时几乎不会遇到问题，限制主要针对试图利用该模型大规模进行 API 商业化的机构。由于许可证原文属于法律文件，实际用于商业服务时建议直接阅读原文。

## 阅读后的思考

“开放权重”这一说法并非等同于“可在本地 PC 运行”，该模型很好地诠释了这一点。虽然权重可供任何人获取，但拥有足够内存以加载完整专家模型的场所并不多。因此，模型卡似乎同时指引了 API、推理引擎、GGUF 等多种使用路径。若从自身角度出发，相比本地部署，优先尝试兼容 API 更为现实。此外，缓存命中率较低，其定价似乎针对需要反复发送长上下文的代理（agent）类应用场景进行了优化。

← [概念地图](#/post/ai-map)

相关文章：[什么是 LLM？](#/post/ai-llm) · [运行本地模型](#/post/ml-local-models) · [推理优化](#/post/ml-inference)

## 参考链接

- Hugging Face 模型卡：https://huggingface.co/moonshotai/Kimi-K3
- Hugging Face 许可证文件：https://huggingface.co/moonshotai/Kimi-K3/blob/main/LICENSE
- GitHub 仓库：https://github.com/MoonshotAI/Kimi-K3
- Moonshot 官方博客：https://www.kimi.com/blog/kimi-k3
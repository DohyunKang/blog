Harness 是指除去模型本身之外，用于将模型放入循环、连接工具并管理记录的代码与环境。不过，该术语的定义尚未统一，不同资料中的涵盖范围略有差异。

## 先用通俗的话解释

模型单独只能接收文本并返回文本。打开文件或执行命令并非由模型完成，而是由旁边的程序代劳。当模型发出“读取这个文件”的指令时，程序负责读取并将结果重新输入给模型，如此循环往复直到结束。这个程序就是 Harness（下马具）。

字面意思是“马具”，指套在马身上的装备。比喻而言，马（模型）的力量保持不变，但往哪里跑、如何跑则由装备决定。这个比喻是我自己加的。

## 在官方文档中如何使用

我查阅了三篇 Anthropic 的文章，发现用法略有不同：

- **Managed Agents** 文章：将 Harness 简短定义为“调用 Claude 并将 Claude 的工具调用路由到相应基础设施的循环”。该文章将 Agent 分为三部分：脑（Claude 与 Harness）、手（沙箱与工具）、会话（外部留存的事件记录）。
- **Effective harnesses for long-running agents**：没有形式化定义，而是将 Claude Agent SDK 称为“通用 Agent Harness"。感觉是将工具、上下文管理（如压缩等）及周边配置打包在一起统称为 Harness。脚注中提到，初始化 Agent 与编码 Agent 仅起始提示词不同，但包含系统提示词和工具的 Harness 是相同的。
- **Harness design for long-running apps**：将围绕模型的编排、角色分配、上下文处理及提示词统称为 Harness，并将“Harness 设计”视为一项独立任务来处理。

虽然用的是同一个词，第一篇仅指“循环与路由”，后两篇则扩展至“整个周边设计”。这正是各资料定义不一的体现。我倾向于将狭义理解为核心，广义理解为实际执行的工作。

作为对比，我也查阅了 Anthropic 的 **Building effective agents** 一文。其中将 Agent 描述为“在接收环境反馈并使用工具的 LLM 所构成的循环”，但该文中并未出现 Harness 一词。看来该术语是后来才确立的。

## Harness 的功能

综合上述三篇文章的重叠内容，可总结如下：

| 功能 | 内容 |
|---|---|
| 循环 | 重复执行模型调用、工具运行及结果反馈，直至满足停止条件（如最大迭代次数）。 |
| 工具 | 决定提供哪些工具以及如何撰写说明。Anthropic 将其称为 agent-computer interface (ACI)，并强调其重要性不亚于面向人类的 UI。 |
| 权限 | 规定可执行的操作范围及存放凭证的位置。**Managed Agents** 文章指出认证信息应存放在沙箱之外。 |
| 上下文 | 对记录进行截断与摘要，以及向外部文件写入备注的工作。 |
| 验证 | 不盲目相信模型声称的“已完成”，而是通过测试加以确认。 |
| 恢复 | 确保在会话或容器崩溃后仍能继续执行任务。 |

关于权限部分，仅在上述三篇中的 **Managed Agents** 一文里进行了具体说明；其他权限授予方式可能因产品而异。

## 与上下文工程及 Agent 循环的关系

这三个术语可串联为一句话：

- **Agent 循环**：指实际运行的动作本身，即模型调用、工具执行、结果反馈的重复过程。
- **Harness**：指真正驱动该循环的代码与环境。
- **上下文工程**：指在循环的每一轮中决定向模型呈现何种内容的工作，是 Harness 功能的一部分。

从 **[详情 → 上下文工程](#/post/ai-context)** 中提到的压缩、备注、子 Agent 等方法，最终都会实现于 Harness 代码之中。Harness 不仅处理上下文，还涵盖工具、权限、验证与恢复等功能，因此范围更广。不过，有些文章将上下文管理视为 Harness 的一部分，另一些则将其单独列出，边界取决于作者的定义。

模型接收的输入本身可参考 **[详情 → 上下文窗口](#/post/ai-context-window)** 和 **[详情 → LLM](#/post/ai-llm)**；工具连接规范则在 **[详情 → MCP](#/post/ai-mcp)** 中另行讨论。

## 示例：长时任务中的 Harness

**Effective harnesses** 一文提供了具体案例。当会话切换时，模型无法记住之前的任务，因此采取了以下措施：

第一个会话用于初始化：将用户请求展开为功能列表 JSON，启动开发服务器（`init.sh`），创建进度记录文件，并生成首次 git 提交。后续每个会话仅实现一个功能、提交代码并留存记录。新会话在开始时读取 git 日志与历史记录，先确认默认行为后再执行任务。

功能列表中的每一项初始状态均为失败，编码代理只能修改“是否通过”字段。文中提到使用 JSON 的原因在于：与 Markdown 相比，模型随意篡改或覆盖的可能性更低。此外，原本仅靠单元测试或 curl 即可完成的任务，现在借助浏览器自动化实现了类似人类的测试方式，取得了显著进步。

观察发现，模型本身保持不变，只是调整了外部结构，从而减少了失败情况（如过度尝试、过早宣告完成）。这正是“Harness 设计”所指的内容。

## Harness 工程

设计和修复 Harness 的工作被称为 Harness 工程。该术语似乎因 OpenAI 于 2026 年 2 月发布的文章《Harness engineering: leveraging Codex in an agent-first world》而广为人知。根据搜索结果中的摘录判断，初期进展缓慢的原因并非模型问题，而是环境尚不完善；因此团队的工作重心转向为代理构建可用的运行环境。二次资料将其概括为设计约束、工具、反馈回路、文档和验证体系的工作。

Anthropic 的文章也表达了相同的观点：Harness 的所有组件都基于“模型无法独立完成”的假设；一旦模型改进，这些假设便会过时。例如，在 Sonnet 4.5 中有效的上下文重置功能，在 Opus 4.5 中已不再需要。因此，Harness 并非一次性构建完成的产品，而是随着模型更新不断需要精简组件的系统。

## 常见误解

- Harness 是框架名称：它并不特指某个具体库。无论是使用 LangChain 还是自行编写的循环，只要在模型外部执行循环，就属于 Harness。
- Harness 越好，模型无关紧要：相关文献恰恰相反地指出，随着模型能力提升，Harness 会变得更简单。但这并不意味着复杂任务的 Harness 需求完全消失；也有文章提到，有趣的组合空间并未减少。
- Harness 就是提示词（prompt）：提示词仅是 Harness 的一部分。工具执行、记录管理和验证代码是独立存在的。
- 定义已固定：如上所述，Harness 既可狭义也可广义使用。阅读文章时，应先明确其适用范围。

<details>
<summary>详细解析：脑、手、会话分离</summary>

在《Managed Agents》一文中提到，Harness 并不位于容器内部。Harness 通过 `execute(name, input) → string` 这一单一接口调用沙箱和工具。若容器崩溃，Harness 将其视为工具调用错误并返回给 Claude，Claude 可创建新容器。会话是保留在 Harness 和沙箱之外的额外专用事件记录，即使 Harness 失效，也可从最后的事件重新开始。凭证也置于沙箱之外。

将 Harness 部署在托管服务背后的原因，是因为其实现可能随模型变化而调整。虽然文章并未直接说明这一点，仅能从摘要中推断，故不作断言。

</details>

<details>
<summary>详细解析：计划、生成、评估三种角色</summary>

长期应用开发文章的架构由这三种角色构成：规划者将简短请求展开为产品规范，但不过度细化技术细节，旨在防止初期错误向下蔓延；生成者逐个实现功能；评估者使用 Playwright 模拟用户操作正在运行的应用，依据标准和阈值进行评分并记录缺陷。在冲刺开始前，生成者与可测试的契约达成一致。

简化版本去除了冲刺结构，仅在最后运行一次评估者。评估者声称仅在模型无法独立稳定完成的范围内产生价值。文章也提到了编排复杂度、令牌消耗和延迟带来的成本增加。

</details>

## 参考链接

- Anthropic，高效长运行代理的驾驭方式：https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic，托管代理（脑·手·会话）：https://anthropic.com/engineering/managed-agents
- Anthropic，长运行应用开发的驾驭设计：https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic，构建高效代理：https://www.anthropic.com/engineering/building-effective-agents
- （原文无法阅读，仅搜索摘录）OpenAI，驾驭工程：https://openai.com/index/harness-engineering/

← [概念地图](#/post/ai-map)

相关文章：[上下文工程](#/post/ai-context) · [MCP](#/post/ai-mcp) · [上下文窗口](#/post/ai-context-window)
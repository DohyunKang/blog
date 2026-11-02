Microsoft Agent Framework 在 10 月期间交替发布了 Python 和 .NET 版本，从更新内容可以看出当前该框架的重点所在，包括审批、上下文压缩以及 MCP 兼容性等。

## 这个框架是什么

GitHub 仓库描述为“用于构建、编排和部署 AI 代理及多代理工作流的框架”。它支持 Python 和 .NET，采用 MIT 许可证。Go 版本位于单独的存储库（agent-framework-go）中，官方概览文档注明处于公开预览阶段，需要 Go 1.26 或更高版本。

文档将框架分为四个部分：

| 模块 | 功能 |
| --- | --- |
| Agents | 利用 LLM 处理输入、调用工具和 MCP 服务器并生成回答 |
| Harness Agent | 专为长多阶段任务设计的代理，涵盖规划与待办事项追踪、上下文压缩、文件访问与内存管理、工具审批及可观测性 |
| Workflows | 通过显式执行路径连接代理与函数的函数式或图式流程 |
| Integrations | 集成模型提供商、工具、上下文提供者、中间件、评估及 UI 连接 |

文档中提到的模型提供商包括 Microsoft Foundry、Anthropic、Azure OpenAI、OpenAI 和 Ollama，并非仅限于 Microsoft 模型。

## 与 Semantic Kernel 和 AutoGen 的关系

文档将 Agent Framework 描述为这两个项目的“直接后续”。由同一团队开发，在 AutoGen 的简单代理抽象基础上，结合了 Semantic Kernel 的会话状态管理、类型安全、过滤器和遥测功能，并增加了显式执行路径的工作流。迁移指南也单独提供在文档中。

关于何时使用代理与工作流的对比表如下：开放对话或自主工具调用应使用代理；若步骤已确定且需直接控制执行顺序则使用工作流。下方还有一行：“能用函数完成的任务，请使用函数而非 AI 代理。”

[详情 → Harness](#/post/ai-harness)

## 10 月发布列表

从仓库发布页面筛选出 10 月的内容。Python 版本标记为 `python-`，.NET 版本标记为 `dotnet-`。

| 标签 | 日期 | 亮点 |
| --- | --- | --- |
| dotnet-1.25.0 | 10/14 | 自动拒绝无响应工具审批请求、封闭式列表问题（工作流） |
| python-1.22.0 | 10/15 | 支持 Python 3.15（核心与根包）、存储格式变更 |
| python-1.23.0 | 10/22 | 兼容 MCP 2.x、AG-UI 端点强制要求认证范围 |
| dotnet-1.26.0 | 10/23 | 拒绝重复工具审批请求 ID、验证 MCP 调用头 |
| python-1.24.0 | 10/30 | 本地 MCP 工具默认审批模式、代理触发的上下文压缩（实验性功能） |
| dotnet-1.27.0 | 10/30 | 更新 AgentServer 依赖项、重定向处理逻辑变更 |

发布笔记中未显示年份，但文档日期为 2026 年 10 月，故按该年解读。此表基于撰写本文时（11 月 2 日）在发布页面所见内容。

## 值得关注的更新点

有三处特别引人注目：

首先是工具审批。.NET 版本会自动拒绝无响应的审批请求，且不再接受相同 ID 的审批请求；Python 版本则为本地 MCP 工具新增了默认审批模式。整体趋势是从允许代理随意使用工具，转向在关键节点增加人工确认环节。

其次是 MCP。python-1.23.0 引入对 MCP 2.x 的兼容支持，迁移了传输方式、错误处理及生命周期管理。发布笔记将其列为 breaking change（破坏性变更），因此继续使用现有 MCP 服务器的代码需先阅读相关说明。

[详情 → MCP](#/post/ai-mcp)

第三是上下文压缩。python-1.24.0 中代理自主触发压缩并释放技能的功能作为实验性功能加入。概览文档中 Harness Agent 的说明也提及了上下文压缩，方向一致。

[详情 → Compaction](#/post/ai-compaction)

<details>
<summary>单独整理 breaking 变更</summary>

- python-1.22.0：内容识别、托管运行、协议元数据、播放及流合并等功能已整合到整个提供者中。1.22 之前的运行时无法读取包含 `hosted`或`merge_mode`的新记录。文档指出，请勿在同一存储库中同时运行旧版和新版工作者，也不应在写入新记录后进行降级操作。
- python-1.23.0：AG-UI 端点需要显式认证范围或单一用户声明。Docker shell 选项 `extra_run_args`已更改为`unsafe_extra_run_args`。
- python-1.24.0：Beta 版 `RedisContextProvider`拒绝旧的索引 schema。必须删除并重新添加旧索引和上下文哈希。Python 3.11 为支持基线，下一版本将移除对 3.10 的支持。
- dotnet-1.25.0：Cosmos 聊天元数据已与分区键策略分离。
- dotnet-1.27.0：在 Foundry 托管应用中应使用 `builder.AddFoundryResponses(...)`。升级前创建的本地持久化响应文件将不再被读取。

</details>

## 亲自动手试试

概述文档中的示例仅需几行代码。Python 可通过`pip install agent-framework`安装，并创建传入客户端、名称和指令的`Agent`实例。运行方式为`await agent.run("...")`。示例使用 Foundry 客户端，但其结构可轻松替换为其他提供者客户端。

有一个值得注意的提示：Python 不会自动读取`.env`文件，因此若需使用，必须在启动时显式调用`load_dotenv()`。当然，也可以在 shell 中直接指定环境变量。

发布周期约为每周一次，且几乎每次都会标记 breaking 变更。若不固定版本，每次发布时似乎都需要阅读相关说明。截至检查时间（11 月 2 日），该存储库的 Star 数为 14.5k。

[了解更多 → 代理循环](#/post/ai-agent-loop)

← 概念图 (#/post/ai-map)

相关文章：[Harness](#/post/ai-harness)、[MCP](#/post/ai-mcp)、[Compaction](#/post/ai-compaction)

## 参考链接

- [microsoft/agent-framework (GitHub)](https://github.com/microsoft/agent-framework)
- [Releases · microsoft/agent-framework](https://github.com/microsoft/agent-framework/releases)
- [Microsoft Agent Framework Overview (Microsoft Learn)](https://learn.microsoft.com/en-us/agent-framework/overview/)
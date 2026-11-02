2026 年 7 月 28 日，MCP 规范的修订版已发布为稳定版本。由于版本号采用日期命名，因此版本名为 2026-07-28。GitHub 发布页面仅有一行说明：“本修订版的稳定发布”，具体变更内容整理在规范网站的 changelog 中。我已阅读并整理了该 changelog（确认时间点：2026-11-02）。若想了解 MCP 是什么，请先查看 [详细介绍 → MCP](#/post/ai-mcp)。

## 一句话总结

与上一版（2025-11-25）相比，最大的变化在于 MCP 已成为无状态（stateless）协议。原有的建立连接并维持会话的结构已被移除，每个请求均可独立处理。

## 九大主要变更中的核心内容

changelog 中的“Major changes”包含九项内容，以下仅列出理解整体流程所必需的部分：

| 变更点 | 内容 |
|---|---|
| 移除会话 | Streamable HTTP 中不再存在 `Mcp-Session-Id` 头部和协议级会话。`tools/list`、`resources/list`、`prompts/list` 的结果不再随连接不同而变化 |
| 移除初始化 | `initialize` / `notifications/initialized` 握手流程已被移除。取而代之的是，所有请求均在 `_meta` 字段中携带协议版本和客户端能力信息 |
| `server/discover` | 新增服务器必须实现的调用接口，用于告知支持的版本、能力及身份 |
| `subscriptions/listen` | 替代 HTTP GET 端点和 `resources/subscribe` 的单一长连接通知流 |
| 移除恢复功能 | SSE 流的恢复（`Last-Event-ID`）已被移除。若流中断，必须将相关请求作为新请求重新发送 |
| 任务分离 | 原本作为实验性功能存在的 tasks 已从核心中移除，转为正式扩展（`io.modelcontextprotocol/tasks`） |
| MRTR | 替代服务器主动向客户端发起请求的新模式（详见下文） |

文档中也说明了需要状态的服务器应如何处理：服务器应将自身创建的句柄作为普通工具参数进行传递。协议本身不携带状态，必要时由应用程序自行通过工具参数补充所需信息。

## 为何做出如此调整

changelog 本身并未详细阐述变更原因，但 MRTR 文档中明确指出了其目的：使服务器能够在“无需服务器实例间共享存储或负载均衡器持续将请求转发至同一服务器”的情况下处理需要额外信息的场景。所有变更均朝此方向演进。由于每个请求已包含所需全部信息，因此任何服务器实例均可独立处理。

## MRTR：服务器反问的新机制

此前，当执行工具的服务器在过程中需向用户询问某些信息（elicitation）时，会反向向客户端发起请求。这种方式要求服务器持续持有该连接。新版规范禁止此做法（文档将其标记为 breaking change），并采用以下新流程：

1. 客户端发送如 `tools/call` 等请求；
2. 若服务器判断需要更多信息，则返回 `resultType: "input_required"`，其中包含 `inputRequests`（待询问内容）和 `requestState`（仅服务器知晓的不透明字符串）；
3. 客户端向用户提问并收集答案后，将同一请求重新发送，附加 `inputResponses` 和 `requestState`，同时生成新的请求 ID；
4. 当服务器认为信息已充足时，返回最终结果。

```
클라이언트 ── tools/call (id:1) ─────────────▶ 서버
클라이언트 ◀─ input_required + requestState ── 서버   (요청 1은 여기서 끝)
   (사용자에게 물어봄)
클라이언트 ── tools/call (id:2) + 답 + requestState ▶ 서버
클라이언트 ◀─ 최종 결과 ───────────────────── 서버
```

核心在于服务器不保存中间状态。所需上下文通过 `requestState` 交由客户端管理，并在重试时收回。文档指出该值应被视为“可能被攻击者操纵的输入”。若其影响权限或业务逻辑，则必须使用 HMAC 或 AEAD 等方法保护完整性，验证失败时必须拒绝（MUST）。为防止重放攻击，建议将认证用户、短有效期及原始请求标识符等受保护的载荷嵌入其中（SHOULD）。

可触发反问的请求仅限于以下三种：`prompts/get`、`resources/read`、`tools/call`。可询问的内容包括 elicitation、sampling 或 roots 列表请求中的一种。

<details>
<summary>详细解析：inputRequests 与 inputResponses 的结构</summary>

文档中的示例如下：服务器返回的 `inputRequests` 是一个以服务器添加的名称为键的映射对象。

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "github_login": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Please provide your GitHub username",
        "requestedSchema": {
          "type": "object",
          "properties": { "name": { "type": "string" } },
          "required": ["name"]
        }
      }
    }
  },
  "requestState": "AEAD-protected blob"
}
```

客户端使用相同键填充答案并重新尝试请求。

```json
{
  "github_login": { "action": "accept", "content": { "name": "octocat" } }
}
```

如果客户端仅部分响应，服务器不应抛出错误，而应通过 `input_required` 要求补充缺失内容（SHOULD）。对于客户端未声明的能力（例如不支持 elicitation），服务器不得发起相关请求（MUST NOT）。

</details>

## 所有请求附加的 `_meta`

由于移除了初始化步骤，版本和能力现在需在每次请求中携带。

- **必需**：`io.modelcontextprotocol/protocolVersion`、`io.modelcontextprotocol/clientCapabilities`
- **推荐**：客户端应包含 `clientInfo`，服务器应在响应结果的 `_meta` 中包含 `serverInfo`
- 若版本不匹配，将返回 `UnsupportedProtocolVersionError`

日志级别也不再单独通过 `logging/setLevel` 设置，而是每次请求通过 `io.modelcontextprotocol/logLevel` 发送。对于未包含该值的请求，服务器不得发送 `notifications/message`。此外，`ping` 和 `notifications/roots/list_changed` 已被移除。

## 其他值得注意的小改动

- **缓存**：在 `tools/list`、`prompts/list`、`resources/list`、`resources/read`、`resources/templates/list` 的结果中，`ttlMs`（新鲜度提示，单位为毫秒）和 `cacheScope`（`public` / `private`）已成为必需字段。这表示客户端应缓存响应以减少轮询频率。
- **工具顺序**：服务器应始终以相同顺序返回 `tools/list`（SHOULD）。理由是支持客户端缓存和提高 LLM 提示词缓存命中率。由于工具列表会出现在提示词开头，若顺序改变，可能会导致 [提示词缓存](#/post/ai-prompt-caching) 失效。
- **头部字段**：在可流式传输的 HTTP POST 中，`Mcp-Method` 和 `Mcp-Name` 头部字段现已成为必需。这似乎是为了在不解析正文的情况下实现路由功能。
- **模式（Schema）**：工具的 `inputSchema` 和 `outputSchema` 现在可以使用 JSON Schema 2020-12 的所有关键字；而 `structuredContent` 可以是任意 JSON 值。
- **错误代码**：资源未找到的错误代码已从 `-32002` 更改为 `-32602`（Invalid Params）。MCP 专用错误代码已统一整理在 `-32020` ~ `-32099` 范围内。
- **追踪**：已在文档中规范了在 `_meta` 中包含 OpenTelemetry 的 `traceparent`、`tracestate` 和 `baggage` 的做法。
- **认证**：推荐在认证服务器的响应中包含 `iss` 参数（SHOULD），客户端若收到该参数则必须记录并与颁发者进行比对（MUST）。

## 已弃用内容及替代方案

“Deprecated"列表并非立即移除，而是计划在未来删除。新规范同时引入了至少 12 个月的废弃宽限期功能生命周期策略。状态分为 Active、Deprecated 和 Removed 三类，废弃功能将汇总至独立注册表中。

| 弃用项 | changelog 中提出的替代方案 |
|---|---|
| Roots | 通过工具参数、资源 URI 或服务器配置传递目录与文件信息 |
| Sampling | 直接集成 LLM 提供商 API |
| Logging | 若使用 stdio，则记录至 `stderr`；否则使用 OpenTelemetry |
| 动态客户端注册 (DCR, RFC 7591) | Client ID Metadata Documents。DCR 保留以支持不支持该功能的认证服务器 |
| HTTP+SSE 传输 | Streamable HTTP |

移除 Sampling 后，服务器将无法借用客户端的模型，服务器必须自行连接所需模型。这一变化对 MCP 服务器的设计提出了新要求。关于如何构建 MCP 服务器的详细流程，请参阅 [MCP 服务器构建指南 →](#/post/app-mcp-server)。

## 扩展框架

`ClientCapabilities` 和 `ServerCapabilities` 新增了 `extensions` 字段，使得可以在核心功能之外协商可选功能。任务（Tasks）是首个应用此机制的案例。我们重新设计了架构：将长时间运行的操作从核心移至扩展模块；不再使用阻塞等待的 `tasks/result`，而是改用轮询 `tasks/get` 以及客户端发送输入的 `tasks/update`。`tasks/list` 已被移除，服务器现在可在每次请求前无需获取许可即可先返回任务句柄。

## 这对 Agent 意味着什么

模型调用工具的流程保持不变（详见 → [工具调用](#/post/ai-tool-use)）。发生变化的是服务器与主机之间的连线：主机持有对话状态，而服务器对每个请求独立处理，因此其形态变得类似于我们在 [会话与对话记录](#/post/ai-session) 中看到的 LLM API。主机拦截工具调用并将其传递给服务器，再将结果重新插入对话，这一角色与 [Harness](#/post/ai-harness) 相同。不同之处在于，需要客户端（Harness）侧包含处理服务器反问情况的代码，即当收到 `input_required` 时，向用户提问并尝试重试的循环逻辑。

仅凭本文档无法断定现有服务器是否会立即崩溃。文档中规定：若旧版服务器的响应缺少 `resultType`，客户端应将其视为 `"complete"`（MUST），因此保留了一定的兼容路径。

## 参考链接

- 规范变更日志 (Key Changes): https://modelcontextprotocol.io/specification/2026-07-28/changelog
- 多轮次请求文档: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
- GitHub 发布版 2026-07-28: https://github.com/modelcontextprotocol/specification/releases/tag/2026-07-28

相关文章：[MCP](#/post/ai-mcp) · [工具调用](#/post/ai-tool-use) · [Harness](#/post/ai-harness)
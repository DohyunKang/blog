On July 28, 2026, a new stable revision of the MCP specification was released. Since the version name is based on the date, it is 2026-07-28. The GitHub release page contains only one line: "Stable release of this revision," while the changes are summarized in the changelog on the specification site. I have read and summarized that changelog (as of November 2, 2026). If you want to know what MCP is, please check [Details → MCP](#/post/ai-mcp) first.

## In a single sentence

The most significant difference from the previous version (2025-11-25) is that MCP has become a stateless protocol. The structure of maintaining connections and sessions has been removed, and each request can now be processed independently.

## Key changes among the nine major updates

There are nine items under "Major changes" in the changelog. I have selected only those necessary to understand the flow.

| What Changed | Description |
|---|---|
| Session removal | The `Mcp-Session-Id` header and protocol-level sessions in Streamable HTTP have been removed. Calls to `tools/list`, `resources/list`, and `prompts/list` no longer vary per connection. |
| Initialization removal | The handshake between `initialize` and `notifications/initialized` has been removed. Instead, every request now carries the protocol version and client capabilities in `_meta`. |
| `server/discover` | A new required call for servers to implement. It informs clients about supported versions, capabilities, and identity. |
| `subscriptions/listen` | A single long-lived notification stream that replaces the HTTP GET endpoint and `resources/subscribe`. |
| Resumption feature removal | SSE stream resumption (`Last-Event-ID`) has been removed. If a stream is interrupted, the request must be resent as a new request. |
| Task separation | The experimental `tasks` feature has been moved out of the core and is now an official extension (`io.modelcontextprotocol/tasks`). |
| MRTR | A new pattern replacing the previous approach where servers initiated requests to clients (explained below). |

The changelog also addresses how servers requiring state should behave: they are instructed to pass handles created directly by the server as regular tool arguments. The protocol itself does not hold state; if needed, the application must manage it via tool arguments.

## Why was it changed this way?

The changelog itself does not provide lengthy explanations for these reasons. However, the purpose of MRTR is stated in one line in its documentation: to allow servers to request additional information "without requiring shared storage between server instances or a load balancer to consistently route requests to the same server." All changes follow this direction. Since all necessary information is included with each request, any server instance can process it.

## MRTR: A new way for servers to ask questions

Previously, when a server executing tools needed to ask the user something (elicitation), it would send a reverse request to the client. This required the server to maintain that connection. The new version prohibits this (the documentation labels it a breaking change) and adopts the following flow instead:

1. The client sends a request such as `tools/call`.
2. If the server determines additional information is needed, it returns `resultType: "input_required"` in the result. This includes `inputRequests` (what to ask) and `requestState` (an opaque string known only to the server).
3. The client asks the user, collects the answer, and resends the same request with `inputResponses` and `requestState`. The request ID changes.
4. When the server deems the information sufficient, it returns the final result.

```
클라이언트 ── tools/call (id:1) ─────────────▶ 서버
클라이언트 ◀─ input_required + requestState ── 서버   (요청 1은 여기서 끝)
   (사용자에게 물어봄)
클라이언트 ── tools/call (id:2) + 답 + requestState ▶ 서버
클라이언트 ◀─ 최종 결과 ───────────────────── 서버
```

The core principle is that the server does not store intermediate state. Necessary context is passed to the client via `requestState` and returned upon retry. The documentation advises treating this value as "input that can be manipulated by an attacker." If it affects permissions or business logic, integrity must be protected using methods like HMAC or AEAD, and requests failing validation must be rejected (MUST). To prevent reuse, it is recommended to include the authenticated user, a short expiration time, and identifiers from the original request within a protected payload (SHOULD).

Requests that can be queried are limited to three: `prompts/get`, `resources/read`, and `tools/call`. The content of the query must be one of elicitation, sampling, or a roots list request.

<details>
<summary>Detailed explanation: shape of inputRequests and inputResponses</summary>

If we provide examples from the documentation, it looks like this. The `inputRequests` returned by the server is a map with keys being names assigned by the server.

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

The client fills in the answers using the same key and retries.

```json
{
  "github_login": { "action": "accept", "content": { "name": "octocat" } }
}
```

If the client responds partially, the server should not return an error but must request the missing information again using `input_required`. The server MUST NOT send requests for capabilities that the client has not declared (e.g., unsupported elicitation).

</details>

## `_meta` attached to every request

Since initialization is no longer required, version and capabilities are now included with each request.

- **Required**: `io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`
- **Recommended**: The client includes `clientInfo`, and the server includes `serverInfo` in the `_meta` of responses.
- If versions do not match, an `UnsupportedProtocolVersionError` is returned.

Log levels are no longer set separately via `logging/setLevel`; instead, they are sent with each request using `io.modelcontextprotocol/logLevel`. Servers MUST NOT send `notifications/message` for requests that lack this value. The `ping` and `notifications/roots/list_changed` methods have been removed.

## Notable small changes

- **Caching**: For results of `tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list`, both `ttlMs` (freshness hint in milliseconds) and `cacheScope` (`public` / `private`) are now required. This indicates that clients should cache responses to reduce polling.
- **Tool ordering**: Servers SHOULD return results from `tools/list` in a consistent order. The rationale involves client caching and LLM prompt cache hit rates. Since the tool list appears at the beginning of the prompt, changing the order would likely break [prompt caching](#/post/ai-prompt-caching).
- **Headers**: `Mcp-Method` and `Mcp-Name` headers are now required for Streamable HTTP POST requests. This appears to enable routing without reading the body.
- **Schemas**: All keywords from JSON Schema 2020-12 can be used in a tool's `inputSchema` and `outputSchema`, while `structuredContent` can be any JSON value.
- **Error codes**: The error code for "resource not found" has changed from `-32002` to `-32602` (Invalid Params). MCP-specific error codes are now consolidated in the range `-32020` to `-32099`.
- **Tracing**: It is now documented that `_meta` should include OpenTelemetry's `traceparent`, `tracestate`, and `baggage`.
- **Authentication**: It is recommended (SHOULD) for authentication servers to include an `iss` parameter in responses, and clients MUST record and verify the issuer if present.

## What is being deprecated and alternatives

The "Deprecated" list does not mean immediate removal; rather, these features are scheduled for removal. The new specification introduces a feature lifecycle policy with a minimum 12-month deprecation grace period. Features are categorized as Active, Deprecated, or Removed, and deprecated features are collected in a separate registry.

| Deprecated Feature | Alternative Proposed in Changelog |
|---|---|
| Roots | Pass directories and files via tool parameters, resource URIs, or server settings |
| Sampling | Directly integrate with the LLM provider's API |
| Logging | Log to `stderr` if using stdio, otherwise use OpenTelemetry |
| Dynamic Client Registration (DCR, RFC 7591) | Client ID Metadata Documents. DCR remains available for authentication servers that do not support this new method |
| HTTP+SSE transport | Streamable HTTP |

Without Sampling, the path for a server to borrow and use the client's model is blocked; the server must connect separately to any models it wishes to use. This change affects how MCP servers are designed. A detailed walkthrough of building one is available [here → Build an MCP Server](#/post/app-mcp-server).

## Extension Framework

The `extensions` field has been added to both `ClientCapabilities` and `ServerCapabilities`, allowing negotiation of optional features outside the core protocol. Tasks serve as the first example. The design has been reworked to move long-running operations from the core into extensions, replacing the blocking `tasks/result` with non-blocking polling via `tasks/get` and client input submission via `tasks/update`. The `tasks/list` method has been removed, and servers can now return task handles without requiring permission for each request.

## What this means for agents

The flow of the model invoking tools remains unchanged ([see details → Tool Use](#/post/ai-tool-use)). What changes is the connection line between the server and the host that has tools. Since the host maintains the conversation state while the server processes each request independently, it now resembles the shape of an LLM API as seen in [Sessions and Conversation History](#/post/ai-session). The role of the [Harness](#/post/ai-harness), where the host intercepts tool calls and forwards them to the server before reinserting the results back into the conversation, remains the same. However, a loop is needed on the client (harness) side to handle cases where the server asks follow-up questions; specifically, when receiving `input_required`, the code must prompt the user for input and retry.

It is difficult to determine from this document alone whether an existing server will immediately break. The document states that if a previous server's response lacks a `resultType`, the client should treat it as `"complete"` (MUST), leaving some compatibility paths open.

## Reference Links

- Specification changelog (Key Changes): https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Multi Round-Trip Requests document: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
- GitHub release 2026-07-28: https://github.com/modelcontextprotocol/specification/releases/tag/2026-07-28

Related posts: [MCP](#/post/ai-mcp) · [Tool Use](#/post/ai-tool-use) · [Harness](#/post/ai-harness)
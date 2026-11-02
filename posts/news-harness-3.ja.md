2026 年 7 月 28 日、MCP 仕様の新しい改訂版が安定版としてリリースされました。バージョン名は日付であるため「2026-07-28」となっています。GitHub リリースページには「この改訂版の安定リリース」という一行のみ記載されており、変更内容は仕様サイトの changelog にまとめられています。その changelog を読み整理しました（確認時点：2026 年 11 月 2 日）。MCP が何なのかを知りたい場合は、まず [詳細 → MCP](#/post/ai-mcp) をご覧ください。

## 一言で

前バージョン（2025-11-25）との最大の違いは、MCP がステートレスなプロトコルになったことです。接続を確立してセッションを維持する構造がなくなり、各リクエストがそれ単独で処理されるように変更されました。

## 9 つの主要変更の中核

changelog の「Major changes」には 9 つの項目があります。その中から流れを理解するために必要なものだけを抽出しました。

| 変更点 | 内容 |
|---|---|
| セッションの削除 | Streamable HTTP から `Mcp-Session-Id` ヘッダーとプロトコルレベルのセッションがなくなりました。`tools/list`, `resources/list`, `prompts/list` は接続ごとに異なりません |
| 初期化の削除 | `initialize` / `notifications/initialized` のハンドシェイクがなくなりました。代わりにすべてのリクエストで `_meta` にプロトコルバージョンとクライアント能力を記載します |
| `server/discover` | サーバーが必ず実装すべき新しい呼び出し。サポートするバージョン・能力・身元を知らせます |
| `subscriptions/listen` | HTTP GET エンドポイントおよび `resources/subscribe` の代わりとなる、長時間開いておく通知ストリーム 1 つです |
| 再開機能の削除 | SSE ストリームの再開（`Last-Event-ID`）がなくなりました。ストリームが途切れた場合はそのリクエストを新しいリクエストとして再度送信する必要があります |
| タスクの分離 | 実験的な機能だった tasks がコアから外れ、公式拡張（`io.modelcontextprotocol/tasks`）となりました |
| MRTR | サーバーが最初にクライアントに要求する方式を置き換える新しいパターン（後述） |

セッションではなく状態が必要なサーバーについてはどうするかについても記載されています。サーバー自身が作成したハンドルを通常のツール引数としてやり取りさせる、ということです。プロトコル自体は状態を持たず、必要であればアプリ側でツール引数として用意します。

## なぜこんな変更か

changelog 自体には理由の説明が長く書かれていません。ただし MRTR ドキュメントには目的が一行あります。サーバーが追加情報を要求する作業を、「サーバーインスタンス間で共有ストレージを持つ必要がない」あるいは「ロードバランサーが同じサーバーに継続的に送らなくても」処理できるようにするというものです。変更項目はすべてこの方向性です。各リクエストに必要な情報が含まれているため、どのサーバーインスタンスが受け取っても処理可能です。

## MRTR：サーバーが再質問する新しい方式

以前はツールを実行していたサーバーが途中でユーザーに何かを尋ねる必要がある場合（elicitation）には、クライアントに対して逆方向の要求を送信していました。この方式ではサーバーはその接続を継続して保持しておく必要があります。新版はこの点を禁止し（ドキュメントで breaking change と明記）、次の流れに変更しました。

1. クライアントが `tools/call` などのリクエストを送信します。
2. サーバーが追加情報が必要だと判断すると、結果として `resultType: "input_required"` を返します。これには `inputRequests`（尋ねる内容）と `requestState`（サーバーだけが知る不透明な文字列）が含まれます。
3. クライアントはユーザーに尋ねて回答を収集した後、同じリクエストを `inputResponses` と `requestState` を付加して再度送信します。リクエスト ID は新しく変更されます。
4. サーバーが十分だと判断すると最終結果を返します。

```
클라이언트 ── tools/call (id:1) ─────────────▶ 서버
클라이언트 ◀─ input_required + requestState ── 서버   (요청 1은 여기서 끝)
   (사용자에게 물어봄)
클라이언트 ── tools/call (id:2) + 답 + requestState ▶ 서버
클라이언트 ◀─ 최종 결과 ───────────────────── 서버
```

核心はサーバーが中間状態を保存しない点です。必要な文脈は `requestState` に格納してクライアントに委ね、再試行時に受け取ります。ドキュメントはこの値を「攻撃者が操作可能な入力」として扱うよう指示しています。権限やビジネスロジックに影響を与える場合は HMAC や AEAD などの方法で整合性を保護し、検証に失敗した場合は拒否する必要があります（MUST）。再利用を防ぐためには、認証されたユーザー、短い有効期限、元のリクエストの識別子が保護されたペイロード内に含めるよう推奨されています（SHOULD）。

この方式で尋ねられることができるリクエストは `prompts/get`, `resources/read`, `tools/call` の 3 つに限定されています。尋ねられる内容は elicitation、sampling、roots リスト要求のいずれかです。

<details>
<summary>詳細な解説：inputRequests と inputResponses の形式</summary>

ドキュメントの例を挙げると以下のようになります。サーバーが返す `inputRequests` は、サーバーが付けた名前をキーとするマップです。

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

クライアントは同じキーで回答を埋めて再試行します。

```json
{
  "github_login": { "action": "accept", "content": { "name": "octocat" } }
}
```

If the client responds partially, the server must not return an error but should request the missing information again using `input_required`. The server MUST NOT send requests for capabilities that the client has not declared (e.g., unsupported elicitation).

</details>

## `_meta` attached to all requests

Since initialization is no longer required, version and capabilities are now included in every request.

- **Required**: `io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`
- **Recommended**: The client includes `clientInfo`, and the server includes `serverInfo` in the `_meta` of responses.
- If versions do not match, an `UnsupportedProtocolVersionError` is returned.

Logging levels are no longer set separately via `logging/setLevel`; instead, they are sent per request using `io.modelcontextprotocol/logLevel`. Servers MUST NOT send `notifications/message` for requests that lack this value. The `ping` and `notifications/roots/list_changed` have been removed.

## Notable small changes

- **Caching**: For results of `tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list`, both `ttlMs` (freshness hint in milliseconds) and `cacheScope` (`public` / `private`) are now required. This indicates that clients should cache responses to reduce polling.
- **Tool ordering**: Servers SHOULD return results from `tools/list` in the same order every time. The rationale is to improve client caching and LLM prompt cache hit rates. Since tool lists appear at the beginning of prompts, changing their order would break [prompt caching](#/post/ai-prompt-caching).
- **Headers**: For streamable HTTP POST requests, headers `Mcp-Method` and `Mcp-Name` are now required. This appears to enable routing without reading the body.
- **Schema**: All keywords from JSON Schema 2020-12 can be used in a tool's `inputSchema` and `outputSchema`, while `structuredContent` can be any JSON value.
- **Error codes**: The error code for "resource not found" has changed from `-32002` to `-32602` (Invalid Params). MCP-specific error codes are now consolidated in the range `-32020` to `-32099`.
- **Tracing**: It is documented that `_meta` should include OpenTelemetry fields `traceparent`, `tracestate`, and `baggage`.
- **Authentication**: It is recommended (SHOULD) for authentication servers to include an `iss` parameter in responses, and clients MUST record and verify the issuer if present.

## What is being deprecated and alternatives

The "Deprecated" list does not mean immediate removal; rather, these features are scheduled for deprecation. The new specification introduces a feature lifecycle policy with a minimum 12-month deprecation grace period. States are now Active, Deprecated, and Removed, and deprecated features are collected in a separate registry.

| Deprecated Item | Alternative Proposed in Changelog |
|---|---|
| Roots | Pass directories/files as tool parameters, resource URIs, or server settings |
| Sampling | Directly integrate with LLM provider APIs |
| Logging | Log to `stderr` for stdio, otherwise use OpenTelemetry |
| Dynamic Client Registration (DCR, RFC 7591) | Client ID Metadata Documents. DCR remains available for authentication servers that do not support this new method |
| HTTP+SSE transport | Streamable HTTP |

Without Sampling, the path for servers to borrow and use client models is blocked; servers must now connect separately to the models they wish to use. This change affects how MCP servers are designed. A separate guide on [building an MCP server](#/post/app-mcp-server) covers the updated workflow for those building one directly.

## Extension Framework

New `extensions` fields have been added to `ClientCapabilities` and `ServerCapabilities`, allowing negotiation of optional features outside the core. Tasks are the first example of this. The design has been reworked to move long-running operations out of the core into extensions, replacing the blocking `tasks/result` with polling via `tasks/get` and client-input-driven updates via `tasks/update`. The `tasks/list` endpoint has been removed, and servers can now return task handles without requiring permission per request.

## Implications for Agents

モデルがツールを呼び出すフローはそのままである（[詳細 → ツール呼び出し](#/post/ai-tool-use)）。変わるのは、ツールがあるサーバーとホストをつなぐ線だけだ。ホストが対話状態を持ち、サーバーは各リクエストごとに独立して処理するため、[セッションと対話履歴](#/post/ai-session) で見た LLM API の形状に似てきた。ホストがツール呼び出しを介捉してサーバーへ渡し、結果を再び対話に戻す [ハネス](#/post/ai-harness) の役割は同じだ。ただし、サーバーが再質問するケースに対応するコード、つまり `input_required` を受け取った際にユーザーに問いかけ、再試行するループはクライアント（ハネス）側に必要となる。

既存のサーバーが即座に壊れるかどうかについては、この記事で扱われているドキュメントだけでは言い切れない。ドキュメントでは、以前のサーバーの結果に `resultType` がなければ、クライアントが `"complete"` と扱うように指示しているため（MUST）、一部の互換経路を設けている。

## 根拠リンク

- 仕様 changelog(Key Changes): https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Multi Round-Trip Requests ドキュメント: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
- GitHub リリース 2026-07-28: https://github.com/modelcontextprotocol/specification/releases/tag/2026-07-28

関連記事：[MCP](#/post/ai-mcp) · [ツール呼び出し](#/post/ai-tool-use) · [ハネス](#/post/ai-harness)
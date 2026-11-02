MCP サーバーとは、関数名と説明を付けて外部に公開するプログラムです。公式チュートリアルも天候照会ツールの 2 つを含むサーバーを作成しています。仕様自体は [MCP](#/post/ai-mcp) の記事で整理されているので、ここでは実際に作成して動作確認した手順のみ記載します。

## サーバーが果たす役割

サーバーから公開できるのは 3 つです。リソース（ファイルのように読み取るデータ）、ツール（モデルが呼び出す関数）、プロンプト（事前に用意したテンプレート）。公式チュートリアルはこれらの中でツールを中心に扱っています。本記事もツールのみを作成します。

ツールが呼び出されるフローは、チュートリアルの説明を基準にすると以下の通りです。

| 手順 | 起こる事象 |
| --- | --- |
| 1 | クライアントがユーザーの質問をモデルに送信する |
| 2 | モデルが利用可能なツールリストを確認し、何を実行するか決定する |
| 3 | クライアントが MCP サーバーにツール呼び出しを送信する |
| 4 | サーバーが関数を実行し、結果を返す |
| 5 | 結果がモデルに入力され、モデルが文章で回答する |

サーバーはモデルと直接対話するわけではありません。モデルの前には常にクライアントが存在し、サーバーは `tools/list`(リストをください) と `tools/call`(これを実行してください) の 2 つのリクエストに応じるだけで済みます。モデルがツールを選ぶ仕組みについては [ツール呼び出し](#/post/ai-tool-use) の記事にあります。

## 実際に作成した内容

メモの保存と検索を行うサーバーです。ツールは 2 つあり、ストレージは単なる辞書です。意図的に外部 API を使用せずに作成しました。ネットワークの問題なく、サーバー構造のみを確認したいと考えたためです。

環境構築は公式チュートリアルに従い、`uv` でプロジェクトを作成し、`mcp[cli]` をインストールする方式です。ドキュメントでは Python 3.10 以上と MCP Python SDK 2.0.0 以上を要求しています。私は venv に pip でインストールし、2.3.0 が設置されました。

```python
# notes_server.py
import logging
from mcp.server import MCPServer

logging.basicConfig(level=logging.INFO)  # 로그는 stderr로 나간다
log = logging.getLogger(__name__)

mcp = MCPServer("notes")
NOTES: dict[str, str] = {}

@mcp.tool()
def add_note(title: str, body: str) -> str:
    """메모를 저장한다. 같은 제목이 있으면 덮어쓴다."""
    NOTES[title] = body
    log.info("saved %s", title)
    return f"저장함: {title}"

@mcp.tool()
def search_notes(keyword: str) -> list[str]:
    """제목이나 본문에 keyword가 들어간 메모의 제목 목록을 돌려준다."""
    return [t for t, b in NOTES.items() if keyword in t or keyword in b]

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

コードはこれだけです。チュートリアルの説明によると、`MCPServer` は Python の型ヒントと docstring を用いてツール定義を自動的に生成します。そのため、関数の引数名とタイプが入力スキーマとなり、docstring がツール説明になります。別途 JSON スキーマを使用しません。

モデルがツールを選ぶ際に参照するのは結局名前、説明、引数だけです。docstring を大雑把に書けばツールも大雑把に選ばれることになります。サーバーコードで最も重要な行はここだと感じました。

## 実行と確認

`mcp.run(transport="stdio")` はサーバーを標準入出力で起動します。直接実行すると何も出力せず、入力のみを待ち続けます。クライアントがこのプロセスを起動し、stdin/stdout を介して JSON-RPC メッセージのやり取りを行う構造です。

したがって、stdout に `print()` を使用することはできません。チュートリアルの警告通り、stdout に書き込むと JSON-RPC メッセージが破損し、サーバーが壊れてしまいます。ログには標準の `logging` を使用し、stderr に出力します。上記コードの `logging.basicConfig` はデフォルトで stderr へ出力します。HTTP 方式のサーバーは stdout ログの使用も可能だとのことです。

テストは 2 つあります。

第一に、SDK クライアントを介して直接呼び出す Python スクリプトです。サーバーを子プロセスとして起動し、リスト取得とツール呼び出しを実行しました。

```python
# client_test.py
import asyncio, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command=sys.executable, args=["notes_server.py"])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
            for t in tools.tools:
                print(t.name, "|", t.description)
            print(await s.call_tool("add_note", {"title": "mcp", "body": "서버 만들기 공부"}))
            print(await s.call_tool("search_notes", {"keyword": "공부"}))

asyncio.run(main())
```

実行すると、説明付きで 2 つのツールが表示され、`add_note` は "保存済み：mcp" を、`search_notes("勉強")` は `['mcp']` を返しました。入力スキーマも引数名と `required` がそのまま含まれていました。テスト自動化はこの方式が便利です。テストに関する一般論は [テスト](#/post/be-testing) の記事にあります。

第二に、MCP Inspector です。公式開発ツールであり、`npx @modelcontextprotocol/inspector <サーバー実行コマンド>` で起動します。Web インターフェースからツールを選択し、引数を入力して呼び出し、やり取りする JSON-RPC メッセージを確認できます。ドキュメントによると Node 22.19.0 以上が必要で、ブラウザなしで使用できる `--cli`、`--tui` モードもあります。デバッグガイドでは、サーバーが起動しない場合に Inspector で単独テストを行うことを第一手段としています。

## Claude Desktop との接続

クライアントにサーバーを知らせるには設定ファイルを使用します。Claude Desktop は `claude_desktop_config.json` の `mcpServers` キーにサーバーを記述します。Windows におけるファイルの場所は `%AppData%\Claude\claude_desktop_config.json` です。チュートリアルの例を自分のファイル名に合わせて変更すると以下のようになります。

```json
{
  "mcpServers": {
    "notes": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\ABSOLUTE\\PATH\\TO\\notes",
        "run",
        "notes_server.py"
      ]
    }
  }
}
```

パスは必ず絶対パスで記述してください。デバッグドキュメントによると、クライアントがサーバーを起動する際に作業ディレクトリが決まっていない場合があり、相対パスが壊れてしまいます。保存し、Claude Desktop を完全に終了してから再度起動することで反映されます。ウィンドウだけを閉じるだけでは不十分です。起動すると入力欄のコンネクターメニューにサーバーが表示されます。表示されない場合はログ（`%AppData%\Claude\logs` の `mcp*.log`）を確認してください。

## エラーはどうやって返すか

ツールが失敗した際に、モデルがその理由を読み込んで修正し、再度試行させることが目標です。仕様ではエラーを 2 つに分類しています。ツール名がないや形式が壊れたリクエストなどのプロトコルエラーは JSON-RPC エラーとして返します。API の失敗、入力値の誤り、ロジックエラーなどのツール実行エラーについては、結果に `isError: true` を付与して返し、クライアントはこの情報をモデルに渡して自ら修正するよう推奨しています。

SDK で実際にどう見えるか確認しました。メモがない場合に通常の `ValueError` を投げるツールを作成して呼び出したところ、`is_error=True` にはなりましたが、メッセージは "Error executing tool get_note" のみでした。私が記述した理由がモデルに伝わりません。SDK ソースの docstring を見ると、想定される失敗は `ToolError` を投げろと書かれていました。変更して実行しました。

```python
from mcp.server.mcpserver.exceptions import ToolError

@mcp.tool()
def get_note(title: str) -> str:
    """제목으로 메모를 읽는다."""
    raise ToolError(f"'{title}' 메모가 없다. search_notes로 먼저 찾아 봐라.")
```

結果 content は "Error executing tool get_note: '없는거' メモがありません。search_notes でまず検索してください。" として返ってきました。エラーメッセージに次に何をすべきかも記載しておけば、モデルはそのまま従うことができます。想定していない例外はクラッシュとして扱われ、モデルには名前だけが渡され、サーバーログにはトレースバックが残ります。

## 作成時に注意すること

- ツール名は仕様に従って 1〜128 文字とし、英大文字・小文字・数字・アンダースコア・ハイフン・ピリオドのみを使用することを推奨します。空白やコンマは避けてください。
- サーバーに状態を保持したい場合は、仕様ではハンドル（ハンドラー）の使用が推奨されています。MCP にはプロトコルレベルのセッションがないため、カートのような状態は、ツールが ID を返し、以降の呼び出しはその ID を引数として受け取るような仕組みで管理します。私のメモサーバーは単一のグローバル辞書なのでこの方式ではありません。あくまで練習用だからです。
- 入力検証はサーバー側で行います。仕様のサーバーセキュリティ項目には入力検証、アクセス制御、呼び出し速度制限、出力の整理が含まれています。
- ユーザーが拒否できる必要があります。仕様ではツール呼び出しの前にユーザーが承認または拒否する段階があるべきだと記載されています。これはクライアントが守るべき部分ですが、サーバー側でも削除や送信など危険なツールは慎重に公開する必要があります。ツール結果に含まれる指示文の問題については [プロンプトインジェクション](#/post/sec-prompt-injection) の記事で扱っています。
- 外部サービスキーが必要なサーバーは設定ファイルの `env` を通して渡すことになりますが、キー管理は [シークレット管理](#/post/cloud-secrets) と同様の問題です。

## よくある誤解

- サーバーがモデルを呼び出す：サーバーはリクエストに応答するだけです。モデルと話すのはクライアントです。
- サーバーコードで `print` でデバッグすればよい：stdio サーバーでは `print` がプロトコルを壊します。stderr ログを使用してください。
- コードを変更すれば即座に反映される：Claude Desktop は完全に終了して再起動する必要があります。
- エラーは例外を投げれば自動的に伝播する：通常の例外では理由が隠されます。想定される失敗については `ToolError` で理由を記述します。この動作は私が書いた SDK 2.3.0 で確認したものです。

← [概念マップへ](#/post/app-map)

関連記事: [MCP](#/post/ai-mcp) · [ツール呼び出し](#/post/ai-tool-use) · [エージェント設計](#/post/app-agent-design)

## 根拠リンク

- Build an MCP server（公式チュートリアル）: https://modelcontextprotocol.io/docs/develop/build-server
- MCP Inspector: https://modelcontextprotocol.io/docs/tools/inspector
- デバッグ: https://modelcontextprotocol.io/docs/tools/debugging
- 仕様、ツール: https://modelcontextprotocol.io/specification/latest/server/tools
- 実際に実行した SDK: PyPI の mcp 2.3.0（ソースの ToolError docstring も含む）
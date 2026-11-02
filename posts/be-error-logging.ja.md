バックエンドでは、エラーを「なくす」のではなく、「誰が知る必要があるエラーか」によって処理を分けることが重要であり、その分け方の結果としてエラーレスポンスとログが生まれます。

## エラー処理とは何か

サーバーは 1 つの要求が入ってくると、入力検証、DB 照会、外部 API 呼び出しなどを順次実行します。どの段階でも失敗する可能性があります。エラー処理とは、失敗した際にサーバーがどのように振る舞うかを事前に決めることです。主に以下の 3 つを定めます。

- 呼び出し元に何を返すか（エラーレスポンス）
- もう一度試すか、諦めるか（リトライ）
- 後で原因を探れるように何を残すか（ロギング）

要求がサーバーをどのような経路で通過するかは、[詳細 → 要求の処理フロー](#/post/be-request-flow) に別途記載しています。エラーはどこかの道筋から飛び出すものだと考えればよいでしょう。

## 例外を分類する基準

すべてのエラーを単一の `Exception` でスローすると、上位で区別する方法がありません。そのため種類に分けます。私が使いやすいと感じた基準は 2 つあります。

| 基準 | 例 | 通常処理 |
|---|---|---|
| クライアント側の問題 | 入力形式の誤り、存在しないリソース、権限不足 | 4xx でレスポンス、リトライしても意味がない |
| サーバー・外部の問題 | DB 接続切断、外部 API タイムアウト、バグ | 5xx でレスポンス、一時的ならリトライ可能 |

ここに「リトライしてもよいエラーか」を例外クラスの属性として付与しておくと便利です。以下のコードがその形です。エラーの種類ごとに HTTP ステータスコード、機械が読み取るための文字列コード、リトライ可否を持っています。

```python
class AppError(Exception):
    status = 500; code = "internal_error"; retryable = False
class NotFound(AppError):
    status = 404; code = "order_not_found"
class Upstream(AppError):
    status = 502; code = "upstream_failed"; retryable = True
```

例外は発生した場所でそのまま飲み込むのではなく、処理可能な階層まで上げて渡すのが基本です。値がない場合に `None` を返してエラーを隠蔽すると、後で予期せぬ場所で爆発して原因が分かりにくくなります。階層分けの話は [詳細 → 階層型構造](#/post/be-layered-architecture) と続きます。通常、最外側（要求を受け付ける層）で一度キャッチしてレスポンスに変換し、内側の層では意味のある例外だけをスローします。

## エラーレスポンスの規約

エラーレスポンスの形式がサービスごと、あるいはエンドポイントごとに異なると、呼び出し元が一つずつ合わせる必要があります。そのため規約を定めます。

標準もあります。RFC 9457(Problem Details for HTTP APIs) は、エラーを `application/problem+json` JSON オブジェクトで返す方式を定義しています。メンバは 5 つです。

| メンバー | 意味 |
|---|---|
| type | 問題の種類を示す URI。なければ `about:blank` |
| title | 問題種類の短い説明。同じ種類なら毎回同じもの |
| status | サーバーが返した HTTP ステータスコード。レスポンスの実際のコードと一致させるべき |
| detail | 今回の件についての説明。クライアントが修正する際に役立つ内容 |
| instance | 今回の発生件を示す識別子 |

文書で目についた点はいくつかありました。未知の拡張メンバはクライアントが無視すべきです。`detail` 文字列は人間が読むためのものなので、クライアントがそれをパースしないように指示されています。機械が読み取る情報は拡張メンバに入れるべきという意味です。そして `status` メンバと実際の HTTP ステータスコードが食い違う場合（中間機器で変更された場合など）は、実際の HTTP ステータスコードを信頼するよう指示されています。

私が上記の例外クラスで作成したレスポンスはこの形でした。

```json
{"type": "https://example.com/errors/order_not_found", "title": "order_not_found", "status": 404, "detail": "order 7 not found"}
```

レスポンスにはスタックトレースや DB クエリなどの内部情報を含まない。それはログに残すのみです。ステータスコードを選ぶ方法は [詳細 → REST API](#/post/be-api-rest) と重複します。

## リトライとタイムアウト

外部 API は時々遅くなったり失敗したりします。この時に再度試みるのがリトライです。しかし無条件に行うと状況が悪化する可能性があります。AWS Builders' Library の記事の要点は以下の通りでした。

- 遠隔呼び出しには常にタイムアウトを設定する。長すぎるとリソースを占有して待機し、短すぎると不要なリトライトラフィックが増える。
- リトライは一時的な失敗には有効だが、サーバーにとっては負担となる。過負荷状態でリトライが集中すると回復が遅れる。
- 呼び出し階層ごとにリトライすると乗算される。記事では階層が積もると DB の負荷が 243 倍に増えるという例がある。
- そのため、リトライは間隔を徐々に長くし（指数バックオフ）、回数にも上限を設ける。
- 間隔が同じだと失敗したクライアントが同じ時刻に再び集中するため、ランダム値（ジッター）を混ぜて分散させる。
- 副作用のある呼び出しは、冪等な場合のみリトライしても安全である。読み取り操作は概して冪等であり、作成 API はそうではない可能性がある。

例外に `retryable` を付けた理由は、ここで出てきます。404 エラーを 3 回再試行しても同じ 404 です。一方、決済生成のような冪等性のない呼び出しをそのまま再試行すると、2 回決済されてしまう可能性があります。冪等性とワーカー側の再試行については [詳細 → 非同期処理とメッセージキュー](#/post/be-async-queue) を続きとしてご覧ください。リクエストが多すぎてサーバーが拒否する場合は [詳細 → レート制限](#/post/infra-rate-limit) を参照してください。

再試行コードは以下の通りです。各試行ごとに待機上限を 2 倍にし、0 からその上限の間にランダムに選択する方式です（AWS の記事で説明されている方式を簡略化したもので、記事内のコードとは異なります）。

```python
def retry(fn, tries=4, base=0.01, cap=0.1):
    for i in range(tries):
        try:
            return fn()
        except AppError as e:
            if not e.retryable or i == tries - 1:
                raise
            wait = random.uniform(0, min(cap, base * 2 ** i))
            log.warning("retry", extra={"attempt": i + 1, "wait": round(wait, 3), "code": e.code})
            time.sleep(wait)
```

3 回目の呼び出しで成功するようにした偽関数を実行すると、再試行警告ログが 2 行出力され `ok` が返ってきました。再試行不可な `NotFound` は 1 回だけで発生しました。

## 構造化ログ

ログを人が読む文章のままで残すと、後で検索しづらくなります。「注文 7 番の照会失敗、ユーザー 12」のような内容を正規表現で抽出する必要があります。構造化ログとは、1 行を JSON のようなキー・バリュー形式で残す方式です。

```json
{"level": "WARNING", "msg": "retry", "request_id": "req-123", "attempt": 1, "wait": 0.004, "code": "upstream_failed"}
```

これにより `request_id` で 1 つのリクエストのログをすべて集め、`code` ごとにカウントし、`level` でフィルタリングするのが容易になります。リクエストごとに ID を付けて複数のログを束ねる習慣は特に有用でした。Python では `contextvars` に ID を入れておき、フォーマッターが各行に付与するようにしました。フォーマッター全体は折りたたみに含めました。

ログレベルは概ね以下のように分類します。

| レベル | 使用タイミング |
|---|---|
| DEBUG | 開発中の詳細な値 |
| INFO | 正常フローの大きなマイルストーン |
| WARNING | 問題はあるが処理済み（再試行など） |
| ERROR | リクエストに失敗した |

同じエラーを階層ごとにログに残すと、1 つのエラーが複数行出力されてカウントしづらくなります。一度だけ、通常は最外側でキャッチする際に残す方が清潔でした。パスワード・トークン・API キーはログに残しません。キーの扱いについては [詳細 → キー管理](#/post/sec-keys) を参照してください。ログを集めてアラートまで出すのは [詳細 → 観測可能性](#/post/cloud-observability) と続きます。

## よくある誤解

- エラーを隠すと安定する：隠されたエラーは、他でより見つけにくい形になります。
- 失敗したらとりあえず再試行：再試行不可なエラーは無駄であり、冪等性のない呼び出しは事故となります。過負荷時にはサーバーをさらに苦しめます。
- すべてを ERROR で残す：処理済みの問題まで ERROR にすると、真の障害が埋もれてしまいます。
- エラーメッセージは詳細なほど良い：ユーザーに見える応答に内部情報が漏れるとセキュリティ問題になります。詳細はログだけに留めます。
- ログは後から必要なら付け足せばよい：障害は通常、ログを入れない場所で発生します。リクエスト ID とエラーコード程度は最初から入れておくのが良いでしょう。

<details>
<summary>詳細な解説：構造化ログフォーマッターの全体コード</summary>

標準ライブラリの `logging` のみを使用しました。`extra=` で渡したキーはレコード属性として付加されるため、基本属性を除いた残りを JSON に含めます。

```python
import json, logging, contextvars

request_id = contextvars.ContextVar("request_id", default="-")

class JsonFormatter(logging.Formatter):
    _SKIP = set(vars(logging.makeLogRecord({}))) | {"message", "asctime"}
    def format(self, r):
        d = {"level": r.levelname, "msg": r.getMessage(), "request_id": request_id.get()}
        d.update({k: v for k, v in r.__dict__.items() if k not in self._SKIP})
        if r.exc_info:
            d["exc"] = self.formatException(r.exc_info)
        return json.dumps(d, ensure_ascii=False, default=str)

h = logging.StreamHandler(); h.setFormatter(JsonFormatter())
log = logging.getLogger("app"); log.addHandler(h); log.setLevel(logging.INFO)

log.error("request failed", extra={"code": "order_not_found", "status": 404})
```

`exc_info` があれば（`log.exception` で記録する場合）スタックトレースも 1 つのフィールドとして入ります。Web フレームワークではリクエストの進入地点で `request_id.set(...)` を一度行うと、以降のログに自動的に付加されます。

</details>

<details>
<summary>詳細な解説：実行して確認した内容</summary>

上記例外クラス、`retry`、フォーマッター、問題のある応答変換コードを組み合わせ、Python で直接実行しました。3 回目の呼び出しで成功する偽関数は再試行警告 2 行の後に `ok` を返し、`NotFound` は再試行なしで ERROR ログ 1 行と問題のある応答 JSON を返しました。ジッター値は実行ごとに異なります。

</details>

## 参照リンク

- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457.html
- AWS Builders' Library, Timeouts, retries, and backoff with jitter: https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter
- （一部のみ参照）Python Logging Cookbook: https://docs.python.org/3/howto/logging-cookbook.html
- RFC 9110, HTTP Semantics: https://www.rfc-editor.org/rfc/rfc9110.html

← [概念マップへ](#/post/be-map)

関連記事：[リクエストの処理フロー](#/post/be-request-flow) · [非同期処理とメッセージキュー](#/post/be-async-queue) · [観測可能性](#/post/cloud-observability)
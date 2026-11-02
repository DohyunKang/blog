一つのリクエストはクライアントから送信され、サーバーのフレームワークがミドルウェアチェーンを順に処理し、次にルートャーが適切なハンドラを選択し、ハンドラがデータベースを介して生成したレスポンスが同じ経路を逆方向にたどり帰ってきます。

## まず簡単な言葉で

レストランの注文に例えると理解しやすいです。お客様（クライアント）が注文書（リクエスト）を出します。入り口のスタッフが待機リストに名前を書き込み（ロギング）、予約済みのお客様か確認し（認証）、メニューを見てどの厨房担当者に渡すべきか決めます（ルーティング）。担当者が倉庫（DB）を探して料理を作り、皿（レスポンス）がホールに出ます。

バックエンドのコードはこの中間プロセスを実装します。ブラウザはリクエストを送るだけ、レスポンスを受けるだけなので、中間部分は見えません。

## リクエストとレスポンスの形状

HTTP リクエストはメソッド（GET, POST など）、リソースパス、プロトコルバージョン、オプションヘッダー、オプションボディで構成されています。レスポンスはプロトコルバージョン、ステータスコードと短いメッセージ、ヘッダー、オプションボディです。MDN の例を以下に示します。

```http
GET /users/1 HTTP/1.1
Host: example.com

HTTP/1.1 200 OK
Content-Type: application/json
```

アドレスバーに URL を入力すると、ブラウザが TCP 接続を開いたり、既存の接続を再利用したりして、上記のようなリクエストを送信します。レスポンスが HTML の場合、ブラウザがパースしながらそこに記述されたスクリプト・CSS・画像を再度リクエストします。一度 Enter キーを押したのにサーバーに複数のリクエストが行く理由はここにあります。画面が描画される側については [ブラウザによる画面描画のプロセス → レンダリング](#/post/fe-browser-render) で別途見ています。

クライアントとサーバーの間にはプロキシが入り込むこともあります。MDN は、プロキシはキャッシュ、フィルタリング、ロードバランシング、認証、ロギングを行うことができると述べています。サーバーの最前面にこれらがどれほど並んでいるかは [リクエストがサーバーに到達するまでの旅 → 旅程](#/post/infra-request-journey) で扱っています。

## サーバー内部で

サーバープロセスにリクエストが到着すると、フレームワーク（Express, FastAPI, Spring など）が受け取り、リクエストオブジェクトとレスポンスオブジェクトに変換します。その後の順序は大体以下の通りです。

| 段階 | 行うこと | 例 |
|---|---|---|
| ミドルウェア | すべての（または一部の）リクエストが通る共通処理 | ロギング、認証、JSON パース、CORS |
| ルーティング | メソッドとパスでハンドラを選択 | `GET /users/:id` |
| ハンドラ | 実際のビジネスロジック | ユーザーの取得 |
| データアクセス | DB・キャッシュ・外部 API の呼び出し | SQL 実行 |
| レスポンス | ステータスコード・ヘッダー・ボディの作成 | `200` + JSON |
| エラー処理 | どこで発生した例外もレスポンスに集約する | `500` |

パス内の `:id` のような部分はプレースホルダーであり、ルートャーが実際の値を抽出してハンドラに渡します。API パスをどのように設計するかは [REST API](#/post/be-api-rest) にあります。

## ミドルウェアはチェーンにする

Express ドキュメントの定義によれば、ミドルウェアはリクエスト (`req`)、レスポンス (`res`)、次のミドルウェア (`next`) にアクセスできる関数です。コードを実行したり、req と res を変更したり、リクエスト - レスポンスサイクルを終了したり、次の処理に渡すことができます。レスポンスを完了させない場合、必ず `next()` を呼び出す必要があり、呼び出さないとリクエストがただ止まってしまいます。

そして定義された順序で実行されます。同じパスのハンドラも順にチェックされ、先にレスポンスを送信した場合は後のものは実行されません。そのため認証ミドルウェアはルートより前に置きます。順序を間違えると認証なしで通過できるパスできてしまいます。

種類は Express を基準にすると、アプリ全体に付くもの、ルーターに付くもの、エラー処理用（引数が `(err, req, res, next)` の 4 つ）、内蔵 (`express.json` など)、サードパーティに分けられます。エラー処理ミドルウェアは 4 つの引数をすべて宣言する必要があり、使わない `next` も記述する必要があります。そうでないと一般ミドルウェアとして扱われ、エラーが発生しないとドキュメントに書かれています。

この構造は玉ねぎの皮のように考えると分かりやすいです。リクエストは外側の皮から内側へ入り、レスポンスは内側から外側へ出ます。ロギングミドルウェアが「入る時に 1 行、出る時に 1 行」を残せる理由はここにあります。

## 実際に動かしてみたミニフレームワーク

概念だけ読むと漠然としてしまうので、Python の標準ライブラリだけでルーティングとミドルウェアチェーンを模倣してみました。実際のフレームワークははるかに複雑ですが、骨格は同じです。

<details>
<summary>コード（実行確認済み）</summary>

```python
import re

class App:
    def __init__(self):
        self.middlewares = []
        self.routes = []          # (method, regex, handler)

    def use(self, fn):
        self.middlewares.append(fn)

    def route(self, method, path):
        regex = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", path) + "$")
        def deco(fn):
            self.routes.append((method, regex, fn))
            return fn
        return deco

    def handle(self, method, path, body=None):
        req = {"method": method, "path": path, "body": body, "params": {}}

        def dispatch(req):
            for m, rx, fn in self.routes:
                hit = rx.match(req["path"])
                if m == req["method"] and hit:
                    req["params"] = hit.groupdict()
                    return fn(req)
            return {"status": 404, "body": "not found"}

        chain = dispatch
        for mw in reversed(self.middlewares):
            chain = (lambda mw, nxt: lambda r: mw(r, nxt))(mw, chain)
        try:
            return chain(req)
        except Exception as e:
            return {"status": 500, "body": f"error: {e}"}

app = App()
DB = {"1": "kim", "2": "lee"}
log = []

def logger(req, nxt):
    log.append(f"-> {req['method']} {req['path']}")
    res = nxt(req)
    log.append(f"<- {res['status']}")
    return res

def auth(req, nxt):
    if req["path"].startswith("/admin"):
        return {"status": 401, "body": "login required"}
    return nxt(req)

app.use(logger)
app.use(auth)

@app.route("GET", "/users/:id")
def get_user(req):
    name = DB[req["params"]["id"]]
    return {"status": 200, "body": {"id": req["params"]["id"], "name": name}}

for args in [("GET", "/users/1"), ("GET", "/users/9"), ("GET", "/nope"), ("GET", "/admin/x")]:
    print(args, app.handle(*args))
print("\n".join(log))
```

実行結果。

```
('GET', '/users/1') {'status': 200, 'body': {'id': '1', 'name': 'kim'}}
('GET', '/users/9') {'status': 500, 'body': "error: '9'"}
('GET', '/nope') {'status': 404, 'body': 'not found'}
('GET', '/admin/x') {'status': 401, 'body': 'login required'}
-> GET /users/1
<- 200
-> GET /users/9
-> GET /nope
<- 404
-> GET /admin/x
<- 401
```

</details>

結果で目立つのは 3 つあります。

- `/admin/x` 는 인증 미들웨어에서 차단되어 핸들러에 도달하지 못했고 401 응답이 발생했습니다. 로거는 최외곽 레이어이므로 진입 시와 진출 시 모두 로그를 남깁니다.
- `/nope` 는 일치하는 라우트가 없어 404 응답입니다. 404 도 오류가 아니라, 라우터가 "일치하는 것이 없습니다"라고 반환하는 정상 응답입니다.
- `/users/9` 는 데이터베이스에 없는 키를 읽다가 예외가 발생했고, 이를 최외곽에서 포착하여 500 으로 변환했습니다. 그러나 로그에는 `-> GET /users/9` 만 있고 `<-` 줄이 없습니다. 이는 예외가 로거를 건너뛰어 올라가므로 진출 시의 로그가 누락된 것입니다. 이 코드에서는 로거가 예외를 잡지 않기 때문이며, 실제 서비스에서도 에러 로그가 한 줄 비는 경우가 비슷한 이유일 수 있습니다. 에러 처리를 어디에 배치하느냐가 중요한 이유가 바로 이것입니다. 에러를 수집하는 방법은 [에러와 로깅](#/post/be-error-logging)에서 이어집니다.

이 코드의 `9` 는 "없는 사용자이므로 404"가 맞는데 500 이 나왔습니다. 핸들러에서 "없음"과 "서버 고장"을 구분하지 않으면 이런 일이 발생합니다.

## DB 는 어디에 끼나

핸들러는 SQL 을 직접 사용하기도 하고, 서비스 계층이나 저장소 계층을 거치기도 합니다. 이렇게 층을 나누는 이유와 방식은 [계층 구조](#/post/be-layered-architecture)에서 정리합니다. DB 호출은 보통 요청 시간에서 가장 큰 비중을 차지하므로, 느릴 때 가장 먼저 의심하는 곳입니다. 쿼리를 빠르게 하는 내용은 [인덱스](#/post/db-index)에 있습니다.

핸들러가 오래 걸리는 작업 (메일 발송, 영상 변환 등) 을 요청 내에서 끝까지 수행하면 클라이언트가 계속 대기합니다. 이러한 경우 큐에 넣고 먼저 응답을 반환하는 방식을 사용하는데, [비동기와 큐](#/post/be-async-queue)에서 확인하세요.

## 흔한 오해

- 요청이 곧 서버 하나라고 생각하기 쉽습니다. MDN 의 설명에서도 서버는 부하를 분산하여 담당하는 여러 대일 수 있으며, 클라이언트는 어느 대에 도달했는지 알 수 없습니다.
- 미들웨어에서 응답을 보냈는데 `next()` 를 호출하면 뒤의 핸들러가 다시 응답하려고 하여 오류가 발생할 수 있습니다. 응답이 완료되면 넘기지 않습니다.
- 상태 코드는 서버가 정한 약속이라 `200` 을 보내면서 본문에 "실패"라고 적어도 동작은 합니다. 다만 클라이언트, 프록시, 모니터링 시스템이 상태 코드를 보고 작동하므로 코드를 맞춰서 보내는 것이 좋습니다.
- 순서가 중요하지 않다고 생각하기 쉽습니다. 위 데모처럼 미들웨어는 등록한 순서가 곧 실행 순서입니다.

---

## 근거 링크
- MDN, An overview of HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview (읽음)
- Express, Using middleware: https://expressjs.com/en/guide/using-middleware.html (읽음)

← [개념 맵으로](#/post/be-map)

관련 글: [REST API](#/post/be-api-rest) · [계층 구조](#/post/be-layered-architecture) · [요청이 서버에 닿기까지](#/post/infra-request-journey)
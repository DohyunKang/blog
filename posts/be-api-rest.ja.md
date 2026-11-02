API はプログラム同士の対話の窓口であり、REST はその窓口を「アドレスで対象を指定し、HTTP メソッドで動作を定義する」という約束事によって設計するものです。この記事は、その約束事の構成要素をメソッド、アドレス、ステータスコード、冪等性の順に整理したものです。

## API とは何か

API（Application Programming Interface）とは、あるプログラムが別のプログラムの機能を呼び出すための規則です。レストランに例えるならメニューと注文方法に近いものです。厨房でどのように調理されているかは知らなくても、メニューに従って言えば料理が出てきます。

Web における API は、通常 HTTP でやり取りされる API を指します。クライアント（アプリ、ブラウザ、他のサーバー）がリクエストを送り、サーバーがレスポンスを返します。この経路が実際にはどのような形をしているかは [詳細 → ネットワークの基礎](#/post/cs-network)、リクエストがサーバー内で処理される過程は [詳細 → リクエストの処理フロー](#/post/be-request-flow) でそれぞれ詳しく解説しています。

## REST は約束事です

REST はプロトコルやライブラリではなく、設計スタイルです。いくつかのルールがあります。対象（リソース）をアドレス（URL）で指し示し、動作は HTTP メソッドで表現し、サーバーは各リクエストに対して必要な情報をすべて受け取って処理します（状態をサーバーが保持しません）。このルールをよく守る API を RESTful と呼びます。

実際にはルールを緩やかに守っている API がほとんどです。JSON でやり取りを行い、URL が名詞的であれば通常「REST API」と呼ばれます。元の論文の制約をすべて満たしているかどうかは問わないことが多々あります。この記事もその一般的な使い方を基準としています。

## リソースとアドレス

REST では動作ではなく対象を中心にアドレスを作成します。ユーザーという対象があれば、以下のようにアクセスします。

| アドレス | 意味 |
|---|---|
| `/users` | ユーザー全体のリスト |
| `/users/42` | ID が 42 のユーザー一人 |
| `/users/42/orders` | ID が 42 のユーザーの注文一覧 |

アドレスには `getUser` や `deleteUser` といった動詞は含めません。取得するか削除するかはアドレスではなくメソッドが表現するためです。複数形の名詞を使用し、小文字とハイフンで表記するのが慣例です。

## HTTP メソッド

同じアドレスでもメソッドによって行われる動作が変わります。

| メソッド | 動作 | 例 |
|---|---|---|
| GET | 読み取り | `GET /users/42` |
| POST | 新規作成 | `POST /users` |
| PUT | 全体置換（存在しない場合も作成可能） | `PUT /users/42` |
| PATCH | 部分的な更新 | `PATCH /users/42` |
| DELETE | 削除 | `DELETE /users/42` |

PUT と PATCH の違いは、名前だけを変更したい場合に顕著になります。PUT はユーザー全体を新しい内容で上書きするため、省略されたフィールドは消えてしまいますが、PATCH は送信したフィールドのみを更新します。ただしこの区別は慣習であり、API によって実装が異なることもあります。

## ステータスコード

レスポンスには数値のコードが付きます。最初の桁が大きな分類になります。2xx は成功、3xx は別の場所へ移動する案内、4xx はクライアント側のエラー、5xx はサーバー側のエラーです。MDN のステータスコードドキュメントを基準に、API でよく見られるものを抽出すると以下のようになります。

| コード | 意味 |
|---|---|
| 200 OK | 成功 |
| 201 Created | 成功し、新しいリソースが作成された（通常 POST の後） |
| 204 No Content | 成功したが返すコンテンツがない（削除後に多い） |
| 400 Bad Request | リクエスト形式が不正です |
| 401 Unauthorized | 名前の通り「認証未遂」に近い意味です |
| 403 Forbidden | 誰であるかは判明しているが権限がありません |
| 404 Not Found | そのリソースが見つかりません |
| 409 Conflict | サーバーの現在の状態と衝突しています |
| 422 Unprocessable Content | 形式は正しいが内容に意味的な誤りがあります |
| 429 Too Many Requests | 短時間にリクエストが多すぎます |
| 500 Internal Server Error | サーバーで処理できない一般的なエラー |
| 503 Service Unavailable | サーバーが一時的に利用できません（メンテナンス・過負荷） |

401 と 403 はよく混同されます。ログインしていない場合は 401、ログインしているが他人のものに触れる場合は 403 です。これらの背景については [詳細 → 認証と認可](#/post/be-auth) で解説しています。429 は [詳細 → レートリミットとトラフィック制御](#/post/infra-rate-limit) と続きます。

## 冪等性

この記事で最も長く議論した概念です。冪等（idempotent）とは、同じリクエストを一度送るか複数回送ってもサーバーに残る効果が同じであることを意味します。MDN はこれにより、レスポンスを受け取れなかった場合でもクライアントが安心して再送信できることを説明しています。

メソッド別では、GET、PUT、DELETE は冪等性を持ち、POST と PATCH は冪等性が保証されない。GET は読み取り専用（safe）であるため、当然ながら冪等である。

- PUT: "42 番の名前を lee に" を二回送っても、結果はどちらも名前が lee になる。
- DELETE: 二回送っても最終的には存在しない状態になる。初回は 204、二回目は 404 とレスポンスコードが異なっても、サーバーに残る効果は同じである。MDN のドキュメントにもこの例がある。
- POST: 毎回新しいものを作成する。二回送ると二つが生成される。

そのため、ネットワークが切断されてレスポンスを受信できない状況で POST を自動的に再送信すると、注文が二件登録されてしまう可能性がある。決済や注文 API では、リクエストごとに固有のキー（Idempotency-Key などのヘッダー）を付与し、サーバー側で重複を検知・フィルタリングする方式を採用している場所もある。このヘッダーは標準として確定されたものではなく、サービスによって異なる可能性があるため、本稿では名称のみ記載しておく。

冪等性は「サーバーが意図した効果」に関する話である。リクエストごとにログが一行ずつ残ることは問題視しないし、HTTP 仕様もこれを強制していない。GET リクエストでありながら、呼び出すたびに値を変更するサーバーも作成可能であり、そうなると実装側が不利になる。

## 実際に動作確認した例

Python の標準ライブラリのみで小さなサーバーを立ち上げ、同じリクエストを二回送ってみた（Python 3.13.15 で実行確認）。

<details>
<summary>コードと実行結果を開く</summary>

```python
import json, threading, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

db = {}
next_id = 1

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None):
        self.send_response(code)
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers(); self.wfile.write(data)
        else:
            self.send_header("Content-Length", "0"); self.end_headers()
    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")
    def do_POST(self):
        global next_id
        if self.path != "/users": return self.send(404, {"error": "not found"})
        b = self.body()
        if "name" not in b: return self.send(422, {"error": "name required"})
        uid = next_id; next_id += 1
        db[uid] = {"id": uid, **b}
        self.send(201, db[uid])
    def do_GET(self):
        if self.path == "/users": return self.send(200, list(db.values()))
        uid = int(self.path.rsplit("/", 1)[1])
        self.send(200, db[uid]) if uid in db else self.send(404, {"error": "not found"})
    def do_PUT(self):
        uid = int(self.path.rsplit("/", 1)[1])
        db[uid] = {"id": uid, **self.body()}
        self.send(200, db[uid])
    def do_DELETE(self):
        uid = int(self.path.rsplit("/", 1)[1])
        if db.pop(uid, None) is None: return self.send(404, {"error": "not found"})
        self.send(204)

s = HTTPServer(("127.0.0.1", 8765), H)
threading.Thread(target=s.serve_forever, daemon=True).start()

def call(m, p, b=None):
    r = urllib.request.Request("http://127.0.0.1:8765" + p, method=m,
        data=json.dumps(b).encode() if b is not None else None,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as x: t = x.read().decode(); print(m, p, x.status, t)
    except urllib.error.HTTPError as e:
        print(m, p, e.code, e.read().decode())

call("POST", "/users", {"name": "kim"})
call("POST", "/users", {"name": "kim"})
call("POST", "/users", {})
call("GET", "/users/1")
call("PUT", "/users/1", {"name": "lee"})
call("PUT", "/users/1", {"name": "lee"})
call("DELETE", "/users/1")
call("DELETE", "/users/1")
call("GET", "/users")
```

実行結果:

```
POST /users 201 {"id": 1, "name": "kim"}
POST /users 201 {"id": 2, "name": "kim"}
POST /users 422 {"error": "name required"}
GET /users/1 200 {"id": 1, "name": "kim"}
PUT /users/1 200 {"id": 1, "name": "lee"}
PUT /users/1 200 {"id": 1, "name": "lee"}
DELETE /users/1 204 
DELETE /users/1 404 {"error": "not found"}
GET /users 200 [{"id": 2, "name": "kim"}]
```

</details>

結果から注目すべき点は三つある。POST を二回送ると id が 1、2 となりユーザーが二人生成された。PUT は二回送ってもレスポンスも状態も同じだった。DELETE は初回が 204、二回目が 404 だったが、最後の GET で確認すると 1 番が存在しないという最終状態は一致している。空の本文を持つリクエストに対して 422 を返す部分は私が任意に定めたルールであり、400 と 422 のどちらを使用するかはチームによって異なる。

リクエスト・レスポンスのペアをそのまま見ると以下のようになる。

```
POST /users HTTP/1.1
Content-Type: application/json

{"name": "kim"}

HTTP/1.1 201 Created
Content-Type: application/json

{"id": 1, "name": "kim"}
```

## よくある誤解

- REST API は JSON を使用する API だと考えられがちだが、JSON は一般的な選択肢に過ぎず、REST の条件ではない。
- POST は作成、PUT は更新と暗記するが、PUT でも存在しないリソースを作成できる。アドレスをクライアントが決める場合は PUT、サーバー側が ID を決める場合は POST を使うように分かれることが多い。
- エラーも 200 で返して本文に `"success": false` を入れる API もある。動作はするが、クライアント・キャッシュ・モニタリングツールがステータスコードを見て判断するため、コードで意味を伝える方がよい。エラーレスポンスの本文をどう設計するかは [詳細 → エラー処理とロギング](#/post/be-error-logging) で続いている。
- ステータスコード 401 と 403 を同じように使うと、クライアントが「再度ログインが必要か、権限リクエストが必要か」を区別できない。

LLM が外部機能を呼び出すツールコールも、結局はこのような API コールにつながるケースが多い。その点は [詳細 → ツールコール (Function calling)](#/post/ai-tool-use) を参照のこと。

## 参考リンク

- MDN, Idempotent: https://developer.mozilla.org/en-US/docs/Glossary/Idempotent
- MDN, HTTP response status codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
- コードはローカルで直接実行（Python 3.13.15）

関連記事：[認証と認可](#/post/be-auth) · [リクエストが処理されるフロー](#/post/be-request-flow) · [エラー処理とロギング](#/post/be-error-logging)
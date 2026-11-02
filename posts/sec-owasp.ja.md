OWASP is a non-profit foundation focused on web security, and the Top 10 is a list of "the top 10 risks frequently found in web applications" compiled there. In this article, we examine not just the list itself but why representative attack vectors within it—SQL Injection, XSS, and CSRF occur and how to prevent them, verified through code.

## What is OWASP Top 10?

It is a list of risk categories, not an attack list. It aggregates actual incident data and is updated every few years. The version currently on the homepage (top10.owasp.org) is the 2025 edition, and the categories are as follows.

| 번호 | 범주 |
|---|---|
| A01 | Broken Access Control (접근 통제 실패) |
| A02 | Security Misconfiguration (보안 설정 오류) |
| A03 | Software Supply Chain Failures (공급망 실패) |
| A04 | Cryptographic Failures (암호화 실패) |
| A05 | Injection (인젝션) |
| A06 | Insecure Design (불안전한 설계) |
| A07 | Authentication Failures (인증 실패) |
| A08 | Software or Data Integrity Failures |
| A09 | Security Logging and Alerting Failures |
| A10 | Mishandling of Exceptional Conditions (예외 상황 처리 실패) |

SQL Injection and XSS both fall under A05 Injection, while CSRF can be viewed in the context of A01 Broken Access Control or A07 Authentication Failures (the specific category may vary depending on the version). You do not need to memorize this table; think of it as a checklist to identify weak points in your service. Details on authentication and authorization are available [in detail → Authentication and Authorization](#/post/be-auth), and details on encryption, hashing, and basic authentication are in [in detail → Encryption, Hashing, and Basic Authentication](#/post/sec-authn-crypto).

## Commonalities of the Three Attacks

Although they appear different on the surface, their roots are similar. A breach occurs when a value that the program thinks is "data" is interpreted as "a command" somewhere.

| 공격 | 데이터가 명령으로 해석되는 곳 | 피해 대상 |
|---|---|---|
| SQL 인젝션 | DB 가 SQL 문장을 해석할 때 | 서버의 DB |
| XSS | 브라우저가 HTML·JS 를 해석할 때 | 다른 사용자의 브라우저 |
| CSRF | 서버가 "이 요청은 로그인한 사용자 의지"라고 믿을 때 | 로그인한 사용자 |

The first two involve input entering code locations, whereas CSRF is a different type of attack that deceives the server about who sent the request.

## SQL Injection

### Principle

If queries are constructed by string concatenation, quotes entered by users become part of the SQL syntax. More details on relational databases and basic SQL can be found [in detail → Relational Databases and Basic SQL](#/post/db-rdb-sql).

```python
# 위험한 코드
q = f"SELECT name FROM users WHERE name='{name}' AND pw='{pw}'"
```

Entering `admin' --` in the `name` field results in a query like this:

```sql
SELECT name FROM users WHERE name='admin' --' AND pw='아무거나'
```

Everything after `--` is treated as a comment, so the password condition disappears entirely. A variation where `' OR '1'='1` is entered into the password field makes the condition always true, causing all rows to be retrieved.

### Defense

The top recommendation from the OWASP SQL Injection Prevention Cheat Sheet is parameterized queries (prepared statements). This separates the SQL structure from values and delivers them separately to the database, ensuring that values cannot become part of the syntax regardless of their content. Following this are stored procedures (which can also be bypassed if string concatenation occurs within them), allowlist validation, and escaping. Escaping is not recommended as a primary defense because its behavior varies depending on the database type and configuration; it is advised against as a substitute for parameter binding.

```python
# 안전한 코드
db.execute("SELECT name FROM users WHERE name=? AND pw=?", (name, pw))
```

There are places where parameters cannot be used. Column names or sort directions (`ORDER BY`) are SQL structures, not values, so they cannot be bound. In such cases, user input should not be used directly; instead, only values present in an allowlist are passed through.

<details>
<summary>Demo executed (sqlite3, full code and results)</summary>

```python
import sqlite3
db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE users(name TEXT, pw TEXT)")
db.executemany("INSERT INTO users VALUES(?,?)", [("kim","a1"),("admin","zz9")])

def login_bad(name, pw):
    q = f"SELECT name FROM users WHERE name='{name}' AND pw='{pw}'"
    return db.execute(q).fetchall()
def login_good(name, pw):
    return db.execute("SELECT name FROM users WHERE name=? AND pw=?", (name, pw)).fetchall()

evil = "admin' --"
print("bad ", login_bad(evil, "아무거나"))
print("good", login_good(evil, "아무거나"))
print("bad2", login_bad("x", "' OR '1'='1"))
print("good2", login_good("x", "' OR '1'='1"))

ALLOWED = {"name", "pw"}
def order_by(col):
    if col not in ALLOWED: raise ValueError("bad column")
    return db.execute(f"SELECT name FROM users ORDER BY {col}").fetchall()
print(order_by("name"))
try: order_by("name; DROP TABLE users")
except ValueError as e: print("거부:", e)
```

The execution results were as follows:

```
bad  [('admin',)]            <- 비밀번호 모르는데 admin으로 로그인됨
good []
bad2 [('kim',), ('admin',)]  <- 전원 조회됨
good2 []
[('admin',), ('kim',)]
거부: bad column
```

</details>

## XSS (Cross-Site Scripting)

### Principle

When a user's input is inserted into a page exactly as provided, if it contains `<script>`, the browser executes it without distinguishing it from legitimate code sent by the server. The process of how browsers render HTML is explained [in detail → How Browsers Render Screens](#/post/fe-browser-render).

If a script is embedded in a bulletin board comment, it will execute in the browser of every person viewing that post. Since the script runs with the permissions of the site, it can read cookies or tokens and send requests on behalf of the user. These are typically categorized into three types.

- 저장형: 악성 입력이 DB に保存され、記事を表示するたびに実行される
- 反射型: URL パラメータが応答にそのまま反映されてしまい、リンクをクリックした人だけが実行される
- DOM 基盤型: サーバーは関与せず、クライアント側の JS が `innerHTML` などの場所に入力値を代入して実行する

### 防御

核心となるのは、出力する際に、出力先に応じてエンコードを行うことです。OWASP XSS チートシートによれば、HTML の本文、属性、JS、CSS、URL では位置によってエンコード方法が異なるそうです。危険な場所（`<script>` タグ内、スタイル内、イベントハンドラの文字列など）にはユーザー値を一切入れない方が安全です。

```python
import html
comment = '<script>alert(1)</script>'
print(f"<p>{html.escape(comment)}</p>")
# <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
```

単に文字として表示されるだけで実行されません。実際には React や Vue などのフレームワークや Jinja などのテンプレートエンジンがデフォルトでエスケープ処理を行うため、問題はこれらのデフォルト挙動を回避する際に（`innerHTML`、`dangerouslySetInnerHTML`、`v-html`、`|safe` など）発生します。チートシートでは `innerHTML` を基本的に危険とみなし、`textContent` などのテキスト用 API を優先して使うよう推奨しています。ユーザーが記述した HTML を必ず表示させたい場合は、DOMPurify などの検証済みのライブラリで浄化してから挿入します。

CSP（Content-Security-Policy ヘッダー）は、許可されたソースからのスクリプトのみを実行させるための二次防御線です。チートシートでも主防御ではなく補助防御として扱っています。まずエンコードを行い、その上に CSP を重ねます。

## CSRF (サイト間リクエスト偽造)

### 原理

ブラウザがどのサイトへリクエストを送信する際も、そのリクエストがどのページから始まったとしても、当該サイトのクッキーを自動的に付与します。銀行にログインした状態で悪意のあるページを開くと、そのページが銀行への送金リクエストを送るよう仕向けられます。クッキーが一緒に送信されるため、サーバーは正常なユーザーのリクエストと判断してしまいます。攻撃者は応答を見ることはできませんが、「状態を変更するリクエスト」は成功します。

```html
<!-- 악성 페이지에 숨겨 둔 폼 -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="1000000">
</form>
<script>document.forms[0].submit()</script>
```

セッションクッキーについては [詳細 → 認証と認可](#/post/be-auth) で扱っています。

### 防御

OWASP CSRF チートシートで整理されている対策は主に 3 つです。

1. 同期トークン (synchronizer token): サーバーがセッションに紐づく予測不可能なトークンを生成し、フォームや応答に含めて送信し、状態を変更するリクエストごとにトークンの一致を確認します。悪意のあるページはこのトークンを知らないため、リクエストが拒否されます。
2. ダブルサブミットクッキー: サーバーに保存せず、同じ値をクッキーとリクエストヘッダー・パラメータの両方で送信して一致するか確認します。チートシートではセッションに紐付けた署名 (HMAC) 方式を推奨しており、署名のない単純な方法はサブドメインでクッキーを設定できる場合などに突破されるため推奨しません。
3. SameSite クッキー属性: 他のサイトから始まったリクエストにはクッキーを送信させません。ただし `Lax` はトップレベルの GET リダイレクトではクッキーを送信するため、GET で状態を変更する API がある場合は突破されます。チートシートでは単独防御ではなくトークンと重ねる補助防御として扱い、ブラウザによってデフォルト値が異なるため明示的に指定するよう推奨しています。

したがって、GET は読み取りのみを行い変更は POST・PUT・DELETE にするというルールが重要です ([詳細 → API と REST](#/post/be-api-rest))。トークンはこのように作成し検証できます。

```python
import hmac, hashlib, secrets
SECRET = secrets.token_bytes(32)          # 서버만 아는 값
def make_token(sid): return hmac.new(SECRET, sid.encode(), hashlib.sha256).hexdigest()
def check(sid, tok): return hmac.compare_digest(make_token(sid), tok)

t = make_token("sess-42")
print(check("sess-42", t))        # True
print(check("sess-42", "0"*64))   # False (엉터리 토큰)
print(check("sess-99", t))        # False (다른 세션의 토큰)
```

注意点として、XSS が突破されてしまうと CSRF 防御の意味がないということです。チートシートにも「XSS はすべての CSRF 防御を無力化できる」と記載されています。同じソースから読み込まれるスクリプトはトークンを取得して正常なリクエストを作成できてしまうためです。そのため XSS 防御が先です。

## よくある誤解

- 入力検証だけでよい: `O'Brien` のように名前にアポストロフィが入るような正常な入力があるため、特殊文字をブロックする方式には限界があります。入力は検証し、出力とクエリは文脈に合わせて処理します。これらは別々に行う必要があります。
- フレームワークを使えば安全: デフォルト値の範囲内ではそうなりますが、前述した `innerHTML` 類の回避、文字列で作成したクエリ、ORM の raw クエリなどが穴になります。
- HTTPS であれば防げる: HTTPS は中継での覗き見を防ぐものであり、上記 3 つの攻撃は正常な接続の上で発生します。
- 内部サービスなら問題ない: 内部網のユーザーのブラウザも悪意のあるページを開くことができるため、CSRF や XSS は内部サービスにも該当します。

## まとめ

3 つの攻撃を並置すると防御方向が一致します。SQL インジェクションはクエリと値を分離し、XSS は出力位置に合わせてエンコードし、CSRF は「このリクエストが本当にこのユーザーの意図である」という証拠（トークン）を要求します。鍵が漏れる問題は [詳細 → キー・シークレット管理](#/post/sec-keys) に、AI アプリケーションで同じ原理（データがコマンドとして読み込まれる）が現れるのは [詳細 → プロンプトインジェクションと AI セキュリティ](#/post/sec-prompt-injection) にあります。

## 参考文献

- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- SQL Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Cross Site Scripting Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Cross-Site Request Forgery Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

← [概念マップ](#/post/sec-map)

関連記事：[認証と認可](#/post/be-auth) · [キー・シークレット管理](#/post/sec-keys) · [プロンプトインジェクションと AI セキュリティ](#/post/sec-prompt-injection)
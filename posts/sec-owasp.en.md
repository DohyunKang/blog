OWASP is a non-profit foundation focused on web security, and the Top 10 is their list of "the top 10 risks most common in web applications." In this article, instead of focusing solely on the list itself, we examine why the three representative attack vectors—SQL Injection, XSS, and CSRF—occur and how to prevent them, verified through code.

## What is OWASP Top 10?

It is not a list of attacks but a list of risk categories. It is updated every few years based on aggregated data from actual incidents. The version currently available on the homepage (top10.owasp.org) is the 2025 edition, and the categories are as follows:

| Number | Category |
|---|---|
| A01 | Broken Access Control |
| A02 | Security Misconfiguration |
| A03 | Software Supply Chain Failures |
| A04 | Cryptographic Failures |
| A05 | Injection |
| A06 | Insecure Design |
| A07 | Authentication Failures |
| A08 | Software and Data Integrity Failures |
| A09 | Security Logging and Monitoring Failures |
| A10 | Server-Side Request Forgery (SSRF) |

*Note: The table above reflects the 2025 OWASP Top 10 categories. Specific sub-categories or legacy names like "Mishandling of Exceptional Conditions" may vary by version.*

SQL Injection and XSS both fall under A05 Injection, while CSRF can be viewed in the context of A01 Broken Access Control or A07 Authentication Failures (the specific category assignment may vary). You do not need to memorize this table; treat it as a checklist to identify weak points in your service. Details on authentication and authorization are available [in detail → Authentication and Authorization](#/post/be-auth), and details on encryption, hashing, and the basics of authentication are covered [in detail → Encryption, Hashing, and Authentication Basics](#/post/sec-authn-crypto).

## Commonalities Among the Three Attacks

Although they appear different on the surface, their root cause is similar. A breach occurs when a value that the program thinks is "data" is interpreted as "code" somewhere else.

| Attack | Where Data is Interpreted as Code | Victim |
|---|---|---|
| SQL Injection | When the database interprets an SQL statement | The server's database |
| XSS | When the browser interprets HTML/JS | Other users' browsers |
| CSRF | When the server believes a request comes from a logged-in user | The logged-in user |

The first two involve input entering code locations, whereas CSRF is different; it deceives the system about who sent the request.

## SQL Injection

### Principle

If queries are constructed by string concatenation, quotes entered by users become part of the SQL syntax. More information on relational databases and basic SQL can be found [in detail → Relational Databases and Basic SQL](#/post/db-rdb-sql).

```python
# 위험한 코드
q = f"SELECT name FROM users WHERE name='{name}' AND pw='{pw}'"
```

Entering `admin' --` into the `name` field results in a query like this:

```sql
SELECT name FROM users WHERE name='admin' --' AND pw='아무거나'
```

The part after `--` is treated as a comment, causing the password condition to disappear entirely. A variation where `' OR '1'='1` is entered into the password field makes the condition always true, resulting in all records being retrieved.

### Defense

The top recommendation from the OWASP SQL Injection Prevention Cheat Sheet is using parameterized queries (prepared statements). This separates the SQL structure from the values and delivers them separately to the database, ensuring that values cannot alter the syntax regardless of their content. Following this are stored procedures (note: string concatenation inside them can still be exploited), allow-list validation, and escaping. Escaping behavior varies depending on the database type and configuration; therefore, it is advised not to rely on it as a substitute for parameter binding.

```python
# 안전한 코드
db.execute("SELECT name FROM users WHERE name=? AND pw=?", (name, pw))
```

There are places where parameters cannot be used. Column names or sort directions (`ORDER BY`) are SQL structures, not values, so they cannot be bound. In these cases, do not use user input directly; instead, pass only values from an allow-list.

<details>
<summary>Demo run (sqlite3, full code and results)</summary>

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

When a user's input is inserted directly into a page, if it contains `<script>`, the browser executes it without distinguishing it from legitimate code sent by the server. The process of how browsers render HTML is explained [in detail → How Browsers Render Pages](#/post/fe-browser-render).

If a script is embedded in a forum comment, it executes in the browser of every person viewing that post. Since the script runs with the permissions of the site, it can read cookies or tokens and send requests on behalf of the user. XSS attacks are typically categorized into three main types.

- Stored: Malicious input is saved in the database and executes every time the post is viewed.
- Reflected: The malicious input is reflected directly in the URL parameters, so only the person who clicks the link is affected.
- DOM-based: The server is not involved; client-side JavaScript inserts user input into places like `innerHTML` to execute it.

### Defense

The core principle is to encode output appropriately for its destination when rendering it. The OWASP XSS Cheat Sheet also notes that encoding methods differ depending on the context: HTML body, attributes, JavaScript, CSS, and URLs. It is safest to avoid inserting user values entirely into dangerous locations (e.g., inside `<script>` tags, styles, or event handler strings).

```python
import html
comment = '<script>alert(1)</script>'
print(f"<p>{html.escape(comment)}</p>")
# <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
```

This prevents execution; it only displays as text. In practice, frameworks like React and Vue, or template engines like Jinja, automatically escape output by default. The problem arises when bypassing these defaults (e.g., using `innerHTML`, `dangerouslySetInnerHTML`, `v-html`, or `|safe`). The Cheat Sheet recommends treating `innerHTML` as inherently dangerous and suggests using text-oriented APIs like `textContent` first. If you must display user-provided HTML, sanitize it with a trusted library like DOMPurify before inserting it.

CSP (Content-Security-Policy header) acts as a secondary line of defense that allows scripts only from approved origins. The Cheat Sheet lists it as supplementary rather than primary defense. Apply encoding first, then layer CSP on top.

## CSRF (Cross-Site Request Forgery)

### Principle

When a browser sends a request to a site, it automatically attaches cookies for that site regardless of which page initiated the request. If you are logged into a bank and open a malicious page, that page can trick you into sending a fund transfer request to the bank. Because the cookie is included, the server treats the request as coming from a legitimate user. While the attacker cannot see the response, requests that "change state" succeed.

```html
<!-- 악성 페이지에 숨겨 둔 폼 -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="1000000">
</form>
<script>document.forms[0].submit()</script>
```

For session cookies, see [Authentication and Authorization](#/post/be-auth) for more details.

### Defense

The OWASP CSRF Cheat Sheet outlines three main defenses:

1. **Synchronizer Token**: The server generates an unpredictable token bound to the session and includes it in forms or responses. Every state-changing request must validate this token. Since a malicious page cannot guess this token, its requests are rejected.
2. **Double Submit Cookie**: Instead of storing the token on the server, send the same value both as a cookie and in the request header/parameter to verify they match. The Cheat Sheet recommends using HMAC-based signatures bound to the session; it advises against simple methods without signatures because they can be bypassed if cookies are set on subdomains.
3. **SameSite Cookie Attribute**: Prevents cookies from being sent on requests originating from other sites. However, `Lax` still sends cookies for top-level GET navigations, which allows bypassing CSRF protection if state-changing APIs are accessible via GET. The Cheat Sheet treats this as supplementary defense alongside tokens and explicitly recommends specifying it because default values vary by browser.

Therefore, the rule that GET requests should only read data while POST, PUT, and DELETE handle changes is crucial (see [APIs and REST](#/post/be-api-rest) for details). Tokens can be created and validated in this manner.

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

One important caveat: if XSS is exploited, CSRF defenses become meaningless. The Cheat Sheet notes that XSS can neutralize all CSRF protections. Scripts running from the same origin can read tokens to forge legitimate requests. Therefore, defending against XSS must come first.

## Common Misconceptions

- **Input validation alone is sufficient**: Normal inputs like `O'Brien` in a name field contain special characters (quotes), so blocking special characters has limitations. You must validate input and handle output and queries according to their context; these are separate tasks.
- **Using a framework makes you safe**: This holds true only within default configurations. As mentioned above, bypasses like `innerHTML`, string-based queries, or raw queries in ORMs create vulnerabilities.
- **HTTPS protects against this**: HTTPS prevents eavesdropping on the connection but does not stop these attacks, which occur over legitimate connections.
- **Internal services are safe**: Even internal network users can open malicious pages, so CSRF and XSS apply to internal services as well.

## Summary

When placed side by side, the defenses for these three attacks align logically: SQL injection is mitigated by separating queries from values; XSS is mitigated by encoding output appropriately for its context; and CSRF requires proof ("token") that "this request was intended by this user." Issues related to leaking keys are covered in [Key and Secret Management](#/post/sec-keys), and the same principle (data being read as commands) appearing in AI apps is discussed in [Prompt Injection and AI Security](#/post/sec-prompt-injection).

## Reference Links

- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- SQL Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Cross Site Scripting Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Cross-Site Request Forgery Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

← [Concept Map](#/post/sec-map)

Related Posts: [Authentication and Authorization](#/post/be-auth) · [Key & Secret Management](#/post/sec-keys) · [Prompt Injection and AI Security](#/post/sec-prompt-injection)
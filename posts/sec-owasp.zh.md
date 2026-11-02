OWASP 是一个专注于网络安全的非营利基金会，而 Top 10 是该基金会整理的“网页应用中常见的十大风险”列表。本文不仅关注列表本身，更通过代码深入剖析了其中三种代表性攻击——SQL 注入、XSS 和 CSRF 的成因及防御方法。

## OWASP Top 10 是什么？

它并非一份简单的攻击列表，而是一份风险类别清单。基金会会收集实际事故数据，每隔几年更新一次。目前官网 (top10.owasp.org) 上发布的是 2025 年版，其风险类别如下：

| 编号 | 类别 |
|---|---|
| A01 | Broken Access Control (访问控制失效) |
| A02 | Security Misconfiguration (安全配置错误) |
| A03 | Software Supply Chain Failures (软件供应链失败) |
| A04 | Cryptographic Failures (加密失败) |
| A05 | Injection (注入) |
| A06 | Insecure Design (不安全的架构设计) |
| A07 | Authentication Failures (身份验证失效) |
| A08 | Software or Data Integrity Failures |
| A09 | Security Logging and Alerting Failures |
| A10 | Mishandling of Exceptional Conditions (异常条件处理不当) |

SQL 注入和 XSS 均属于 A05 Injection（注入）范畴；CSRF 则可与 A01 访问控制或 A07 身份验证相关联（具体归类视版本而定）。此表无需死记硬背，可将其视为“检查自身服务薄弱环节的清单”。关于认证与授权，请参见 [详情 → 认证与授权](#/post/be-auth)；关于加密、哈希及基础认证知识，请参见 [详情 → 加密·哈希·认证基础](#/post/sec-authn-crypto)。

## 三种攻击的共同点

尽管表现形式各异，但根源相似：当程序将某值误判为“数据”，而该值在别处被解释为“命令”时，漏洞便由此产生。

| 攻击类型 | 数据被误作命令解析的位置 | 受害对象 |
|---|---|---|
| SQL 注入 | 数据库解析 SQL 语句时 | 服务器数据库 |
| XSS | 浏览器解析 HTML/JS 时 | 其他用户的浏览器 |
| CSRF | 服务器误信“此请求来自已登录用户”时 | 已登录用户 |

前两者属于输入内容被当作代码执行的问题，而 CSRF 则是通过欺骗服务器判断请求来源来实施攻击。

## SQL 注入

### 原理

若通过字符串拼接构建查询语句，用户输入的引号便会成为 SQL 语法的一部分。SQL 基础知识可参见 [详情 → 关系型数据库与 SQL 基础](#/post/db-rdb-sql)。

```python
# 위험한 코드
q = f"SELECT name FROM users WHERE name='{name}' AND pw='{pw}'"
```

在 `name` 字段输入 `admin' --` 后，生成的查询语句如下：

```sql
SELECT name FROM users WHERE name='admin' --' AND pw='아무거나'
```

`--` 之后的内容被视为注释，导致密码条件完全失效。若在密码框中输入 `' OR '1'='1` 这类变体，则条件恒为真，从而查出所有记录。

### 防御

OWASP SQL 注入预防指南中首要推荐的是使用参数化查询（prepared statement）。该方法将 SQL 结构与数据值分别传递给数据库，确保无论输入何种内容，都不会被解析为语法结构。其次可采用存储过程（但需注意若在其中再次拼接字符串仍会被绕过）、白名单验证以及转义处理。由于转义行为因数据库类型和配置而异，指南明确指出“不应将其作为参数绑定替代方案”。

```python
# 안전한 코드
db.execute("SELECT name FROM users WHERE name=? AND pw=?", (name, pw))
```

某些位置无法使用参数绑定。例如列名或排序方向 (`ORDER BY`) 属于 SQL 结构而非数据值，因此不能进行参数绑定。此时应拒绝直接使用用户输入，仅允许通过白名单校验的值。

<details>
<summary>实际运行演示（sqlite3，含完整代码与结果）</summary>

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

执行结果如下：

```
bad  [('admin',)]            <- 비밀번호 모르는데 admin으로 로그인됨
good []
bad2 [('kim',), ('admin',)]  <- 전원 조회됨
good2 []
[('admin',), ('kim',)]
거부: bad column
```

</details>

## XSS（跨站脚本攻击）

### 原理

当用户输入的内容被原样嵌入页面时，若其中包含 `<script>` 标签，浏览器将无法区分这是服务器发送的正常代码还是恶意脚本，从而直接执行。浏览器解析 HTML 的过程可参见 [详情 → 浏览器如何渲染页面](#/post/fe-browser-render)。

若在留言板评论中预埋脚本，则所有查看该评论的用户浏览器都会执行此脚本。由于该脚本是在当前站点权限下运行，因此可以读取 Cookie、Token，或以用户身份发起请求。XSS 攻击通常分为三类。

- 存储型：恶意输入被保存到数据库中，每次查看文章时都会执行。
- 反射型：URL 参数原样出现在响应中，只有点击链接的人才会触发。
- DOM 型：服务器不参与处理，客户端 JS 将输入放入 `innerHTML` 等位置并执行。

### 防御

核心在于输出时，根据输出位置进行相应的编码。OWASP XSS Cheat Sheet 也指出，HTML 正文、属性、JS、CSS、URL 在不同位置的编码方式各不相同。在危险的位置（如 `<script>` 标签内、样式块内、事件处理程序字符串等）最好完全不放入用户值，这样更安全。

```python
import html
comment = '<script>alert(1)</script>'
print(f"<p>{html.escape(comment)}</p>")
# <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
```

仅显示为文本而不会执行。实际上，像 React·Vue 这样的框架或 Jinja 这样的模板引擎默认会进行转义，问题出现在绕过这些默认设置时（如使用 `innerHTML`、`dangerouslySetInnerHTML`、`v-html`、`|safe`）。Cheat Sheet 将 `innerHTML` 默认为危险操作，建议优先使用 `textContent` 等用于文本的 API。如果必须展示用户输入的 HTML，应先通过 DOMPurify 等经过验证的库进行净化后再插入。

CSP（Content-Security-Policy 响应头）是允许执行来自指定来源的脚本的第二道防线。在 Cheat Sheet 中，它也被列为辅助防御而非主要防御。应优先进行编码，再叠加 CSP。

## CSRF（跨站请求伪造）

### 原理

浏览器在向某个站点发送请求时，无论该请求源自哪个页面，都会自动附加该站点的 Cookie。例如，在银行登录后打开恶意页面，该页面可诱导向银行发起转账请求。由于 Cookie 一同携带，服务器会将其视为正常用户的请求。攻击者虽然无法查看响应，但“改变状态的请求”却能成功。

```html
<!-- 악성 페이지에 숨겨 둔 폼 -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="1000000">
</form>
<script>document.forms[0].submit()</script>
```

关于会话 Cookie，已在 [详细 → 认证与授权](#/post/be-auth) 中讨论。

### 防御

OWASP CSRF Cheat Sheet 总结的防御措施主要有三类：

1. **同步令牌（Synchronizer Token）**：服务器为每个会话生成一个不可预测的令牌，将其嵌入表单或响应中发送，并在每次改变状态的请求时验证令牌是否匹配。恶意页面无法获取该令牌，因此请求会被拒绝。
2. **双重提交 Cookie**：不在服务器端存储，而是将相同值同时发送到 Cookie、请求头和参数中，以进行比对。Cheat Sheet 推荐使用绑定到会话的签名（HMAC）方式，而不推荐无签名的简单方法，因为后者若允许子域设置 Cookie，则容易被绕过。
3. **SameSite Cookie 属性**：阻止由其他站点发起的请求携带 Cookie。但 `Lax` 模式会在最顶层的 GET 跳转时仍发送 Cookie，因此如果存在通过 GET 改变状态的 API，仍可被绕过。Cheat Sheet 认为这并非独立防御手段，而是与令牌配合使用的辅助防御，并建议因各浏览器默认值不同而显式指定。

因此，遵循“GET 仅用于读取，POST·PUT·DELETE 用于变更”的规则至关重要（[详细 → API 与 REST](#/post/be-api-rest)）。令牌可据此创建和验证。

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

需注意的一点是：若 XSS 被绕过，则 CSRF 防御将失去意义。Cheat Sheet 也指出，XSS 可使所有 CSRF 防御失效。这是因为同源脚本可以读取令牌并构造合法请求。因此，必须先防御 XSS。

## 常见误解

- **仅靠输入验证即可**：例如名字中包含 `O'Brien` 这样的正常输入含有引号，单纯屏蔽特殊字符存在局限。应对输入进行验证，对输出和查询则需根据上下文处理。这两者必须分别实施。
- **使用框架就安全**：仅在默认配置下成立。如前所述，绕过 `innerHTML` 类机制、构造字符串形式的 SQL 查询、ORM 的 raw 查询等都会形成漏洞。
- **HTTPS 就能防护**：HTTPS 仅防止中间人窃听，而上述三种攻击均发生在正常连接之上。
- **内部服务就没问题**：内部网络用户的浏览器同样可能打开恶意页面，因此 CSRF 和 XSS 同样适用于内部服务。

## 总结

将这三种攻击并列看待，其防御方向便清晰对应：SQL 注入需分离查询与值，XSS 需按输出位置进行编码，CSRF 则需索取证明“此请求确为用户本意”的证据（即令牌）。密钥泄露问题详见 [详细 → 密钥与秘密管理](#/post/sec-keys)，AI 应用中出现的类似原理（数据被当作指令读取）则见 [详细 → 提示注入与 AI 安全](#/post/sec-prompt-injection)。

## 参考资料

- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- SQL 注入防护清单 — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- 跨站脚本 (XSS) 防护清单 — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- 跨站请求伪造 (CSRF) 防护清单 — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

← [概念地图](#/post/sec-map)

相关文章：[认证与授权](#/post/be-auth) · [密钥与秘密管理](#/post/sec-keys) · [提示注入与 AI 安全](#/post/sec-prompt-injection)
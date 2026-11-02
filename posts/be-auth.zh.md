认证是确认“你是谁”的过程，而授权则是决定“这个人能否做这件事”。Session 和 JWT 是维持登录状态的方法；OAuth 是借用他人服务权限的流程；RBAC 则是管理权限的方式。

## 从认证与授权开始区分

之所以容易混淆，是因为两者总是结伴出现，且顺序固定：先通过认证确认用户身份，再依据该用户信息进行授权判断。

| | 认证 (Authentication) | 授权 (Authorization) |
|---|---|---|
| 问题 | 你是谁？ | 你能做什么？ |
| 示例 | 密码验证、社交登录 | 仅管理员可删除会员 |
| 失败时的 HTTP 状态码 | 401 | 403 |
| 时机 | 登录时，以及每次请求时进行身份确认 | 每次请求时 |

登录只需进行一次，但 HTTP 请求是逐个到达的。服务器并不记忆之前的请求（[详情 → 请求处理流程](#/post/be-request-flow)）。因此，每次都需要证明“发送此请求的人就是刚才登录的那个人”，而实现这一目标的方法要么是 Session，要么是 Token。

## Session 方式

当服务器成功完成登录后，会生成一个随机 ID，并在服务器端存储中记录“该 ID 对应 42 号用户”，随后仅将该 ID 通过 Cookie 发送给浏览器。此后每次请求，浏览器都会携带此 Cookie，服务器则从中查找 ID 以识别用户。

```
로그인 → 서버: 세션 ID 생성, 저장소에 {ID: 사용자 42} 기록
      ← Set-Cookie: sid=랜덤값
요청   → Cookie: sid=랜덤값 → 서버가 저장소 조회 → 42번으로 처리
로그아웃 → 저장소에서 ID 삭제 (바로 무효)
```

根据 OWASP Session Management 文档整理如下：

- 用户信息与权限保留在服务器端，不存入 ID；ID 本身是无意义的随机数。
- Cookie 需附加 `HttpOnly`（防止 JavaScript 读取）、`Secure`（仅通过 HTTPS 传输）以及 `SameSite`（Strict 或 Lax）。
- 登录后立即颁发新的 Session ID 并废弃旧 ID，以防止“会话固定”攻击（即在登录前植入的 ID 被继续使用）。
- 服务器强制设置空闲超时时间和绝对过期时间。

其优势在于服务器可随时终止会话：无论是主动注销还是强制登出，只要在存储中删除记录即可立即生效。劣势在于服务器需维护状态；若部署多台服务器，则必须共享存储，通常会在前面部署 Redis 等中间件（[详情 → 缓存与 Redis](#/post/db-cache-redis)）。

## Token 方式 (JWT)

JWT 是一种服务器不存储数据、而是将用户信息嵌入令牌中并签名后发送给客户端的方式。其结构由三个以点分隔的部分组成。

```
헤더 . 페이로드 . 서명
(알고리즘)  (클레임: 누구, 만료 시각 등)  (위 둘에 대한 HMAC 또는 전자서명)
```

RFC 7519 中定义的典型声明包括 `iss`（签发者）、`sub`（主体）、`aud`（受众）、`exp`（过期时间）、`nbf`（生效时间，即该时刻之前无效）、`iat`（签发时间）以及 `jti`（令牌唯一标识）。所有字段均为可选。

服务器收到令牌后，只需重新计算签名以验证其有效性，并检查是否已过有效期，无需查询存储。因此，即使部署多台服务器或多个服务，只要共享同一密钥即可进行验证。

不过有几件事需要注意：

- 签名仅能防止伪造，并不能隐藏内容；Payload 部分仅经过 base64url 编码，任何人都可读。RFC 也明确指出签名令牌的内容是可见的，切勿放入密码等敏感信息。
- 一旦签发，在过期前服务器难以撤销该令牌。由于没有存储记录，“使此令牌无效”无从实现。因此，Access Token 通常设置较短生命周期（以分钟计），并单独使用 Refresh Token 进行刷新；若要撤销，最终仍需引入类似黑名单的存储机制。
- 存储位置至关重要。OWASP 建议避免将令牌存入 `localStorage` 或 `sessionStorage`，因为一旦 XSS 漏洞被利用，令牌即可被读取。相比之下，将令牌存入 HttpOnly Cookie 更为安全。但若使用 Cookie，则需额外防范 CSRF 攻击。

Session 与 JWT 的逐项对比如下：

| | Session | JWT |
|---|---|---|
| 状态存储位置 | 服务器（存储库） | 令牌内（客户端） |
| 立即失效 | 容易 | 困难 |
| 服务器扩展性 | 需共享存储 | 仅需共享密钥 |
| 请求大小 | 小（仅含 ID） | 大（包含信息） |
| 适用场景 | 单一服务的 Web 应用 | 多服务、移动端及 API |

并无绝对优劣之分：若需立即终止会话，Session 更合适；若服务被拆分，则 JWT 更为便利。许多人误以为用 JWT 替代 Session 会自动更安全，但正如上文所述，这也会引入撤销和存储位置等新问题。

<details>
<summary>亲测代码示例：Session ID、JWT 签名与验证、RBAC（仅使用 Python 标准库）</summary>

```python
import base64, hashlib, hmac, json, secrets, time

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def unb64(s): return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

SECRET = b"dev-only-secret"   # 실제로는 환경변수·시크릿 저장소에서

def sign(payload, ttl=900):
    head = {"alg": "HS256", "typ": "JWT"}
    payload = {**payload, "exp": int(time.time()) + ttl}
    msg = b64(json.dumps(head).encode()) + "." + b64(json.dumps(payload).encode())
    sig = hmac.new(SECRET, msg.encode(), hashlib.sha256).digest()
    return msg + "." + b64(sig)

def verify(token):
    h, p, s = token.split(".")
    if json.loads(unb64(h)).get("alg") != "HS256":   # 알고리즘을 서버가 고정
        raise ValueError("alg")
    good = hmac.new(SECRET, f"{h}.{p}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(good, unb64(s)):
        raise ValueError("bad signature")
    data = json.loads(unb64(p))
    if data["exp"] < time.time():
        raise ValueError("expired")
    return data

sessions = {}
def login(uid):
    sid = secrets.token_urlsafe(32)   # CSPRNG 난수
    sessions[sid] = {"uid": uid}
    return sid

ROLE_PERMS = {
    "viewer": {"post:read"},
    "editor": {"post:read", "post:write"},
    "admin":  {"post:read", "post:write", "user:delete"},
}
def can(roles, perm):
    return any(perm in ROLE_PERMS.get(r, ()) for r in roles)
```

运行结果（在此环境中直接验证）：

```
정상 토큰 검증      → {'sub': '42', 'roles': ['editor'], 'exp': ...}
roles를 admin으로 바꿔 재조립 → tampered: bad signature
만료된 토큰         → old: expired
세션 ID 길이 43, 삭제 후 조회 → False
can(editor, post:write)=True / can(editor, user:delete)=False / can(admin, user:delete)=True
```

验证时不能盲目信任头部的 `alg`。这是因为服务器会固定使用某种算法进行比较（据说过去曾出现过利用 `alg: none` 跳过签名的攻击。此处仅确认了 RFC 中关于存在不安全 JWT 的说明）。

</details>

## OAuth 是权限委托，而非登录

人们常将 OAuth 误认为等同于“通过 Google 登录”，但 RFC 6749 所描述的是**委托（delegation）**机制。其结构如下：用户（资源所有者）授权某个应用（客户端）在特定范围内使用其资源（位于资源服务器上），而授权服务器则将此授权转换为令牌。该模型包含四个角色：

| 角色 | 职责 |
|---|---|
| 资源所有者 | 可授予访问权限的人（即用户） |
| 客户端 | 代表用户尝试访问资源的应用程序 |
| 授权服务器 | 验证用户身份并获取同意后颁发令牌 |
| 资源服务器 | 持有资源的服务器，根据访问令牌处理请求 |

最常见的授权码（authorization code）流程包含五个步骤：

1. 客户端将用户重定向至授权服务器，同时传递客户端 ID、请求范围（scope）、state 值及回调地址（redirect URI）。
2. 授权服务器验证用户身份并获取其同意与否。
3. 若用户同意，则通过 redirect URI 返回一个有效期短的授权码。
4. 客户端将该授权码发送至令牌端点以换取令牌；此时客户端自身也需完成认证。
5. 接收访问令牌（以及可选的刷新令牌）。

之所以将授权码与令牌分开处理，是因为浏览器地址栏仅能安全传递一次性使用的授权码，而真正的令牌应在服务器间直接交换。刷新令牌仅发送给授权服务器，不发送至资源服务器。

“通过 Google 登录”实际上是在 OAuth 之上叠加了 OpenID Connect（OIDC）以获取身份信息，但本次未查阅 OIDC 相关文档。

## 权限模型：RBAC

如何定义授权规则取决于所采用的权限模型。最常见的是 RBAC（基于角色的访问控制）。在该模型中，并非直接向用户分配单个权限，而是赋予其角色（如 viewer、editor、admin），每个角色对应一组权限。上述代码中的 `ROLE_PERMS` 即体现了这一机制：

```
사용자 ──(가진다)──▶ 역할 ──(포함한다)──▶ 권한
 42번                 editor            post:read, post:write
```

当人员变更时，只需调整其所属角色即可；通过单一角色表便可核查“谁可以做什么”。然而，若例外情况增多，角色数量将急剧膨胀。例如，“仅允许修改本人撰写的文章”这类条件无法用角色表达，还需额外检查资源所有者等属性。此类基于属性（如部门、时间、所有者等）进行细粒度控制的模型称为 ABAC。

权限验证不仅限于前端隐藏按钮：当请求到达服务器时，服务器必须每次都执行检查。即使前端隐藏了按钮，用户仍可直接调用 API，因此若缺少后端验证，便会形成常见漏洞（详见 → [Web 漏洞与 OWASP](#/post/sec-owasp)）。

## 常见误解

- **密码应加密存储**：由于无需解密，故应使用哈希（慢速哈希算法）存储（详见 → [加密·哈希·认证基础](#/post/sec-authn-crypto)）。
- **JWT 是加密的**：仅签名的 JWT 对任何人都可读。
- **已登录即拥有权限**：认证与授权是独立概念，HTTP 状态码 401 与 403 含义不同。
- **持有令牌即可忽略 CORS/CSRF**：若将令牌存入 Cookie 发送，CSRF 问题依然存在；SameSite 仅为辅助手段。
- **登录请求可随意处理**：为防止暴力破解，必须实施请求次数限制（详见 → [速率限制与流量控制](#/post/infra-rate-limit)）。密钥等敏感值的存储管理请参阅 [环境变量与秘密管理](#/post/cloud-secrets)。

## 参考链接

- OWASP, Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html（涵盖 Cookie 属性、会话 ID、过期时间、重新颁发等）
- RFC 7519, JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519（涵盖结构、注册声明、签名与加密）
- RFC 6749, OAuth 2.0: https://datatracker.ietf.org/doc/html/rfc6749（涵盖四个角色、授权码流程、令牌机制）——建议阅读文档前半部分

← [概念地图](#/post/be-map)

相关文章：[API 与 REST](#/post/be-api-rest) · [请求处理流程](#/post/be-request-flow) · [环境变量与密钥管理](#/post/cloud-secrets)
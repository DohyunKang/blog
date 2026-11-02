Authentication is about verifying "who you are," while authorization is about deciding "what that person can do." Sessions and JWTs are methods for maintaining login states, OAuth is the procedure for borrowing permissions from another service, and RBAC is a way to organize permissions.

## Distinguishing Authentication and Authorization

The reason for confusion is that they always go hand in hand. The order is always the same: first, authentication confirms who the user is, and then authorization determines what that person can do based on their identity.

| | Authentication | Authorization |
|---|---|---|
| Question | Who are you? | What can you do? |
| Example | Password verification, social login | Only admins can delete members |
| HTTP Status on Failure | 401 | 403 |
| Timing | At login and for every request (identity check) | For every request |

Login happens once, but HTTP requests arrive separately for each interaction. The server does not remember previous requests ([see details → Request processing flow](#/post/be-request-flow)). Therefore, a way is needed to prove that "the person sending this request is the same one who logged in earlier," and that method is either a session or a token.

## Session-based Approach

When login succeeds, the server generates a random ID and records in its storage that "this ID belongs to user 42." It then sends only this ID to the browser via a cookie. On subsequent requests, when the browser sends the cookie, the server looks up the ID in its storage to identify the user.

```
로그인 → 서버: 세션 ID 생성, 저장소에 {ID: 사용자 42} 기록
      ← Set-Cookie: sid=랜덤값
요청   → Cookie: sid=랜덤값 → 서버가 저장소 조회 → 42번으로 처리
로그아웃 → 저장소에서 ID 삭제 (바로 무효)
```

Based on the OWASP session management documentation, here is the summary:

- User information and permissions are kept on the server and not included in the ID. The ID is just a meaningless random number.
- Cookies include `HttpOnly` (cannot be read by JavaScript), `Secure` (transmitted only over HTTPS), and `SameSite` (Strict or Lax).
- Immediately after login, a new session ID is issued and the old one is discarded to prevent attacks where an attacker uses an ID planted before login (session fixation).
- Both idle timeout and absolute expiration time are enforced by the server.

The advantage is that the server can terminate the session at will. Whether it's logout or forced logout, deleting from storage ends it immediately. The disadvantage is that the server must maintain state. If there are multiple servers, they need to share a storage, so something like Redis is usually placed in front ([see details → Cache and Redis](#/post/db-cache-redis)).

## Token-based Approach (JWT)

JWT is a method where the server does not store data but instead embeds user information into the token, signs it, and sends it to the client. The format consists of three parts joined by dots.

```
헤더 . 페이로드 . 서명
(알고리즘)  (클레임: 누구, 만료 시각 등)  (위 둘에 대한 HMAC 또는 전자서명)
```

The representative claims registered in RFC 7519 are `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiration time), `nbf` (not before), `iat` (issued at), and `jti` (token unique ID). All are optional.

When a token arrives, the server just recalculates the signature to verify it matches and checks if it has expired; no storage lookup is needed. Therefore, even with multiple servers or multiple services, verification works as long as they share the same key.

However, there are a few things to keep in mind:

- Signing prevents forgery but does not hide content. Payloads are only base64url encoded, so anyone can read them. RFC also states that the content of signed tokens is visible. Do not include sensitive data like passwords.
- Once issued, it's difficult for the server to revoke a token before expiration because there is no storage to remember "this token is invalid." Therefore, access tokens have short lifetimes (in minutes), and refresh tokens are kept separately. To revoke, you eventually need a blacklist-like storage again.
- Storage location is an issue. OWASP advises against storing tokens in `localStorage` or `sessionStorage` because if XSS is exploited even once, the token can be read. It's better to store them in cookies (HttpOnly). However, storing in cookies requires considering CSRF separately.

Comparing sessions and JWT line by line:

| | Session | JWT |
|---|---|---|
| State Storage | Server (storage) | Inside token (client) |
| Immediate Revocation | Easy | Difficult |
| Server Scalability | Requires shared storage | Only needs shared key |
| Request Size | Small (ID only) | Large (includes info) |
| Suitable For | Web apps of a single service | Multiple services, mobile, APIs |

Neither is inherently better; sessions are preferred when immediate termination is strongly required, while JWTs are more convenient when services are split. It's easy to mistakenly believe that using JWT instead of sessions automatically makes things safer, but as seen above, revocation and storage location issues arise anew.

<details>
<summary>Code I ran myself: Session ID, JWT signing/verification, RBAC (using only Python standard library)</summary>

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

Execution results (verified directly in this environment):

```
정상 토큰 검증      → {'sub': '42', 'roles': ['editor'], 'exp': ...}
roles를 admin으로 바꿔 재조립 → tampered: bad signature
만료된 토큰         → old: expired
세션 ID 길이 43, 삭제 후 조회 → False
can(editor, post:write)=True / can(editor, user:delete)=False / can(admin, user:delete)=True
```

When verifying, do not blindly trust the `alg` in the header. The reason is that servers should fix the algorithm used for comparison (there was an attack that caused signatures to be skipped using `alg: none`; this section only confirms the existence of unsecured JWTs in the RFC).

</details>

## OAuth is about delegation, not login

It's easy to view OAuth as "logging in with Google," but RFC 6749 deals with delegation. The structure involves a user (resource owner) granting an app (client) permission to use their resources (on the resource server) within a specific scope, and an authorization server issuing a token based on that approval. There are four roles involved:

| Role | Function |
|---|---|
| Resource Owner | The person who can grant access (the user) |
| Client | The app trying to access resources on behalf of the user |
| Authorization Server | Authenticates the user, obtains consent, and issues tokens |
| Resource Server | The server holding the resources; receives requests upon presenting an access token |

The most common flow is the authorization code method, which consists of five steps:

1. The client redirects the user to the authorization server, sending the client ID, requested scope, state value, and redirect URI.
2. The authorization server authenticates the user and obtains consent.
3. If consent is granted, a short-lived authorization code is returned via the redirect URI.
4. The client sends that code to the token endpoint to exchange it for a token; at this point, the client also authenticates itself.
5. An access token (and optionally a refresh token) is received.

The reason for separating code and tokens is that only the one-time code passes through the browser address bar, while the actual token is exchanged between servers. Refresh tokens are sent only to the authorization server, not to the resource server.

"Logging in with Google" actually uses OpenID Connect layered on top of OAuth to also retrieve identity information; however, we did not review the OIDC document this time.

## Permission Model: RBAC

How you define the rules for granting access is determined by the permission model. The most common is RBAC (Role-Based Access Control). Instead of assigning permissions individually to users, roles (e.g., viewer, editor, admin) are assigned, and each role holds a bundle of permissions. The `ROLE_PERMS` in the code above represents all such permissions.

```
사용자 ──(가진다)──▶ 역할 ──(포함한다)──▶ 권한
 42번                 editor            post:read, post:write
```

When personnel change, only their roles need updating, and "who can do what" can be checked against a single role matrix. However, exceptions can cause role explosion. Conditions like "only edit posts you wrote yourself" cannot be expressed via roles alone and require separate checks based on resource ownership or other attributes. Generalizing such conditions using attributes (department, time, owner, etc.) is called ABAC.

Access control checks do not end with hiding buttons in the UI. Every request must be validated by the server upon arrival. Even if a button is hidden, directly calling the API bypasses that protection, making this a common vulnerability if omitted ([see details → Web Vulnerabilities and OWASP](#/post/sec-owasp)).

## Common Misconceptions

- Passwords are stored encrypted: Since decryption is unnecessary, they are stored as hashes (slow hashes) ([see details → Encryption, Hashing, and Authentication Basics](#/post/sec-authn-crypto)).
- JWTs are encrypted: A signed-only JWT can be read by anyone.
- If you're logged in, you have permissions: Authentication and authorization are separate; 401 and 403 errors differ accordingly.
- Having a token means CORS or CSRF don't matter: If tokens are sent via cookies, CSRF becomes an issue again, and SameSite is merely an auxiliary measure.
- Login attempts are simply accepted: Rate limiting is required to prevent brute-force attacks ([see details → Rate Limiting and Traffic Control](#/post/infra-rate-limit)). Storing secrets like signing keys requires careful management ([see details → Environment Variables and Secret Management](#/post/cloud-secrets)).

## Reference Links

- OWASP, Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (cookie attributes, session ID, expiration, reissuance)
- RFC 7519, JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519 (structure, registered claims, signing and encryption)
- RFC 6749, OAuth 2.0: https://datatracker.ietf.org/doc/html/rfc6749 (four roles, authorization code flow, tokens) — only the first half of the document was reviewed

← [Concept Map](#/post/be-map)

Related posts: [API and REST](#/post/be-api-rest) · [Request Processing Flow](#/post/be-request-flow) · [Environment Variables and Secrets Management](#/post/cloud-secrets)
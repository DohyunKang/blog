인증은 "너 누구냐"를 확인하는 일이고, 인가는 "그 사람이 이걸 해도 되냐"를 정하는 일이다. 세션과 JWT는 로그인 상태를 유지하는 방법이고, OAuth는 남의 서비스에 권한을 빌려주는 절차이고, RBAC는 권한을 정리하는 방식이었다.

## 인증과 인가부터 나누기

헷갈리는 이유는 둘이 항상 붙어 다녀서다. 순서는 늘 같다. 먼저 인증으로 사용자가 누군지 확정하고, 그 사람 정보로 인가를 판단한다.

| | 인증(Authentication) | 인가(Authorization) |
|---|---|---|
| 질문 | 누구인가 | 무엇을 할 수 있나 |
| 예 | 비밀번호 확인, 소셜 로그인 | 관리자만 회원 삭제 가능 |
| 실패 시 HTTP 상태 | 401 | 403 |
| 시점 | 로그인할 때, 그리고 요청마다 신원 확인 | 요청마다 |

로그인은 한 번이지만 HTTP는 요청마다 따로 도착한다. 서버는 앞 요청을 기억하지 않는다([자세히 → 요청이 처리되는 흐름](#/post/be-request-flow)). 그래서 "이 요청을 보낸 사람이 아까 로그인한 그 사람"임을 매번 증명할 방법이 필요하고, 그 방법이 세션 아니면 토큰이다.

## 세션 방식

서버가 로그인에 성공하면 무작위 ID를 만들어 서버 쪽 저장소에 "이 ID는 42번 사용자"라고 적어 둔다. 그리고 그 ID만 쿠키로 브라우저에 준다. 이후 요청마다 브라우저가 쿠키를 보내면 서버가 저장소에서 ID를 찾아 사용자를 안다.

```
로그인 → 서버: 세션 ID 생성, 저장소에 {ID: 사용자 42} 기록
      ← Set-Cookie: sid=랜덤값
요청   → Cookie: sid=랜덤값 → 서버가 저장소 조회 → 42번으로 처리
로그아웃 → 저장소에서 ID 삭제 (바로 무효)
```

OWASP 세션 관리 문서 기준으로 정리하면 이렇다.

- 사용자 정보와 권한은 서버에 두고 ID에는 넣지 않는다. ID는 의미 없는 난수다.
- 쿠키에는 `HttpOnly`(자바스크립트가 못 읽음), `Secure`(HTTPS로만 전송), `SameSite`(Strict 또는 Lax)를 붙인다.
- 로그인 직후에는 세션 ID를 새로 발급하고 옛 ID는 폐기한다. 로그인 전에 심어 둔 ID를 이어 쓰게 하는 공격(세션 고정)을 막기 위해서다.
- 유휴 시간 제한과 절대 만료 시간을 둘 다 서버에서 강제한다.

장점은 서버가 마음대로 끊을 수 있다는 점이다. 로그아웃이든 강제 로그아웃이든 저장소에서 지우면 즉시 끝난다. 단점은 서버가 상태를 들고 있어야 한다는 점이다. 서버가 여러 대면 저장소를 공유해야 해서 보통 Redis 같은 걸 앞에 둔다([자세히 → 캐시와 Redis](#/post/db-cache-redis)).

## 토큰 방식(JWT)

JWT는 서버가 저장하지 않고, 사용자 정보를 토큰 안에 넣어서 서명해 클라이언트에 주는 방식이다. 형태는 점으로 이어진 세 덩어리다.

```
헤더 . 페이로드 . 서명
(알고리즘)  (클레임: 누구, 만료 시각 등)  (위 둘에 대한 HMAC 또는 전자서명)
```

RFC 7519에 등록된 대표 클레임은 `iss`(발급자), `sub`(주체), `aud`(받는 쪽), `exp`(만료 시각), `nbf`(이 시각 전엔 무효), `iat`(발급 시각), `jti`(토큰 고유 ID)다. 전부 선택 항목이다.

서버는 토큰이 오면 서명을 다시 계산해서 맞는지, 만료 안 됐는지만 보면 된다. 저장소 조회가 없다. 그래서 서버가 여러 대여도, 서비스가 여러 개여도 같은 키만 공유하면 검증된다.

다만 알아 둘 게 몇 가지 있었다.

- 서명은 위조를 막을 뿐 내용을 숨기지 않는다. 페이로드는 base64url로 인코딩만 된 거라 누구나 읽는다. RFC도 서명 토큰은 내용이 보인다고 적는다. 비밀번호 같은 건 넣지 않는다.
- 한 번 발급하면 만료 전에 서버가 취소하기 어렵다. 저장소가 없으니 "이 토큰 무효"를 기억할 곳이 없어서다. 그래서 액세스 토큰은 수명을 짧게(분 단위) 잡고, 갱신용 리프레시 토큰을 따로 둔다. 취소하려면 결국 블랙리스트 같은 저장소가 다시 생긴다.
- 저장 위치가 문제다. OWASP는 `localStorage`나 `sessionStorage`에 토큰을 두지 말라고 한다. XSS가 하나만 뚫려도 읽히기 때문이다. 쿠키(HttpOnly)에 두는 쪽이 낫다는 얘기다. 쿠키에 두면 CSRF를 따로 생각해야 한다.

세션과 JWT를 한 줄씩 비교하면 이렇다.

| | 세션 | JWT |
|---|---|---|
| 상태 저장 | 서버(저장소) | 토큰 안(클라이언트) |
| 즉시 무효화 | 쉬움 | 어려움 |
| 서버 확장 | 저장소 공유 필요 | 키만 공유 |
| 요청 크기 | 작음(ID만) | 큼(정보 포함) |
| 잘 맞는 곳 | 한 서비스의 웹 앱 | 여러 서비스·모바일·API |

어느 쪽이 더 낫다는 건 없고, 즉시 끊어야 하는 요구가 강하면 세션 쪽, 서비스가 쪼개져 있으면 JWT 쪽이 편했다. 세션 대신 JWT를 쓰면 저절로 더 안전해진다고 오해하기 쉬운데, 위에서 본 대로 취소와 저장 위치 문제가 새로 생긴다.

<details>
<summary>직접 돌려 본 코드: 세션 ID, JWT 서명·검증, RBAC (Python 표준 라이브러리만)</summary>

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

실행 결과(이 환경에서 직접 확인):

```
정상 토큰 검증      → {'sub': '42', 'roles': ['editor'], 'exp': ...}
roles를 admin으로 바꿔 재조립 → tampered: bad signature
만료된 토큰         → old: expired
세션 ID 길이 43, 삭제 후 조회 → False
can(editor, post:write)=True / can(editor, user:delete)=False / can(admin, user:delete)=True
```

검증 때 헤더의 `alg`를 그대로 믿으면 안 된다. 서버가 쓸 알고리즘을 고정해 두고 비교하는 이유다(과거에 `alg: none`으로 서명을 건너뛰게 만드는 공격이 있었다고 한다. 이 부분은 RFC에서 unsecured JWT가 존재한다는 것까지만 확인했다).

</details>

## OAuth는 로그인이 아니라 권한 위임

OAuth를 "구글로 로그인"과 같은 걸로 보기 쉬운데, RFC 6749가 다루는 건 위임이다. 사용자(resource owner)가 어떤 앱(client)에게 "내 자원(resource server에 있는 것)을 이 범위만큼 쓰게 해 줘도 된다"고 승인하고, 그 승인을 인가 서버(authorization server)가 토큰으로 바꿔 주는 구조다. 역할이 네 개다.

| 역할 | 하는 일 |
|---|---|
| 리소스 소유자 | 접근을 허락할 수 있는 사람(사용자) |
| 클라이언트 | 사용자 대신 자원에 접근하려는 앱 |
| 인가 서버 | 사용자를 인증하고 동의를 받아 토큰을 발급 |
| 리소스 서버 | 자원을 가진 서버, 액세스 토큰을 보고 요청을 받음 |

가장 흔한 인가 코드(authorization code) 방식의 흐름은 다섯 단계다.

1. 클라이언트가 사용자를 인가 서버로 보낸다. 클라이언트 ID, 요청 범위(scope), state 값, 돌아올 주소(redirect URI)를 같이 보낸다.
2. 인가 서버가 사용자를 인증하고 동의 여부를 받는다.
3. 동의하면 짧게 사는 인가 코드를 redirect URI로 돌려준다.
4. 클라이언트가 그 코드를 토큰 엔드포인트로 보내 토큰으로 바꾼다. 이때 클라이언트 자신도 인증한다.
5. 액세스 토큰(과 선택적으로 리프레시 토큰)을 받는다.

코드와 토큰을 나누는 이유는, 브라우저 주소창을 거치는 건 일회용 코드뿐이고 진짜 토큰은 서버끼리 주고받게 하려는 것으로 이해했다. 리프레시 토큰은 인가 서버에만 보내고 리소스 서버에는 보내지 않는다.

"구글로 로그인"이 실제로는 OAuth 위에 얹은 OpenID Connect로 신원 정보까지 받는 건데, OIDC는 이번에 문서를 열어 보지 않았다.

## 권한 모델: RBAC

인가의 규칙을 어떻게 적을지가 권한 모델이다. 가장 흔한 게 RBAC(역할 기반 접근 제어)다. 사용자에게 권한을 하나씩 주지 않고 역할(viewer, editor, admin)을 주고, 역할이 권한 묶음을 갖는다. 위 코드의 `ROLE_PERMS`가 전부다.

```
사용자 ──(가진다)──▶ 역할 ──(포함한다)──▶ 권한
 42번                 editor            post:read, post:write
```

사람이 바뀌어도 역할만 바꾸면 되고, "누가 뭘 할 수 있나"를 역할표 하나로 점검할 수 있다. 대신 예외가 늘면 역할이 폭발한다. "자기가 쓴 글만 수정 가능"은 역할로는 표현이 안 돼서, 자원의 주인이 누구인지 같은 조건을 따로 검사해야 한다. 그런 조건을 속성(부서, 시간, 소유자 등)으로 일반화한 게 ABAC이라는 이름으로 불린다.

인가 검사는 화면에서 버튼을 숨기는 걸로 끝나지 않는다. 요청이 서버에 도착했을 때 서버가 매번 검사해야 한다. 버튼을 숨겨도 직접 API를 호출하면 그만이기 때문이다. 이게 빠지면 흔한 취약점이 된다([자세히 → 웹 취약점과 OWASP](#/post/sec-owasp)).

## 흔한 오해

- 비밀번호는 암호화해서 저장한다: 복호화할 필요가 없으니 해시(느린 해시)로 저장한다([자세히 → 암호화·해시·인증 기초](#/post/sec-authn-crypto)).
- JWT는 암호화돼 있다: 서명만 된 JWT는 누구나 읽는다.
- 로그인했으니 권한도 있다: 인증과 인가는 별개고, 401과 403도 다르다.
- 토큰이 있으면 CORS나 CSRF는 신경 안 써도 된다: 쿠키에 담아 보내면 CSRF가 다시 문제가 되고, SameSite는 보조 수단이다.
- 로그인 시도는 그냥 받는다: 무차별 대입을 막으려면 횟수 제한이 따로 필요하다([자세히 → 레이트 리밋과 트래픽 제어](#/post/infra-rate-limit)). 서명 키 같은 비밀값 보관은 [자세히 → 환경변수와 시크릿 관리](#/post/cloud-secrets).

## 근거 링크

- OWASP, Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html (쿠키 속성, 세션 ID, 만료, 재발급)
- RFC 7519, JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519 (구조, 등록 클레임, 서명과 암호화)
- RFC 6749, OAuth 2.0: https://datatracker.ietf.org/doc/html/rfc6749 (네 역할, 인가 코드 흐름, 토큰) — 문서 앞 약 절반만 읽음

← [개념 지도로](#/post/be-map)

관련 글: [API와 REST](#/post/be-api-rest) · [요청이 처리되는 흐름](#/post/be-request-flow) · [환경변수와 시크릿 관리](#/post/cloud-secrets)

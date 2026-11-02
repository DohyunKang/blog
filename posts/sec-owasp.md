OWASP는 웹 보안을 다루는 비영리 재단이고, Top 10은 그곳에서 정리하는 "웹 앱에서 자주 터지는 위험 10가지" 목록이다. 이 글에서는 목록 자체보다 그 안에 들어 있는 대표 공격 셋, SQL 인젝션·XSS·CSRF가 왜 되는지와 어떻게 막는지를 코드로 확인하며 정리했다.

## OWASP Top 10은 뭔가

공격 목록이 아니라 위험 범주 목록이다. 실제 사고 데이터를 모아 몇 년마다 갱신한다. 지금 홈페이지(top10.owasp.org)에 올라와 있는 건 2025년판이고, 범주는 이렇다.

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

SQL 인젝션과 XSS는 둘 다 A05 Injection 쪽 이야기이고, CSRF는 A01 접근 통제나 A07 인증 쪽과 이어서 볼 수 있다(어느 범주에 넣는지는 판마다 다르다). 이 표는 외울 필요는 없고, "내 서비스가 어디가 약한지 체크리스트로 쓰는 용도"라고 보면 된다. 인증·인가 자체는 [자세히 → 인증과 인가](#/post/be-auth)에, 암호화·해시는 [자세히 → 암호화·해시·인증 기초](#/post/sec-authn-crypto)에 있다.

## 세 공격의 공통점

셋 다 겉모양이 다르지만 뿌리는 비슷하다. 프로그램이 "이건 데이터다"라고 생각한 값이 어딘가에서 "이건 명령이다"로 해석되면 뚫린다.

| 공격 | 데이터가 명령으로 해석되는 곳 | 피해 대상 |
|---|---|---|
| SQL 인젝션 | DB가 SQL 문장을 해석할 때 | 서버의 DB |
| XSS | 브라우저가 HTML·JS를 해석할 때 | 다른 사용자의 브라우저 |
| CSRF | 서버가 "이 요청은 로그인한 사용자 의지"라고 믿을 때 | 로그인한 사용자 |

앞의 둘은 입력이 코드 자리로 들어가는 문제이고, CSRF는 조금 다르게 요청을 누가 보냈는지를 속이는 문제다.

## SQL 인젝션

### 원리

쿼리를 문자열 이어 붙이기로 만들면 사용자가 넣은 따옴표가 SQL 문법의 일부가 된다. SQL 자체는 [자세히 → 관계형 DB와 SQL 기본](#/post/db-rdb-sql)에 있다.

```python
# 위험한 코드
q = f"SELECT name FROM users WHERE name='{name}' AND pw='{pw}'"
```

`name`에 `admin' --`을 넣으면 쿼리가 이렇게 된다.

```sql
SELECT name FROM users WHERE name='admin' --' AND pw='아무거나'
```

`--` 뒤는 주석이라 비밀번호 조건이 통째로 사라진다. 비밀번호 칸에 `' OR '1'='1`을 넣는 변형은 조건이 항상 참이 돼서 전원이 조회된다.

### 방어

OWASP SQL Injection Prevention 치트시트가 드는 1순위는 파라미터화된 쿼리(prepared statement)다. SQL 구조와 값을 따로 DB에 전달해서, 값은 어떤 내용이어도 문법이 될 수 없게 한다. 이어서 저장 프로시저(그 안에서 또 문자열을 이어 붙이면 똑같이 뚫린다), 허용 목록 검증, 이스케이프 순이다. 이스케이프는 DB 종류와 설정에 따라 동작이 달라서 "파라미터 바인딩의 대체로 쓰지 말라"고 되어 있다.

```python
# 안전한 코드
db.execute("SELECT name FROM users WHERE name=? AND pw=?", (name, pw))
```

파라미터로 못 쓰는 자리가 있다. 컬럼명이나 정렬 방향(`ORDER BY`)은 값이 아니라 SQL 구조라서 바인딩이 안 된다. 이때는 사용자 입력을 그대로 쓰지 않고, 허용 목록에 있는 값만 통과시킨다.

<details>
<summary>실행해 본 데모 (sqlite3, 전체 코드와 결과)</summary>

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

실행 결과는 이랬다.

```
bad  [('admin',)]            <- 비밀번호 모르는데 admin으로 로그인됨
good []
bad2 [('kim',), ('admin',)]  <- 전원 조회됨
good2 []
[('admin',), ('kim',)]
거부: bad column
```

</details>

## XSS (크로스 사이트 스크립팅)

### 원리

사용자가 입력한 글을 페이지에 그대로 끼워 넣었을 때, 그 안에 `<script>`가 있으면 브라우저는 서버가 보낸 정상 코드와 구분하지 못하고 실행한다. 브라우저가 HTML을 읽는 과정은 [자세히 → 브라우저가 화면을 그리는 과정](#/post/fe-browser-render)에 있다.

게시판 댓글에 스크립트를 넣어 두면 그 글을 보는 모든 사람의 브라우저에서 실행된다. 그 스크립트는 해당 사이트의 권한으로 돌기 때문에 쿠키·토큰을 읽거나 사용자 대신 요청을 보낼 수 있다. 종류는 보통 셋으로 나눈다.

- 저장형: 악성 입력이 DB에 저장돼 글을 볼 때마다 실행
- 반사형: URL 파라미터가 응답에 그대로 찍혀서, 링크를 누른 사람만 실행
- DOM 기반: 서버는 관여하지 않고 클라이언트 JS가 입력을 `innerHTML` 같은 곳에 넣으며 실행

### 방어

핵심은 출력할 때, 출력하는 위치에 맞게 인코딩하는 것이다. OWASP XSS 치트시트도 HTML 본문, 속성, JS, CSS, URL이 위치마다 인코딩 방식이 다르다고 한다. 위험한 위치(`<script>` 안, 스타일 안, 이벤트 핸들러 문자열 등)에는 아예 사용자 값을 넣지 않는 쪽이 안전하다.

```python
import html
comment = '<script>alert(1)</script>'
print(f"<p>{html.escape(comment)}</p>")
# <p>&lt;script&gt;alert(1)&lt;/script&gt;</p>
```

글자로 보이기만 하고 실행되지 않는다. 실제로는 React·Vue 같은 프레임워크나 Jinja 같은 템플릿 엔진이 기본으로 이스케이프해 주기 때문에, 문제는 그 기본값을 우회할 때(`innerHTML`, `dangerouslySetInnerHTML`, `v-html`, `|safe`) 생긴다. 치트시트는 `innerHTML`을 기본적으로 위험한 것으로 보고 `textContent` 같은 텍스트용 API를 먼저 쓰라고 한다. 사용자가 쓴 HTML을 꼭 보여 줘야 하면 DOMPurify 같은 검증된 라이브러리로 정화한 뒤에 넣는다.

CSP(Content-Security-Policy 헤더)는 허용한 출처의 스크립트만 실행하게 하는 2차 방어선이다. 치트시트에서도 주 방어가 아니라 보조 방어로 둔다. 인코딩을 먼저 하고 CSP를 겹친다.

## CSRF (사이트 간 요청 위조)

### 원리

브라우저는 어떤 사이트로 요청을 보낼 때, 그 요청이 어느 페이지에서 시작됐든 해당 사이트의 쿠키를 자동으로 붙인다. 은행에 로그인해 둔 상태에서 악성 페이지를 열면, 그 페이지가 은행으로 송금 요청을 쏘게 만들 수 있다. 쿠키가 같이 가니까 서버는 정상 사용자의 요청으로 본다. 공격자가 응답을 볼 수는 없지만 "상태를 바꾸는 요청"은 성공한다.

```html
<!-- 악성 페이지에 숨겨 둔 폼 -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="1000000">
</form>
<script>document.forms[0].submit()</script>
```

세션 쿠키에 대해서는 [자세히 → 인증과 인가](#/post/be-auth)에서 다뤘다.

### 방어

OWASP CSRF 치트시트가 정리한 것은 크게 셋이다.

1. 동기화 토큰(synchronizer token): 서버가 세션에 묶인 예측 불가능한 토큰을 만들어 폼이나 응답에 넣어 보내고, 상태를 바꾸는 요청마다 토큰이 맞는지 확인한다. 악성 페이지는 이 토큰을 모르기 때문에 요청이 거부된다.
2. 더블 서브밋 쿠키: 서버에 저장하지 않고, 같은 값을 쿠키와 요청 헤더·파라미터로 둘 다 보내 일치하는지 본다. 치트시트는 세션에 묶은 서명(HMAC) 방식을 권하고, 서명 없는 단순 방식은 하위 도메인에서 쿠키를 심을 수 있으면 뚫리므로 권하지 않는다.
3. SameSite 쿠키 속성: 다른 사이트에서 시작된 요청에는 쿠키를 안 보내게 한다. 다만 `Lax`는 최상위 GET 이동에는 쿠키를 보내서, GET으로 상태를 바꾸는 API가 있으면 뚫린다. 치트시트는 단독 방어가 아니라 토큰과 겹치는 보조 방어로 보고, 브라우저마다 기본값이 달라서 명시적으로 지정하라고 한다.

그래서 GET은 읽기만 하고 변경은 POST·PUT·DELETE로 두는 규칙이 중요하다([자세히 → API와 REST](#/post/be-api-rest)). 토큰은 이렇게 만들고 검증할 수 있다.

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

한 가지 주의할 점은 XSS가 뚫려 있으면 CSRF 방어가 의미가 없다는 것이다. 치트시트에도 XSS가 모든 CSRF 방어를 무력화할 수 있다고 적혀 있다. 같은 출처에서 도는 스크립트는 토큰을 읽어서 정상 요청을 만들 수 있기 때문이다. 그래서 XSS 방어가 먼저다.

## 흔한 오해

- 입력 검증만 하면 된다: 이름에 `O'Brien`처럼 따옴표가 들어가는 정상 입력이 있어서 특수문자를 막는 방식은 한계가 있다. 입력은 검증하고, 출력과 쿼리는 문맥에 맞게 처리한다. 이 둘은 따로 해야 한다.
- 프레임워크를 쓰니 안전하다: 기본값 안에서만 그렇다. 위에 적었듯 `innerHTML`류 우회, 문자열로 만든 쿼리, ORM의 raw 쿼리가 구멍이 된다.
- HTTPS면 막힌다: HTTPS는 중간에서 엿보는 걸 막는 것이고, 위 세 공격은 정상 연결 위에서 일어난다.
- 내부 서비스라 괜찮다: 내부망 사용자의 브라우저도 악성 페이지를 열 수 있어서 CSRF·XSS는 내부 서비스에도 해당한다.

## 정리

세 공격을 나란히 놓으면 방어 방향이 맞아떨어진다. SQL 인젝션은 쿼리와 값을 분리하고, XSS는 출력 위치에 맞게 인코딩하고, CSRF는 "이 요청이 진짜 이 사용자의 의도"라는 증거(토큰)를 요구한다. 키가 새는 문제는 [자세히 → 키·시크릿 관리](#/post/sec-keys)에, AI 앱에서 같은 원리(데이터가 명령으로 읽힘)가 나타나는 건 [자세히 → 프롬프트 인젝션과 AI 보안](#/post/sec-prompt-injection)에 있다.

## 확인 못 함

- OWASP Top 10:2025의 변경 사항(2021 대비 어떤 범주가 새로 생기고 합쳐졌는지)은 소개 페이지를 읽지 못해 확인 못 함.
- 범주별 세부 설명 페이지(A01~A10 각각)는 열어 보지 않음. 위 표는 메인 페이지의 목록만 근거.
- 위 데모 코드 중 SQL·XSS 이스케이프·CSRF 토큰은 실행 확인함. 악성 HTML 폼 예시와 CSP 설정은 실행 확인 못 함.

## 근거 링크

- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- SQL Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Cross Site Scripting Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Cross-Site Request Forgery Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

← [개념 지도로](#/post/sec-map)

관련 글: [인증과 인가](#/post/be-auth) · [키·시크릿 관리](#/post/sec-keys) · [프롬프트 인젝션과 AI 보안](#/post/sec-prompt-injection)

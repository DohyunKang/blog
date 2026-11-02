CDN은 원본 서버의 응답을 사용자 가까운 곳(엣지)에 복사해 두었다가 대신 내주는 캐시 서버 묶음이다. 빨라지는 건 덤이고, 실제로 신경 쓸 일은 복사본을 얼마나 오래 믿을지를 `Cache-Control` 헤더로 정하는 것과, 틀린 복사본이 남았을 때 치우는 방법이다.

## 쉬운 말로 먼저

서울에 있는 서버를 미국 사용자가 쓰면 요청마다 바다를 건넌다. 이미지 하나 받을 때마다 그러면 느리다. 그래서 같은 이미지를 미국에도 한 부 두고, 미국 사용자는 거기서 받게 한다. 이 복사본을 두는 서버가 CDN의 엣지다. 요청이 어떤 순서로 거치는지는 [자세히 → 요청 하나가 거치는 길](#/post/infra-request-journey)에 있다.

복사본이 있으면 원본 서버는 덜 바쁘다. 사용자 10만 명이 같은 로고를 받아도 원본에는 엣지 몇 곳만 한 번씩 물으러 온다. 속도와 서버 부담 두 가지가 한 번에 줄어서 정적 파일 앞에는 거의 CDN을 둔다.

## 캐시 계층이 여러 겹이다

캐시는 한 군데가 아니라 겹겹이다.

| 계층 | 누가 쓰나 | 예 |
|---|---|---|
| 브라우저 캐시 | 그 사용자 한 명 (private 캐시) | 디스크에 저장된 JS 파일 |
| CDN 엣지 | 여러 사용자 (shared 캐시) | Cloudflare 같은 곳의 서버 |
| 원본 앞단·앱 캐시 | 서버 내부 | Redis 등, [자세히 → 캐시와 Redis](#/post/db-cache-redis) |

MDN은 캐시를 크게 둘로 나눈다. 한 사람 전용인 private 캐시(주로 브라우저)와 여러 사람이 같이 쓰는 shared 캐시다. CDN은 shared 쪽의 "관리형 캐시"로 분류된다. 이 구분이 중요한 이유는 아래 `private`와 `s-maxage`에서 나온다.

## 캐시 헤더: 복사본을 얼마나 믿을지

원본이 응답에 `Cache-Control`을 붙여서 "이건 이렇게 다뤄라"를 알려 준다. 자주 보는 것만 적는다.

- `max-age=초`: 그 시간 동안은 신선하다. 이 동안은 원본에 묻지 않고 복사본을 그대로 쓴다.
- `s-maxage=초`: shared 캐시(CDN)에만 적용되는 시간. shared 캐시에서는 `max-age`보다 우선한다. 브라우저는 무시한다. `max-age=60, s-maxage=3600`이면 브라우저는 60초, CDN은 1시간 믿는다.
- `no-cache`: 이름과 달리 저장은 해도 된다. 다만 쓰기 전에 매번 원본에 "아직 유효하냐"고 확인해야 한다.
- `no-store`: 어디에도 저장하지 말라는 뜻이다.
- `private`: 브라우저만 저장하고 CDN 같은 shared 캐시는 저장하지 말라는 뜻이다.
- `public`: Authorization 헤더가 있는 요청의 응답도 저장해도 된다는 뜻이 된다. 필요할 때만 쓰라고 MDN이 적는다.
- `immutable`: 이 파일은 절대 안 바뀐다. 새로고침해도 확인하지 않는다.

`no-cache`와 `no-store`를 처음에 반대로 이해하기 쉽다. 저장 자체를 막는 건 `no-store`다. `no-cache`는 "저장은 하되 쓸 때마다 확인"이다.

### 낡았을 때: 조건부 요청

신선 시간이 지나면 복사본은 stale(낡음)이 된다. 이때 바로 버리지 않고 원본에 묻는다. 서버가 `ETag: "33a64df5"` 같은 값(내용 지문 같은 것)을 줬다면 캐시는 `If-None-Match: "33a64df5"`를 붙여 다시 요청한다. 안 바뀌었으면 서버는 본문 없이 `304 Not Modified`만 돌려주고, 캐시는 기존 복사본을 다시 신선하게 쓴다. 바뀌었으면 `200`과 새 본문이 온다. 본문을 안 보내는 만큼 싸다.

### stale-while-revalidate

web.dev 예시는 `Cache-Control: max-age=1, stale-while-revalidate=59`다. 1초까지는 신선해서 그냥 쓴다. 1초에서 60초 사이에는 낡은 복사본을 먼저 내주고 뒤에서 원본에 확인해 복사본을 갈아 끼운다. 60초를 넘으면 낡은 걸 못 쓰고 네트워크를 기다린다. 사용자는 기다리지 않고, 갱신은 뒤에서 일어난다. 브라우저가 이 지시어를 지원하지 않으면 `max-age`만 따른다고 한다.

원본이 죽었을 때는 `stale-if-error`가 있다. `max-age=604800, stale-if-error=86400`이면 7일 신선하고, 그 뒤 하루는 500·502·503·504 같은 오류가 날 때 낡은 복사본을 대신 내준다.

## 무효화: 틀린 복사본 치우기

복사본을 믿는 시간이 길수록 원본을 고쳐도 사용자는 옛것을 본다. 해결 방법은 크게 두 가지다.

첫째는 파일 이름을 바꾸는 것(cache busting). MDN은 `bundle.v123.js`처럼 버전을 넣거나 내용 해시를 파일명에 넣는 방식을 든다. 내용이 바뀌면 URL이 달라지니 옛 복사본은 그냥 안 쓰이게 된다. 그래서 이런 파일에는 `Cache-Control: public, max-age=31536000, immutable`(1년)을 줘도 안전하다.

둘째는 CDN에 직접 지우라고 하는 것(purge). Cloudflare 문서 기준으로 URL 하나 단위, 전체, 캐시 태그, 호스트명, URL 접두사 단위 등이 있다. 문서는 URL 단위를 권장하고, 전체 삭제는 넓게 바뀔 때만 쓰라고 한다. 지우는 대신 "낡음 표시"만 하는 invalidation도 있어서, 다음 요청 때 원본에 확인하고 안 바뀐 건 그대로 쓴다. 요청 한도도 플랜별로 있다(예: Free 플랜은 전체·태그·호스트·접두사 삭제가 분당 5회). 삭제 요청에 200이 와도 "접수됨"일 뿐이라, 확인하려면 다시 받아서 `CF-Cache-Status`가 `HIT`가 아닌지 봐야 한다.

간단히 직접 돌려 본 시뮬레이션이 있다.

<details>
<summary>자세한 풀이: 엣지 캐시를 흉내 낸 파이썬 코드와 결과 (직접 실행함)</summary>

TTL 60초짜리 엣지를 단순화해서 만들었다. 실제 CDN 동작이 아니라 개념 확인용이다.

```python
class Edge:
    def __init__(s): s.c={}; s.hit=s.miss=0
    def get(s,url,now,origin):
        e=s.c.get(url)
        if e and now<e[1]: s.hit+=1; return e[0],'HIT'
        s.miss+=1; body,ttl=origin(url); s.c[url]=(body,now+ttl); return body,'MISS'
    def purge(s,url): s.c.pop(url,None)

ver={'v':1}
def origin(url): return (f"{url} content-v{ver['v']}", 60)
e=Edge()
for t in [0,10,20,59,61,62]:
    print(t,e.get('/app.js',t,origin))
ver['v']=2                       # 원본 배포
print(63,e.get('/app.js',63,origin))   # 아직 옛 복사본
e.purge('/app.js')
print(64,e.get('/app.js',64,origin))   # 지운 뒤 새 내용
```

결과는 이랬다.

```
0  MISS  v1
10 HIT   v1
20 HIT   v1
59 HIT   v1
61 MISS  v1   (TTL 끝나서 원본에 다시 감)
62 HIT   v1
63 HIT   v1   <- 원본은 v2인데 옛것을 내줌
64 MISS  v2   <- purge 뒤
```

63초에 원본이 이미 v2인데 엣지가 v1을 내주는 게 무효화가 필요한 이유다. 이 시뮬레이션에서 적중률은 8번 중 5번, 0.625였다.

</details>

## 정적과 동적을 나눠서 둔다

CDN에 뭘 맡길지는 파일 성격으로 가른다.

| | 정적 (이미지·JS·CSS·폰트) | 동적 (API 응답·로그인 후 페이지) |
|---|---|---|
| 사용자마다 다름 | 아니오 | 예 |
| CDN 캐시 | 길게, 해시 파일명 + immutable | 보통 안 함, 하더라도 짧게 |
| 헤더 예 | `public, max-age=31536000, immutable` | `private` 또는 `no-store` |

HTML은 중간이다. 파일 이름을 바꿔서 갱신할 수가 없으니, MDN은 HTML에 `no-cache` + `ETag`(매번 확인)를 기본으로 권한다. 사용자별 내용이면 `private`을 더한다. 그리고 HTML이 가리키는 JS·CSS는 해시 이름으로 길게 캐시한다. HTML은 매번 확인하고 그 안의 파일은 오래 쓰는 조합이다. 페이지를 서버에서 만드는지 브라우저에서 만드는지에 따라 캐시 가능 범위가 달라지는 이야기는 [자세히 → 렌더링 방식](#/post/fe-rendering-modes)에 이어진다.

Cloudflare는 기본으로 파일 확장자를 보고 캐시하고, HTML과 JSON은 기본으로 캐시하지 않는다고 문서에 적혀 있다. 더 캐시하려면 Cache Rule을 따로 만든다. 그리고 `Set-Cookie`가 응답에 있거나, `private`·`no-store`·`no-cache`·`max-age=0`이 붙었거나, GET이 아닌 요청이면 캐시하지 않는다. 쿠키 하나 때문에 캐시가 막히는 일이 흔해 보인다.

## CDN 쪽에서 상태 보기

CDN 응답 헤더로 캐시가 어떻게 처리됐는지 볼 수 있다. Cloudflare의 `CF-Cache-Status` 값은 이렇다.

| 값 | 뜻 |
|---|---|
| HIT | 캐시에 있어서 거기서 내줌 |
| MISS | 캐시 대상인데 없어서 원본에서 가져옴 |
| EXPIRED | 복사본이 낡아서 원본에서 새로 받음 |
| REVALIDATED | 원본이 "아직 유효"라고 확인해 줘서 복사본을 내줌 |
| STALE | 원본에 못 닿아서 낡은 복사본을 내줌 |
| UPDATING | 낡은 걸 내주면서 뒤에서 갱신 중 |
| DYNAMIC | 캐시 대상이 아니라서 곧바로 원본으로 감 |
| BYPASS | 캐시 대상이었지만 원본이 캐시 불가로 표시해서 저장 안 함 |

로그인한 사용자 페이지가 `HIT`로 나오면 위험 신호다. 다른 사람 화면이 내려갈 수 있다. MDN도 개인화된 내용은 shared 캐시에 가면 안 되고, 쿠키가 있다고 자동으로 private이 되는 게 아니니 `Cache-Control: private`을 직접 붙이라고 한다. `Vary`를 쿠키에 걸어 구분하려는 방식도 권하지 않는다고 한다.

## 흔한 오해

- `no-cache`는 캐시하지 말라는 뜻이다: 아니다. 저장하고 매번 확인하라는 뜻이다. 저장 금지는 `no-store`다.
- 캐시하면 항상 빠르다: 첫 요청은 MISS라 원본까지 간다. 요청이 거의 반복되지 않는 URL은 적중률이 낮아서 이득이 작다.
- 헤더가 없으면 캐시 안 된다: 아니다. `Last-Modified`만 있으면 클라이언트가 나이의 10% 정도를 신선하다고 추측해서 캐시할 수 있다고 MDN이 적는다. 그래서 헤더는 항상 명시하라고 한다. Cloudflare도 `Cache-Control`이 없으면 200 응답을 120분 캐시하는 기본 규칙이 있다.
- purge하면 즉시 모든 사용자에게 반영된다: 삭제 요청의 200은 접수 확인이다. 브라우저 안의 복사본은 CDN 삭제로 지워지지 않는다. 이 부분은 문서에서 직접 확인한 문장은 아니고, private 캐시가 별개라는 구분에서 미루어 본 것이다.
- 캐시 키는 URL만 본다: 기본은 URL이지만 `Vary` 헤더에 적은 요청 헤더가 키에 더해진다. `Vary: Accept-Language`면 언어별로 따로 저장된다. `Vary: User-Agent`는 종류가 너무 많아 적중률이 무너지니 피하라고 한다.

## 이어지는 얘기

AI 쪽에도 같은 발상이 있다. 같은 프롬프트 앞부분을 다시 계산하지 않는 [자세히 → 프롬프트 캐싱](#/post/ai-prompt-caching)이 그렇다. 앞단에서 요청을 나누는 [자세히 → 로드 밸런서](#/post/infra-load-balancer)와 함께 놓고 보면 "원본까지 가는 요청을 줄인다"는 같은 목적이 보인다. 웹 성능 쪽 관점은 [자세히 → 프론트엔드 성능](#/post/fe-performance)에 있다.

## 확인 못 함

- Cloudflare 외 CDN(CloudFront, Fastly 등)의 기본 동작과 헤더 차이는 안 읽었다. 위 내용은 Cloudflare 문서 기준이다.
- `s-maxage`와 `stale-while-revalidate`가 CDN별로 어떻게 처리되는지(지원 여부)는 확인 못 했다.
- purge 후 브라우저 캐시에 남은 복사본이 어떻게 되는지 공식 문서 문장은 못 찾았다.
- 시뮬레이션 코드는 개념 확인용이라 실제 CDN의 TTL·계층 구조와 다르다.

## 근거 링크

- MDN, HTTP caching: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- MDN, Cache-Control: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
- web.dev, Keeping things fresh with stale-while-revalidate: https://web.dev/articles/stale-while-revalidate
- Cloudflare Docs, Default cache behavior: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- Cloudflare Docs, Cloudflare cache responses: https://developers.cloudflare.com/cache/concepts/cache-responses/
- Cloudflare Docs, Purge cache: https://developers.cloudflare.com/cache/how-to/purge-cache/

← 개념 지도로 (#/post/infra-map)

관련 글: [요청 하나가 거치는 길](#/post/infra-request-journey) · [로드 밸런서](#/post/infra-load-balancer) · [캐시와 Redis](#/post/db-cache-redis)

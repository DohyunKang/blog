CSR, SSR, SSG는 "화면의 HTML을 누가, 언제 만드느냐"만 다르고, 어느 쪽이 낫다기보다 페이지마다 데이터가 얼마나 자주 바뀌는지에 따라 고르게 된다.

## 먼저 한 줄씩

브라우저가 화면을 그리려면 결국 HTML이 있어야 한다. 그 HTML을 만드는 시점이 셋으로 갈린다. 브라우저가 화면을 그리는 순서는 [자세히 → 브라우저가 화면을 그리는 과정](#/post/fe-browser-render)에 따로 적어 뒀다.

| | 누가 | 언제 | 브라우저가 처음 받는 것 |
|---|---|---|---|
| CSR (Client-Side Rendering) | 브라우저의 JavaScript | 페이지를 연 뒤 | 거의 빈 HTML + JS |
| SSR (Server-Side Rendering) | 서버 | 요청이 올 때마다 | 완성된 HTML |
| SSG (Static Site Generation) | 빌드 과정 | 배포하기 전에 한 번 | 미리 만들어 둔 HTML 파일 |

web.dev의 렌더링 글도 같은 식으로 나눈다. CSR은 브라우저가 JavaScript로 로직·데이터 가져오기·템플릿·라우팅을 맡는 방식이고, SSR은 서버가 요청마다 완성된 HTML을 만드는 방식이고, 정적 렌더링은 빌드 때 URL마다 HTML 파일을 하나씩 만들어 두는 방식이다.

## CSR: 빈 껍데기를 받아서 브라우저가 채운다

CSR에서 서버가 주는 HTML은 대략 이런 모양이다.

```html
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
```

브라우저가 `app.js`를 내려받아 실행하고, 필요하면 API를 불러서 데이터를 받은 다음, 그걸로 `#root` 안을 채운다. 화면에 내용이 뜨는 시점이 "JS 다운로드 → 실행 → 데이터 요청 → 그리기" 뒤로 밀린다.

좋은 점은 한 번 로드한 뒤의 이동이 빠르고 앱처럼 부드럽다는 것이다. 서버는 정적 파일만 내주면 되니 운영도 단순하다. 나쁜 점은 첫 화면이 느려지기 쉽다는 것이다. web.dev는 JS가 커질수록 TBT와 INP 같은 상호작용 지표가 나빠지고, 모바일에서 빠르게 유지하기 어렵다고 적는다. 검색엔진이 JS를 실행하지 않으면 내용이 안 보일 수 있다는 점도 있다고 알려져 있다.

## SSR: 요청이 올 때마다 서버가 HTML을 만든다

SSR은 요청이 오면 서버가 데이터를 가져와 HTML을 완성해서 보낸다. 브라우저는 JS가 도착하기 전에도 내용을 바로 그릴 수 있다. web.dev는 SSR이 보통 FCP가 빠르고 클라이언트 JS가 줄어든다고 설명한다. 반대로 요청마다 서버가 일을 하니 TTFB(첫 바이트가 오기까지 시간)가 늘 수 있다.

로그인한 사용자별 화면이나 실시간에 가까운 데이터처럼, 요청마다 내용이 달라지는 페이지에 맞는다.

[자세히 → 요청이 처리되는 흐름](#/post/be-request-flow)에서 서버 쪽 처리 순서를 볼 수 있다.

## SSG: 빌드할 때 미리 만들어 둔다

SSG는 `next build` 같은 빌드 단계에서 페이지를 전부 HTML 파일로 만들어 둔다. 요청이 오면 서버는 계산 없이 그 파일을 그대로 준다. 그래서 파일을 CDN에 올려 두기 쉽고 TTFB와 FCP가 일정하게 빠르다. web.dev도 CDN 친화적이라고 적는다.

단점은 내용이 바뀌면 다시 빌드해야 한다는 것이다. 페이지가 수만 개로 늘거나 사용자별로 달라지는 내용이면 현실적이지 않다고 한다. 블로그 글, 문서, 소개 페이지처럼 한 번 만들면 한동안 안 바뀌는 곳에 맞는다. 파일을 가까운 곳에서 내주는 이야기는 [자세히 → CDN과 캐시 전략](#/post/infra-cdn-cache)에 이어진다.

## 하이드레이션: SSR·SSG에서 따라오는 개념

SSR이나 SSG로 HTML을 받으면 화면은 바로 보이는데, 버튼을 눌러도 아무 일이 안 일어나는 구간이 있다. HTML에는 이벤트 핸들러가 붙어 있지 않기 때문이다. 이 HTML에 JS가 이벤트와 상태를 붙여서 살아 있는 앱으로 만드는 과정이 하이드레이션이다. Next.js 문서는 "정적 HTML에 이벤트 핸들러를 붙여 상호작용하게 만드는 React의 과정"이라고 정의한다.

React의 `hydrateRoot`는 서버가 이미 만든 HTML 위에 React를 붙인다.

```js
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document.getElementById('root'), <App />);
```

(이 코드는 문서 예시를 옮긴 것이고 직접 실행해 보지는 않았다.)

여기서 지켜야 할 조건이 있다. React 문서는 클라이언트가 처음 그린 결과가 서버가 보낸 HTML과 같아야 한다고 한다. 어긋나면 개발 중에는 경고가 뜨고, 복구되는 경우도 있지만 보장은 없어서 심하면 이벤트 핸들러가 엉뚱한 요소에 붙을 수 있다고 적혀 있다. 어긋나는 흔한 원인으로 문서가 든 것은 이런 것들이다.

- 렌더링 중에 `typeof window !== 'undefined'`로 분기하는 코드
- 렌더링 중에 `window.matchMedia` 같은 브라우저 전용 API를 쓰는 코드
- 서버와 클라이언트에서 서로 다른 데이터를 그리는 경우

시간처럼 어쩔 수 없이 달라지는 값은 `suppressHydrationWarning`으로 경고를 끌 수 있지만 한 단계 깊이까지만 먹힌다.

하이드레이션에도 비용이 있다. web.dev는 FCP가 좋아져도 TBT와 INP는 나빠질 수 있다고 한다. 화면은 다 떴는데 스크립트가 도는 동안 반응이 없는 상태가 생기기 때문이다. 서버가 HTML을 보내고 클라이언트가 같은 UI 코드를 다시 실행하니 일이 두 번 된다는 지적도 있다.

## 섞어 쓰는 방식: ISR과 서버 컴포넌트

현실에서는 셋 중 하나만 쓰는 경우가 드물다.

ISR(Incremental Static Regeneration)은 SSG의 "바뀌면 다시 빌드" 문제를 줄이는 방식이다. Next.js 문서 기준으로 동작은 이렇다. 빌드 때 만든 페이지는 캐시에서 즉시 나간다. `revalidate = 60`이면 60초가 지난 뒤 첫 요청에는 낡은 페이지를 그대로 주고, 동시에 백그라운드에서 새 페이지를 만든다. 다 만들어지면 그다음 요청부터 새 페이지가 나간다. 문서는 revalidate 값을 1초보다 1시간처럼 높게 잡길 권하고, 정밀하게 바꾸려면 `revalidatePath`·`revalidateTag` 같은 온디맨드 방식을 쓰라고 한다. 실시간 데이터가 필요하면 동적 렌더링으로 가라고도 한다.

Next.js의 App Router는 컴포넌트 단위로 섞는다. 레이아웃과 페이지는 기본이 서버 컴포넌트이고, 상태나 클릭 이벤트가 필요한 부분만 `'use client'`를 붙인 클라이언트 컴포넌트로 쓴다. 첫 로드에서는 서버 컴포넌트 결과(RSC Payload)와 클라이언트 컴포넌트로 HTML을 미리 만들어 보내고, 브라우저가 그 HTML을 바로 보여 준 뒤 JS로 클라이언트 컴포넌트만 하이드레이션한다. 이후 페이지 이동에서는 RSC Payload를 미리 받아 캐시해 두고, 클라이언트 컴포넌트는 서버 HTML 없이 브라우저에서 그린다. 문서는 이렇게 하면 브라우저로 가는 JS 양을 줄일 수 있다고 한다. 상태 관리와 연결되는 이야기는 [자세히 → 상태 관리](#/post/fe-state)에 이어서 적는다.

## 고르는 기준

질문 순서로 보면 이렇다.

| 질문 | 쪽으로 기운다 |
|---|---|
| 내용이 방문자와 상관없이 같고 자주 안 바뀌나 | SSG (바뀌는 주기가 있으면 ISR) |
| 요청마다, 사용자마다 내용이 달라지나 | SSR |
| 로그인 뒤 대시보드처럼 앱에 가깝고 검색 노출이 중요하지 않나 | CSR |
| 한 페이지 안에 정적인 부분과 상호작용 부분이 섞여 있나 | 서버 컴포넌트 + 클라이언트 컴포넌트 |

성능 쪽 고민은 [자세히 → 프론트엔드 성능](#/post/fe-performance)에서 지표와 같이 보면 이해가 쉽다.

## 흔한 오해

- SSR이 CSR보다 항상 빠르다: 첫 화면(FCP)은 빠르지만 서버가 요청마다 일하니 TTFB는 늘 수 있고, 하이드레이션이 끝나기 전엔 눌러도 반응이 없다.
- SSG는 정적이라 데이터를 못 쓴다: 빌드 때 데이터를 가져와 HTML에 박아 두는 것이다. 다만 빌드 이후에 바뀐 값은 반영되지 않는다. ISR이 그 틈을 메운다.
- 하이드레이션하면 HTML을 다시 그린다: 이미 있는 HTML에 React를 붙이는 것이라, 서버와 같은 결과를 낸다는 전제가 있다. 다시 그리는 게 아니라서 어긋나면 문제가 된다.
- 프레임워크를 쓰면 이 선택은 신경 안 써도 된다: Next.js는 라우트별로 정적·동적을 나누고 컴포넌트 단위로 서버·클라이언트를 가르기 때문에 선택이 사라지는 게 아니라 코드 안으로 들어온다.

<details>
<summary>자세한 풀이: 지표 용어</summary>

- TTFB: 요청을 보내고 응답의 첫 바이트가 올 때까지의 시간.
- FCP: 화면에 첫 콘텐츠(글자나 이미지)가 그려지는 시점.
- TBT: 메인 스레드가 막혀서 입력에 반응하지 못한 시간의 합.
- INP: 사용자가 누르거나 입력했을 때 다음 화면 변화까지 걸리는 반응 속도.

web.dev 글은 SSR과 정적 렌더링이 클라이언트 JS를 줄여서 TBT와 INP에 유리하다고 보고, CSR은 번들이 커질수록 가장 영향을 받는다고 정리한다. 이 글의 도표에는 TTI라는 옛 지표가 나오는데, 본문 비교는 TBT·INP 기준으로 쓰여 있다.

</details>

<details>
<summary>자세한 풀이: 프리렌더링과 스트리밍</summary>

프리렌더링(prerendering)은 CSR 앱을 빌드 때 한 번 돌려서 첫 HTML만 뽑아 두는 방식이다. FCP는 좋아지지만 진짜로 상호작용하려면 JS가 필요하다. 위에서 말한 SSG와 겹치는 부분이 많은데, web.dev는 둘을 구분해서 설명한다.

web.dev는 하이드레이션 비용을 줄이는 방법으로 스트리밍 SSR과 점진적·부분 하이드레이션을 든다. 다만 부분 하이드레이션은 구현이 어렵다고 적는다. Next.js 문서에는 서버 컴포넌트가 콘텐츠를 점진적으로 클라이언트에 스트리밍한다는 말이 나온다.

</details>

<details>
<summary>자세한 풀이: ISR 응답 상태 보기</summary>

Next.js 문서에 따르면 ISR이 켜진 페이지의 응답에는 `x-nextjs-cache` 헤더가 붙고 값은 네 가지다.

- `HIT`: 캐시에서 내줌
- `STALE`: 캐시에서 내주면서 백그라운드로 새로 만드는 중
- `MISS`: 캐시에 없어서 새로 렌더링함
- `REVALIDATED`: 온디맨드로 다시 만들어짐

주의할 점도 문서에 있다. 정적 내보내기(static export)에서는 ISR이 안 되고, 인스턴스를 여러 개 띄우면 기본 파일 캐시가 인스턴스마다 따로라서 온디맨드 재검증이 호출을 받은 인스턴스에만 적용된다.

</details>

## 근거 링크

- web.dev, Rendering on the Web: https://web.dev/articles/rendering-on-the-web
- React, hydrateRoot: https://react.dev/reference/react-dom/client/hydrateRoot
- Next.js, Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js, Incremental Static Regeneration: https://nextjs.org/docs/app/guides/incremental-static-regeneration

← 개념 map으로 (#/post/fe-map)

관련 글: [브라우저가 화면을 그리는 과정](#/post/fe-browser-render) · [프론트엔드 성능](#/post/fe-performance) · [CDN과 캐시 전략](#/post/infra-cdn-cache)

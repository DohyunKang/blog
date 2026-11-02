프론트 성능은 "페이지가 빠르다"는 느낌을 로딩, 반응, 안정성 세 가지 숫자로 나눠서 재는 일이고, 그 세 숫자가 Core Web Vitals다. 숫자를 먼저 알아야 어디를 고칠지 정할 수 있다.

## 먼저 숫자 세 개

Core Web Vitals는 지금 LCP, INP, CLS 세 개다. web.dev 기준으로 "좋음" 구간은 아래와 같다.

| 지표 | 재는 것 | 좋음 기준 |
|---|---|---|
| LCP (Largest Contentful Paint) | 화면에서 가장 큰 요소가 그려지기까지 | 2.5초 이하 |
| INP (Interaction to Next Paint) | 클릭·탭·키 입력 후 화면이 바뀌기까지 | 200ms 이하 |
| CLS (Cumulative Layout Shift) | 보던 내용이 갑자기 밀리는 정도 | 0.1 이하 |

기준은 75번째 백분위수다. 방문 100번 중 75번이 기준 안에 들어와야 통과이고, 모바일과 데스크톱을 따로 본다. 세 지표가 모두 기준을 넘어야 그 페이지가 통과다.

INP는 예전의 FID를 대신해 2024년에 Core Web Vital이 됐다. FID는 첫 번째 입력의 지연만 봤고, INP는 방문 중의 모든 클릭·탭·키 입력을 보고 보통 가장 느렸던 하나를 값으로 쓴다. 입력을 받고, 핸들러를 돌리고, 다음 화면이 그려질 때까지가 전부 포함된다.

## LCP: 가장 큰 게 언제 뜨느냐

LCP 요소는 대개 히어로 이미지나 큰 제목이다. 브라우저가 화면을 그리는 순서를 알면 이 시간이 어디서 새는지 보인다. 순서는 [자세히 → 브라우저가 화면을 그리는 과정](#/post/fe-browser-render)에 따로 적어 뒀다.

web.dev는 LCP 시간을 네 구간으로 쪼갠다.

| 구간 | 의미 | 권장 비중 |
|---|---|---|
| TTFB | 페이지 요청부터 HTML 첫 바이트까지 | 약 40% |
| 리소스 로드 지연 | TTFB 이후 LCP 리소스를 받기 시작할 때까지 | 10% 미만 |
| 리소스 로드 시간 | LCP 리소스를 받는 시간 | 약 40% |
| 요소 렌더 지연 | 다 받은 뒤 실제로 그려질 때까지 | 10% 미만 |

권장 비중이라 규칙은 아니다. 읽고 든 생각은, 지연 구간 두 개는 0에 가까워야 하는 낭비 시간이라서 거기부터 줄이면 된다는 것이다.

가장 효과가 크다고 하는 건 리소스 로드 지연을 없애는 것이다. LCP 이미지가 HTML에 바로 적혀 있어야 브라우저가 일찍 발견한다. CSS나 JavaScript 안에서만 참조하면 한참 뒤에야 받기 시작한다. 그럴 땐 `<link rel="preload">`로 미리 받게 하거나, 이미지에 `fetchpriority="high"`를 준다. 이건 한두 장에만 쓰라고 한다.

```html
<!-- 첫 화면의 큰 이미지: lazy 금지, 우선순위 높임, 크기 명시 -->
<img src="hero.avif" width="1200" height="600"
     fetchpriority="high" alt="소개 이미지">
```

한 구간을 줄이면 시간이 다른 구간으로 옮겨 갈 수 있다. 이미지를 압축해서 로드 시간을 줄여도, 스크립트가 로드될 때까지 그 요소를 숨겨 두는 페이지라면 아낀 시간이 렌더 지연으로 그대로 돌아온다.

TTFB는 서버와 렌더링 방식의 몫이다. HTML을 서버가 만들어 주느냐, 빌드 때 만들어 두느냐, 브라우저가 만드느냐에 따라 첫 화면이 달라진다. 이쪽은 [자세히 → CSR·SSR·SSG](#/post/fe-rendering-modes)에서 정리했다.

## INP: 눌렀는데 늦게 반응하는 것

INP가 나쁘다는 건 입력 후 다음 화면까지 오래 걸린다는 뜻이고, 원인은 대체로 메인 스레드가 바쁜 것이다. web.dev는 세 부분으로 나눈다.

- 입력 지연: 다른 긴 작업(long task)이 메인 스레드를 잡고 있어서 핸들러가 시작을 못 한다.
- 핸들러가 느림: 이벤트 핸들러 안에서 하는 일이 길다.
- 화면 갱신이 느림: 복잡한 레이아웃, 스타일 계산, 큰 DOM 때문에 다음 프레임이 늦다.

JavaScript가 상호작용의 중심이라 느린 반응의 원인도 대부분 JavaScript라고 한다. 그래서 번들을 줄이는 일과 INP가 이어진다.

<details>
<summary>Lighthouse에 INP가 없는 이유</summary>

INP는 실제 사용자가 언제 무엇을 누를지 알아야 재는 값이다. 실험실 도구는 그걸 모른다. 그래서 Lighthouse는 INP 대신 TBT(Total Blocking Time)를 대용 지표로 쓴다. Chrome DevTools는 세 지표를 모두 잰다. 정확히 맞는 값은 아니고, web.dev도 TBT가 모바일 뷰포트가 없는 페이지의 탭 지연을 놓친다고 적어 둔다.

</details>

## CLS: 읽다가 밀리는 것

CLS는 버튼을 누르려는 순간 광고가 올라와 밀려서 엉뚱한 걸 누르게 되는 그 경험을 숫자로 만든 것이다. 요소가 프레임 사이에 시작 위치를 바꾸면 레이아웃 시프트로 센다. 한 번의 점수는 영향 비율 × 이동 거리 비율이다.

<details>
<summary>점수 계산 예</summary>

화면의 75%를 차지하는 요소가 화면 높이의 25%만큼 움직이면 0.75 × 0.25 = 0.1875다. 1초 이내 간격으로 일어난 시프트는 한 묶음(세션 윈도, 최대 5초)이 되고, CLS는 그중 가장 큰 묶음의 합이다. 0.1 이하가 좋음이고 0.25를 넘으면 나쁨이다. 사용자 입력 후 500ms 이내의 시프트는 계산에서 빠진다.

</details>

흔한 원인은 정해져 있다.

- 크기를 모르는 이미지·영상
- 대체 글꼴과 크기가 다른 웹폰트
- 스스로 크기를 바꾸는 광고·외부 위젯
- 이미 있던 내용 위로 끼어드는 동적 콘텐츠

고치는 쪽도 단순하다. 이미지에 `width`와 `height`를 적어 자리를 미리 잡아 두고, 애니메이션은 `width`·`top`·`left` 대신 `transform`으로 한다. 사용자가 눌러서 생기는 콘텐츠는 로딩 표시를 먼저 보여 줘서 예상된 변화로 만든다.

## 이미지와 지연 로딩

이미지는 바이트가 가장 큰 쪽이라 로드 시간을 줄일 때 먼저 손이 간다. 크기에 맞는 해상도, AVIF·WebP 같은 최신 형식, 압축, CDN 순이다.

화면 밖 이미지는 `loading="lazy"` 한 줄이면 된다. 브라우저가 뷰포트에서 일정 거리 안에 들어올 때 받는다. 그 거리는 브라우저가 정하고 연결 속도에 따라 다르다. web.dev 글에는 Chrome이 4G에서 1250px, 더 느린 연결에서 2500px로 줄였다고 나온다.

주의할 것이 몇 가지 있다.

- 첫 화면에 보일 이미지, 특히 LCP 이미지에는 lazy를 쓰면 안 된다. 일부러 늦추는 꼴이 된다.
- `width`·`height`가 없으면 크기가 0으로 잡혀서 갤러리 전체가 화면 안에 있는 것처럼 보이고 전부 받아 버릴 수 있다. 늦게 뜬 이미지가 CLS도 올린다.
- `display: none`인 이미지는 안 받지만 `opacity: 0`은 받는다.
- `<img>`에만 되고 CSS 배경 이미지에는 안 된다.

```html
<!-- 화면 밖 이미지 -->
<img src="card.webp" width="400" height="300" loading="lazy" alt="">
```

## 번들 줄이기: 코드 분할

JavaScript가 크면 받고, 파싱하고, 실행하는 시간이 모두 INP와 LCP에 영향을 준다. 처음 화면에 필요 없는 코드는 나중에 받게 나누는 게 코드 분할이다. 동적 `import()`가 그 수단이고 React에서는 `React.lazy`가 그걸 감싼다.

```jsx
import { lazy, Suspense } from 'react';

const Chart = lazy(() => import('./Chart'));

function Report() {
  return (
    <Suspense fallback={<p>불러오는 중</p>}>
      <Chart />
    </Suspense>
  );
}
```

web.dev는 분할을 라우트 단위에서 시작하라고 한다. 그다음이 상호작용 뒤에만 나오는 큰 컴포넌트, 그다음이 화면 밖의 덜 중요한 것이다. 청크를 못 받을 수도 있다. 오프라인이거나, 재배포로 옛 파일 주소가 사라졌을 때다. 그래서 Suspense를 에러 바운더리로 감싸 두라고 한다. 컴포넌트를 어떻게 쪼갤지는 [자세히 → 컴포넌트 설계](#/post/fe-component)와도 닿는다.

<details>
<summary>Suspense와 SSR</summary>

web.dev 글 기준으로 Suspense는 서버 사이드 렌더링을 지원하지 않는다고 적혀 있고, 그 경우 `loadable-components`를 권한다. 이 글이 쓰인 시점과 지금 React 버전의 차이가 있을 수 있어서, SSR 환경에서는 쓰는 프레임워크의 문서를 따로 확인해야 한다.

</details>

## 측정: 실험실과 현장

측정 값은 두 종류다.

| | 실험실(lab) | 현장(field) |
|---|---|---|
| 출처 | 정해진 기기·네트워크로 직접 로드 | 실제 방문자 |
| 도구 | Lighthouse, DevTools | CrUX, PageSpeed Insights, Search Console |
| 장점 | 같은 조건에서 반복, 디버깅 | 진짜 사용자 경험 |
| 약점 | 시나리오 하나 | 원인을 바로 찾기는 어려움 |

CrUX는 Chrome 사용자에게서 모은 28일 롤링 데이터셋이다. 실험실과 현장 값이 다른 건 이상한 일이 아니다. LCP 요소는 화면 크기, 개인화, A/B 테스트에 따라 달라지고 캐시가 있으면 실제가 더 빠르다. INP는 사용자가 눌러야 나오고, CLS는 실험실이 로드 중 첫 화면의 시프트만 잡는다. web.dev는 우선순위는 현장 데이터로 정하고, 배포 전 확인과 디버깅은 실험실로 하고, 둘 다 쓰라고 한다.

나중에 보려고 정리한 순서는 이렇다. PageSpeed Insights로 현장 값부터 보고, 통과 못 한 지표가 뭔지 확인하고, DevTools나 Lighthouse로 재현해서 위 세 구간(LCP면 4구간, INP면 3부분)에서 원인을 찾는다.

## 흔한 오해

- Lighthouse 점수가 100이면 끝이다: 실험실 점수는 현장 지표와 다를 수 있다. 위의 lab과 field 차이 그대로다.
- lazy 로딩은 이미지에 다 걸면 좋다: LCP 이미지에 걸면 오히려 느려진다.
- 숫자 하나만 올리면 된다: 한 구간을 줄이면 시간이 다른 구간으로 옮겨 가기도 한다.
- 번들만 줄이면 해결이다: TTFB와 렌더링 방식, 이미지 크기도 같이 봐야 한다.

---

← 개념 map으로 ([프론트엔드 map](#/post/fe-map))

관련 글: [브라우저가 화면을 그리는 과정](#/post/fe-browser-render) · [CSR·SSR·SSG](#/post/fe-rendering-modes) · [컴포넌트 설계](#/post/fe-component)

## 근거 링크

- Web Vitals: https://web.dev/articles/vitals
- INP: https://web.dev/articles/inp
- CLS: https://web.dev/articles/cls
- LCP 최적화: https://web.dev/articles/optimize-lcp
- 브라우저 수준 이미지 지연 로딩: https://web.dev/articles/browser-level-image-lazy-loading
- Code-splitting with React.lazy and Suspense: https://web.dev/articles/code-splitting-suspense
- 실험실·현장 데이터 차이: https://web.dev/articles/lab-and-field-data-differences


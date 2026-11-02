컴포넌트는 화면을 데이터가 흐르는 모양대로 쪼갠 조각이고, 설계는 어떻게 쪼개느냐보다 어디서 멈추고 상태를 누가 갖느냐에 가까웠다.

## 컴포넌트가 뭔지

컴포넌트는 화면의 한 덩어리를 함수 하나로 만든 것이다. 입력을 받으면 그에 맞는 화면 조각을 돌려준다. 버튼, 검색창, 상품 한 줄 같은 작은 것도, 그걸 모은 표 전체도 컴포넌트가 된다. 이 글의 예시는 React 기준이지만, Vue나 Svelte도 말만 다르지 같은 생각을 쓴다.

입력은 props로 들어온다. React 문서는 props가 컴포넌트의 "유일한 인자"라고 적는다. 그리고 컴포넌트가 props를 직접 바꾸면 안 된다. 값이 바뀌어야 하면 state를 쓴다. props는 렌더링할 때마다 새로 받는 읽기 전용 스냅샷이다.

```jsx
function Avatar({ person, size = 100 }) {
  return <img src={person.imageUrl} width={size} height={size} />;
}
```

기본값(`size = 100`)은 값이 아예 없거나 `undefined`일 때만 쓰인다. `size={0}`이나 `size={null}`을 넘기면 기본값이 안 들어간다. 이런 건 처음엔 헷갈리는데 문서에 명시돼 있다.

## 어떻게 쪼개나

문서의 "Thinking in React"는 시안에 박스를 그려 보면서 시작하라고 한다. 박스마다 이름을 붙이고, 안에 든 박스는 자식이 된다. 쪼갤지 말지는 세 가지 눈으로 본다. 코드(함수나 객체를 새로 만들 때의 기준), CSS(클래스를 따로 줄 만한가), 디자인(레이어가 따로 놀 만한가)이다.

기준은 단순하다. 컴포넌트는 한 가지 일만 신경 쓰는 게 이상적이고, 커지면 작게 나눈다. 쪼갤 때는 데이터 모델 한 조각이 컴포넌트 하나에 대응하게 하라고 한다. 문서의 상품 표 예시는 이렇게 나온다.

```text
FilterableProductTable
├─ SearchBar
└─ ProductTable
   ├─ ProductCategoryRow
   └─ ProductRow
```

표 머리글은 따로 안 뺀다. 다만 정렬 같은 기능이 붙어 머리글이 복잡해지면 그때 `ProductTableHeader`로 뺀다고 문서가 말한다. 미리 나누지 말고 커졌을 때 나누라는 얘기로 읽었다. [응집도·결합도](#/post/be-coupling-cohesion)나 SOLID의 단일 책임과 같은 줄기다.

## 합성(composition)

재사용하려고 옵션을 계속 붙이는 쪽과, 안에 뭘 넣을지 바깥에서 정하게 하는 쪽이 있다. 후자가 합성이다. 태그 사이에 넣은 내용은 `children`이라는 prop으로 들어온다.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

<Card>
  <Avatar person={me} />
</Card>
```

`Card`는 안에 아바타가 오는지 글이 오는지 모른다. 모르니까 어디든 쓸 수 있다. 반대로 `showAvatar`, `showTitle`, `showFooter`처럼 불리언 prop이 늘기 시작하면 합성으로 바꿀 때가 됐다는 신호로 본다.
`{...props}`로 받은 props를 통째로 자식에게 넘기는 스프레드도 있다. 문서는 "절제해서 쓰라, 컴포넌트마다 쓰고 있다면 뭔가 잘못된 것"이라고 한다. 편한데, 뭐가 내려가는지 안 보이게 된다.

## 데이터는 아래로, 이벤트는 위로

React는 데이터가 위에서 아래로만 흐른다. 부모가 state를 갖고 props로 내려주고, 자식이 값을 바꾸고 싶으면 부모가 내려준 함수를 호출한다. 문서는 양방향 바인딩보다 코드가 조금 더 길다고 인정한다. 대신 흐름이 눈에 보인다.

```jsx
<SearchBar
  filterText={filterText}
  onFilterTextChange={setFilterText}
/>
```

state를 어디 둘지는 문서가 순서를 알려 준다. 그 state로 화면을 그리는 컴포넌트를 모두 찾고, 그들의 가장 가까운 공통 부모에 둔다. 이게 상태 끌어올리기(lifting state up)다. 각 state에는 주인이 한 명이어야 한다(single source of truth). 모든 state를 한곳에 모으라는 뜻이 아니라, 정보 하나마다 소유자를 하나로 정하라는 뜻이다. 전역 상태까지 가는 얘기는 [상태 관리](#/post/fe-state)에서 이어진다.

state는 최소로 둔다. 문서는 세 가지를 묻는다. 시간이 지나도 안 바뀌는가, 부모가 props로 내려주는가, 다른 state나 props로 계산할 수 있는가. 하나라도 맞으면 state가 아니다. 상품 목록은 props고, 검색어로 걸러 낸 목록은 계산하면 되니까 state는 검색어와 체크박스 값 둘뿐이다.

## 제어와 비제어

문서의 아코디언 예시가 이 구분을 잘 보여 준다. 패널이 열렸는지(`isActive`)를 패널이 스스로 들고 있으면 비제어(uncontrolled)다. 부모가 `isActive`를 내려주면 제어(controlled)다.

| | 비제어 | 제어 |
|---|---|---|
| 상태 주인 | 컴포넌트 자신 | 부모 |
| 쓰기 | 쉽다, 설정이 적다 | 부모가 props를 줘야 한다 |
| 유연성 | 부모가 끼어들 수 없다 | 여러 컴포넌트를 맞춰 움직일 수 있다 |

"한 번에 하나만 열려야 한다"는 규칙이 생기는 순간 패널 하나가 혼자 정할 수 없게 되고, 그때 제어로 바꾼다. 문서도 실제로는 둘이 섞여 있고 필요에 따라 옮겨 간다고 한다. 처음부터 전부 제어로 만들 필요는 없다.

## 컨테이너/프레젠테이션

데이터를 가져오고 상태를 다루는 컴포넌트(컨테이너)와, props만 받아 그리는 컴포넌트(프레젠테이션)를 나누는 패턴이 있다. 이 이름은 Dan Abramov의 글로 퍼졌다. 그 글 맨 위에는 지금은 이렇게 나누길 권하지 않는다는 갱신 메모가 붙어 있다. 코드베이스에 자연스럽게 맞으면 쓸 만하지만 교조적으로 강제하는 걸 너무 많이 봤다는 취지이고, 상태 로직을 분리하려던 목적은 훅(hook)으로도 임의의 경계 없이 된다고 한다. 나는 이 부분을 검색 결과 요약으로만 읽었고 원문은 열지 못했다.

그래서 이 패턴은 "파일을 두 개로 쪼개라"보다 "그리는 코드와 데이터를 다루는 코드를 섞지 마라"는 생각으로 가져가려 한다. 지금은 커스텀 훅으로 로직을 빼는 쪽이 더 흔하다.

## 과한 추상화

컴포넌트를 만들 때 가장 자주 하는 실수가 미리 일반화하는 것이다. 버튼이 두 군데서 쓰이니까 `GenericButton`을 만들고, 세 번째 경우가 나오면 prop을 하나 추가하고, 열 개쯤 되면 `variant`, `size`, `iconLeft`, `iconRight`, `loading`, `as`가 붙은 괴물이 된다. 쓰는 사람은 어떤 조합이 되는지 모르고, 만든 사람도 수정이 무섭다.

점검할 때 던지는 질문은 이렇다.

- 같은 모양이 세 번 이상 나왔나. 두 번은 복사해도 된다.
- prop이 늘 때 서로 영향을 주나. 그러면 합성으로 쪼갤 때다.
- 이 컴포넌트 이름을 한 문장으로 설명할 수 있나. "~하고 ~도 한다"면 둘로 나눌 후보다.
- 반대로 너무 잘게 쪼개서 파일을 세 개 열어야 한 줄이 이해되지는 않나.

쪼개는 쪽 실수와 합치는 쪽 실수가 둘 다 있어서 어느 쪽이 정답이라 하기 어렵다. 다만 합친 걸 나중에 가르는 것보다, 나눈 걸 나중에 합치는 쪽이 대체로 쉬웠다는 얘기가 많다.

## 흔한 오해

- 컴포넌트는 작을수록 좋다: 기준은 크기가 아니라 책임이다. 한 줄짜리여도 이유가 있어야 하고, 백 줄이어도 한 가지 일이면 괜찮다.
- props를 바꿔서 값을 갱신한다: props는 읽기 전용이다. 바뀌어야 하는 값은 state에 둔다.
- state는 많이 둘수록 편하다: 계산할 수 있는 값을 state로 두면 두 값이 어긋나는 버그가 생긴다.
- 컨테이너/프레젠테이션을 꼭 지켜야 한다: 만든 사람 본인이 강제하지 말라는 쪽으로 정리했다.
- 재사용되는 컴포넌트가 좋은 컴포넌트다: 재사용은 결과이고, 안 쓰이는 범용 컴포넌트는 짐이다.

<details>
<summary>자세한 풀이: 상태 끌어올리기 한 번 따라가 보기</summary>

문서의 아코디언 예시를 따라가면 순서가 이렇다. 처음에 `Panel`마다 `isActive` state를 가지고 있어서 두 패널이 동시에 열린다. 하나만 열리게 하려면 1) 패널에서 state를 지우고, 2) 부모 `Accordion`에서 값을 직접 내려 보고, 3) 부모에 state를 넣고 이벤트 핸들러를 같이 내린다.

```jsx
function Accordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <>
      <Panel title="About" isActive={activeIndex === 0} onShow={() => setActiveIndex(0)}>...</Panel>
      <Panel title="Etymology" isActive={activeIndex === 1} onShow={() => setActiveIndex(1)}>...</Panel>
    </>
  );
}

function Panel({ title, children, isActive, onShow }) {
  return (
    <section>
      <h3>{title}</h3>
      {isActive ? <p>{children}</p> : <button onClick={onShow}>Show</button>}
    </section>
  );
}
```

패널은 이제 열릴지 말지를 스스로 정하지 않고, 부모가 내려준 값을 그리고 눌렸다는 사실만 알린다. 이 코드는 문서 예시를 줄여 적은 것이고 내가 실행해 보지는 않았다. 접근성 측면(버튼 대신 `aria-expanded` 등)은 [웹 접근성](#/post/fe-accessibility)에서 따로 본다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: 컴포넌트 분리 기준과 계층 예시, props와 state의 역할, state 최소화 질문 세 가지, 데이터 하향 흐름과 이벤트 상향(Thinking in React). props가 유일한 인자이고 읽기 전용이라는 것, children 합성, 스프레드 주의, 기본값 동작(Passing Props). 상태 끌어올리기, 제어/비제어, single source of truth(Sharing State).

확인 못 함: Dan Abramov 글 원문(Medium이 접근을 막아 검색 결과 요약만 확인), 갱신 메모의 정확한 날짜(2019년이라는 2차 출처 언급뿐). 본문 JSX 코드는 실행해 확인하지 않았다(실행 확인 못 함). 세 번 이상 나오면 추상화하라는 식의 규칙은 공식 문서 내용이 아닌 경험칙이라 근거 링크가 없다.

</details>

← 프론트엔드 지도로

관련 글: [상태 관리](#/post/fe-state) · [CSR·SSR·SSG](#/post/fe-rendering-modes) · SOLID 원칙 · 디자인 패턴

## 근거 링크

- React 문서, Thinking in React: https://react.dev/learn/thinking-in-react
- React 문서, Passing Props to a Component: https://react.dev/learn/passing-props-to-a-component
- React 문서, Sharing State Between Components: https://react.dev/learn/sharing-state-between-components
- Dan Abramov, Presentational and Container Components (원문 열지 못함, 검색 결과로 갱신 메모만 확인): https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0

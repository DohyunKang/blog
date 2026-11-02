Frontend study often introduces terms like rendering, state, components, accessibility, and performance all at once. While they seem like different topics, they ultimately converge on "how the browser builds the screen, how we construct it, and how users perceive it." That's why I've grouped these seven articles in that order and written just a couple of lines for each. If you want to learn more, simply follow the links.

## Overview of Relationships

```
브라우저가 그린다  ←  HTML을 누가·언제 만드나 (CSR·SSR·SSG)
        ↑
만든다: 컴포넌트로 쪼개고, 상태를 어디에 둘지 정한다
        ↑
쓰는 사람 쪽: 쓰기 쉬운가(사용성) · 누구나 쓸 수 있나(접근성) · 빠른가(성능)
```

## 1. How the Screen is Rendered

**Browser Rendering Process**: The browser receives HTML and CSS, then constructs the screen sequentially through DOM, CSSOM, render tree, layout, and paint. The cost of screen changes varies depending on which stage gets re-executed.
[Learn more → Browser rendering process](#/post/fe-browser-render)

**CSR·SSR·SSG**: These are three methods that differ only in who creates the HTML for the screen and when. It's not about which is better, but rather how frequently data changes per page.
[Learn more → CSR·SSR·SSG](#/post/fe-rendering-modes)

## 2. How to Structure It

**State Management**: Deciding where values that the screen needs to remember are stored and who modifies them. Before choosing a library, it's more important to categorize the types of values first.
[Learn more → State management](#/post/fe-state)

**Component Design**: Pieces broken down according to how data flows through the screen. The majority of design decisions revolve around where to stop splitting and who holds the state, rather than just how finely you divide them.
[Learn more → Component design](#/post/fe-component)

## 3. Impact on Users

**Usability Principles (UX)**: How easily a screen can be used. Nielsen's 10 heuristics are the most common list for checking this.
[Learn more → Usability principles (UX)](#/post/fe-usability)

**Web Accessibility**: Building without assuming only users with mice and eyes. Most issues are resolved by using HTML correctly, while ARIA serves as a supplement when that's not enough.
[Learn more → Web accessibility](#/post/fe-accessibility)

**Frontend Performance**: "Fast" is measured by three numbers: loading, responsiveness, and stability—known as Core Web Vitals. You need to understand these numbers first to determine where to make improvements.
[Learn more → Frontend performance](#/post/fe-performance)

## Reading Order

If you're new to this, read in the order of rendering process → CSR·SSR·SSG → state → components to follow the flow. Usability, accessibility, and performance can be read separately at any point. If you're curious about why a screen is slow, check out the articles on the rendering process and performance together.

← Back to concept map: [AI concept map](#/post/ai-map)

Related maps: [Backend map](#/post/be-map) · [Service infrastructure map](#/post/infra-map)
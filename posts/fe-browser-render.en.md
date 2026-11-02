The browser constructs the screen by receiving HTML and CSS, then building a DOM, CSSOM, render tree, layout, and paint in that order. The cost of screen changes depends on which of these stages needs to be re-executed.

## After typing the address

Before rendering the screen, the browser must first receive the HTML. According to MDN documentation, the sequence is as follows: resolve the host name to an IP via DNS, establish a TCP connection (3-way handshake), and if using HTTPS, complete TLS negotiation. Next, send an HTTP GET request; parsing begins once the first chunk of HTML arrives. The time taken until the first packet arrives is known as TTFB. This initial phase is about networking, so see [details → Network](#/post/cs-network) for more. Here, we focus on what happens after the first chunk of HTML arrives.

## Overall Flow

| Stage | Action | Result |
|---|---|---|
| Parsing (HTML) | Tokenize text and build a node tree rooted at `<html>` | DOM |
| Parsing (CSS) | Stack rules from general to specific into a tree | CSSOM |
| Style Computation | Merge DOM and CSSOM, selecting only visible nodes | Render Tree |
| Layout | Calculate position and size for each box | Box Model |
| Paint | Draw boxes as pixels (text, color, borders, shadows) | Per-layer bitmaps |
| Composite | Overlay layers onto the screen | Final Screen |

The first five stages above are collectively known as the critical rendering path. The web.dev documentation explains that optimizing this path means "reducing the time spent in these stages."

## DOM and CSSOM

HTML is tokenized into a node tree rooted at `<html>`, which constitutes the DOM. CSS also forms its own tree, called the CSSOM. This tree structure arises because styles start from the browser's default stylesheet and progressively override with more specific rules.

These two are separate objects: the DOM holds content information, while the CSSOM specifies which style rules apply to that content. Thus, a DOM can be created with HTML alone, but rendering requires both to interact.

During parsing, encountering a `<script>` tag changes things. According to MDN, scripts without `async` or `defer` halt HTML parsing while they are downloaded and executed. CSS does not stop HTML parsing, but JavaScript that reads computed styles does block it. Therefore, scripts are typically marked with `defer` or placed at the end of the document.

```html
<!-- 파싱을 멈추고 내려받아 실행 -->
<script src="a.js"></script>
<!-- 병렬로 내려받고, 끝나는 대로 실행(순서 보장 없음) -->
<script src="b.js" async></script>
<!-- 병렬로 내려받고, 파싱이 끝난 뒤 문서 순서대로 실행 -->
<script src="c.js" defer></script>
```

Note: At the back-end of the parser, a preloader scanner runs ahead to prefetch CSS, JS, fonts, and images. Even if parsing is blocked by a script, downloads can begin beforehand.

## Render Tree

Merging the DOM and CSSOM produces the render tree. Starting from the root, only visible nodes are visited; matching CSS rules are applied, and nodes with computed styles are emitted.

Invisible nodes are excluded. Elements like `<head>`, `<script>`, `<meta>`, and those with `display: none` are omitted. A common point of confusion is `visibility: hidden`; this remains in the render tree—it occupies space but is not visible. In contrast, `display: none` removes the element from the render tree entirely, so it does not participate in layout calculations.

## Layout

The render tree is traversed from the root to compute the exact position and size of each element relative to the viewport. This stage converts relative values like percentages into pixels. The web.dev example illustrates this intuitively: if a parent occupies 50% of the viewport and its child takes 50% of that parent, the child ends up at 25% of the viewport width.

The initial calculation is called layout; subsequent recalculations are termed reflow (per MDN). Though the computation is identical, the terminology differs based on timing context.

## Paint and Composite

Once layout completes, boxes are converted into pixels. Text, colors, borders, shadows, and images are drawn at this stage. Costs vary by style: web.dev notes that solid colors are cheap while drop shadows are expensive to compute.

A composite stage follows. Elements affected by `opacity`, 3D `transform`, or `will-change`, along with `<video>` and `<canvas>`, are promoted to separate layers for GPU-based compositing. Dividing into layers allows only one layer to be redrawn when needed, but since layers consume memory, MDN warns against overusing them. The same document also states that main-thread work—including style, layout, and paint—must complete within 16.67ms to ensure smooth scrolling and animations.

## Reflow and Repaint

When the DOM or CSSOM changes, the browser re-executes part of this process to determine which pixels need redrawing. The distinction between the two terms is as follows:

| | Reflow | Repaint |
|---|---|---|
| Meaning | Recalculate size and position | Redraw only the appearance |
| Geometry | Changed | Unchanged |
| Subsequent steps | Followed by repaint and compositing | Paint and composite of that layer |
| Example | Adding/removing elements, changing width or font size | Changing background color or text color |

MDN states that when a reflow occurs, it is followed by a repaint and recompositing. Therefore, reflows are more expensive. The examples in the table above are derived from the definition of "whether geometry changes," but MDN does not provide a complete list of which attributes fall strictly into each category in this document. If you need such a list, you must look it up separately.

One actual example cited by MDN is images. If you use an `<img>` tag without `width` and `height`, the browser initially lays out the page without space for the image; once the image arrives and its actual size is known, the layout must be recalculated from the start. If you specify the size via attributes in advance, the space is reserved, so no reflow is needed.

```html
<!-- 크기 없음: 로딩되면 리플로우 -->
<img src="a.jpg" alt="설명">
<!-- 크기 있음: 자리가 미리 잡힘 -->
<img src="a.jpg" alt="설명" width="800" height="600">
```

## Common Misconceptions

- The render tree is the DOM: Incorrect. The render tree is derived from the DOM by removing invisible elements and attaching calculated styles.
- `display: none` and `visibility: hidden` are the same: They are not. The former removes the element from the render tree, while the latter keeps it in place but makes it invisible.
- CSS has nothing to do with parsing: While HTML parsing is not blocked, scripts that read styles are prevented, and the render tree itself cannot be constructed without the CSSOM.
- Once the screen appears, everything is done: MDN notes that even if the page looks loaded, if the main thread is busy executing a large script, scrolling and tab interactions may become unresponsive. The metric for this is TTI (Time to Interactive).
- Changing size incurs no cost: Even changing a single color triggers a repaint, though it is cheaper than a reflow.

For performance-related topics, see [Frontend Performance →](#/post/fe-performance), and the question of whether HTML is generated on the server or in the browser continues in [Rendering Modes →](#/post/fe-rendering-modes).

<details>
<summary>Detailed explanation: Viewing multiple iterations with JS</summary>

Unlike understanding concepts only, mixing reads and writes in code can cause the same operation to occur multiple times, as shown below. This is a commonly known pattern.

```js
const items = document.querySelectorAll('.item');

// 읽기와 쓰기를 번갈아 하는 경우
items.forEach((el) => {
  const w = el.offsetWidth;      // 레이아웃 값을 읽음
  el.style.width = (w + 10) + 'px'; // 레이아웃이 바뀜
});

// 읽기를 먼저 몰아서 하고, 쓰기를 나중에 하는 경우
const widths = [...items].map((el) => el.offsetWidth);
items.forEach((el, i) => {
  el.style.width = (widths[i] + 10) + 'px';
});
```

The first approach may cause repeated layouts because the browser must adjust to the latest layout every time a value is read. The second approach batches reads to reduce the number of operations.

</details>

## Reference Links

- web.dev, Render-tree Construction, Layout, and Paint: https://web.dev/articles/critical-rendering-path/render-tree-construction
- MDN, How browsers work: https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/How_browsers_work

← Concept map (#/post/fe-map)

Related articles: [Rendering Modes](#/post/fe-rendering-modes) · [Frontend Performance](#/post/fe-performance) · [Network](#/post/cs-network)
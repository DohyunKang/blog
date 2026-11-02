Frontend performance is measured by three numbers that capture the feeling of "fast pages": loading, responsiveness, and stability. These three metrics are known as Core Web Vitals. You need to know these numbers first to determine what needs fixing.

## The Three Numbers First

Core Web Vitals currently consist of LCP, INP, and CLS. According to web.dev, the "Good" thresholds are as follows:

| Metric | What is Measured | Good Threshold |
|---|---|---|
| LCP (Largest Contentful Paint) | Time until the largest element on the screen is rendered | 2.5 seconds or less |
| INP (Interaction to Next Paint) | Time from a click, tap, or keypress until the screen updates | 200ms or less |
| CLS (Cumulative Layout Shift) | Degree to which content shifts unexpectedly | 0.1 or less |

The baseline is based on the 75th percentile. To pass, 75 out of every 100 visits must fall within these thresholds, evaluated separately for mobile and desktop. All three metrics must meet the baseline for a page to pass.

INP replaced FID (First Input Delay) as a Core Web Vital in 2024. While FID only measured delay from the first input, INP monitors all clicks, taps, and keypresses during a visit and uses the slowest one as the value. It includes everything from receiving the input, running the handler, to rendering the next screen.

## LCP: When Does the Biggest Thing Appear?

LCP elements are typically hero images or large headings. Knowing the order in which the browser renders the screen reveals where delays occur. The rendering sequence is detailed in [Detailed → How the Browser Renders Pages](#/post/fe-browser-render).

web.dev breaks down LCP time into four segments:

| Segment | Meaning | Recommended Share |
|---|---|---|
| TTFB | From page request to first byte of HTML | ~40% |
| Resource Load Delay | Time from TTFB until receiving the LCP resource | <10% |
| Resource Load Time | Time to receive the LCP resource | ~40% |
| Render Delay | Time from receiving all resources until actual rendering | <10% |

These recommended shares are guidelines, not strict rules. My takeaway is that the two delay segments represent wasted time and should be minimized starting there.

The most effective improvement is eliminating resource load delays. The LCP image must be referenced directly in the HTML so the browser can discover it early. If referenced only within CSS or JavaScript, loading starts much later. In such cases, use `<link rel="preload">` to fetch it in advance, or add `fetchpriority="high"` to images. This is recommended for only a few items.

```html
<!-- 첫 화면의 큰 이미지: lazy 금지, 우선순위 높임, 크기 명시 -->
<img src="hero.avif" width="1200" height="600"
     fetchpriority="high" alt="소개 이미지">
```

Reducing one segment can shift time to another. Even if you compress an image to reduce load time, on pages that hide the element until the script loads, the saved time simply returns as render delay.

TTFB depends on the server and rendering approach. Whether the server generates HTML, pre-builds it during build time, or the browser builds it affects the first screen. This is covered in detail in [Detailed → CSR·SSR·SSG](#/post/fe-rendering-modes).

## INP: Slow Response After Clicking

A poor INP score means a long delay between input and the next screen update; the cause is usually a busy main thread. web.dev divides this into three parts:

- Input Delay: The handler cannot start because another long task holds the main thread.
- Slow Handler: Work done inside the event handler takes too long.
- Slow Screen Refresh: Complex layouts, style calculations, or large DOMs delay the next frame.

Since JavaScript is central to interactions, most causes of slow responsiveness are also JavaScript-related. Thus, reducing bundles connects directly to improving INP.

<details>
<summary>Why Lighthouse Doesn't Measure INP</summary>

INP requires knowing exactly when and what a user clicks to calculate the value. Laboratory tools don't know this. Therefore, Lighthouse uses TBT (Total Blocking Time) as a proxy metric instead of INP. Chrome DevTools measures all three metrics. The values aren't perfectly accurate, and web.dev also notes that TBT misses tab delays on pages without a mobile viewport.

</details>

## CLS: Shifting While Reading

CLS quantifies the experience where an ad appears and pushes content just as you're about to click a button, causing you to accidentally click something else. If an element changes its starting position between frames, it's counted as a layout shift. A single score is calculated as impact ratio × movement distance ratio.

<details>
<summary>Score Calculation Example</summary>

If an element occupying 75% of the screen moves by 25% of the screen height, the score is 0.75 × 0.25 = 0.1875. Shifts occurring within a 1-second interval are grouped together (session window, max 5 seconds), and CLS is the sum of the largest groups. A score below 0.1 is good, while above 0.25 is bad. Shifts occurring within 500ms after user input are excluded from the calculation.

</details>

Common causes are well-established:

- Images and videos with unknown dimensions
- Fallback fonts and web fonts with different sizes
- Ads and external widgets that change their own size
- Dynamic content overlapping existing content

The fixes are also straightforward: specify `width` and `height` for images to reserve space, and use `transform` instead of `width`, `top`, or `left` for animations. For content generated by user input, show a loading indicator first to simulate expected changes.

## Images and Lazy Loading

Images consume the most bytes, so they are prioritized when reducing load time: appropriate resolution, modern formats like AVIF and WebP, compression, and CDNs in that order.

For off-screen images, adding `loading="lazy"` is sufficient. The browser fetches them when they enter a certain distance from the viewport. This distance is determined by the browser and varies based on connection speed. As noted in web.dev, Chrome reduced this distance to 1250px on 4G and 2500px on slower connections.

A few things to note:

- Do not use lazy loading for images visible on the first screen, especially LCP images; it intentionally delays them.
- Without `width` and `height`, dimensions default to 0, causing the entire gallery to appear within the viewport and potentially fetching all images at once. Late-loading images can also trigger CLS.
- Images with `display: none` are not fetched, but those with `opacity: 0` are.
- Lazy loading applies only to `<img>` tags, not CSS background images.

```html
<!-- 화면 밖 이미지 -->
<img src="card.webp" width="400" height="300" loading="lazy" alt="">
```

## Reducing Bundles: Code Splitting

Large JavaScript files impact INP and LCP during fetching, parsing, and execution. Code splitting divides code so that non-essential scripts for the initial view are loaded later. Dynamic `import()` is the mechanism, wrapped by `React.lazy` in React.

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

web.dev recommends starting splits at the route level, followed by large components shown only after interaction, then less critical off-screen content. Chunks may fail to load if offline or when old file paths disappear due to redeployment. Therefore, wrap with Suspense as an error boundary. How to split components relates further to [Component Design → Detailed Guide](#/post/fe-component).

<details>
<summary>Suspense and SSR</summary>

According to web.dev, Suspense does not support server-side rendering (SSR); in such cases, `loadable-components` is recommended. Given potential differences between the article's publication date and current React versions, consult your framework's documentation for SSR environments.

</details>

## Measurement: Lab vs Field

There are two types of metrics:

| | Lab | Field |
|---|---|---|
| Source | Direct load via specified device/network | Actual visitors |
| Tools | Lighthouse, DevTools | CrUX, PageSpeed Insights, Search Console |
| Pros | Reproducible under same conditions, easier debugging | Real user experience |
| Cons | Single scenario | Harder to pinpoint immediate causes |

CrUX is a 28-day rolling dataset collected from Chrome users. Differences between lab and field values are normal. LCP elements vary based on screen size, personalization, A/B testing, and caching (actual performance may be faster with cache). INP requires user interaction, while CLS captures shifts only on the initial load in the lab. web.dev advises prioritizing field data for ranking, using the lab for pre-deployment verification and debugging, and employing both.

The recommended workflow is: check field metrics via PageSpeed Insights first, identify failing indicators, then reproduce issues using DevTools or Lighthouse to find root causes across these three segments (four for LCP, three for INP).

## Common Misconceptions

- A Lighthouse score of 100 means you're done: Lab scores can differ from field metrics, exactly as described in the lab vs. field differences above.
- Applying lazy loading to all images is beneficial: It slows down LCP images if applied there.
- Optimizing just one metric is enough: Reducing one segment may shift time to another.
- Reducing bundle size alone solves everything: You must also consider TTFB, rendering methods, and image sizes.

---

← Concept map ([Frontend map](#/post/fe-map))

Related posts: [How browsers render the screen](#/post/fe-browser-render) · [CSR, SSR, SSG](#/post/fe-rendering-modes) · [Component design](#/post/fe-component)

## Reference links

- Web Vitals: https://web.dev/articles/vitals
- INP: https://web.dev/articles/inp
- CLS: https://web.dev/articles/cls
- LCP optimization: https://web.dev/articles/optimize-lcp
- Browser-level image lazy loading: https://web.dev/articles/browser-level-image-lazy-loading
- Code-splitting with React.lazy and Suspense: https://web.dev/articles/code-splitting-suspense
- Lab vs. field data differences: https://web.dev/articles/lab-and-field-data-differences
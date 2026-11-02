前端性能是通过加载速度、响应速度和稳定性这三个数字来衡量“页面是否快速”的感觉，而这三个数字就是 Core Web Vitals。只有先了解这些数值，才能确定需要改进的方向。

## 首先看这三个数字

Core Web Vitals 目前包含 LCP、INP 和 CLS 三项。根据 web.dev 的标准，“良好”区间如下：

| 指标 | 衡量内容 | 良好标准 |
|---|---|---|
| LCP (Largest Contentful Paint) | 屏幕上最大元素绘制完成所需时间 | 2.5 秒以下 |
| INP (Interaction to Next Paint) | 点击、触摸或键盘输入后屏幕更新所需时间 | 200ms 以下 |
| CLS (Cumulative Layout Shift) | 正在查看的内容突然偏移的程度 | 0.1 以下 |

标准基于第 75 百分位数。在 100 次访问中，至少有 75 次需符合标准才算通过，且移动端和桌面端分别评估。三项指标均需达标，该页面方可视为通过。

INP 取代了之前的 FID，于 2024 年成为 Core Web Vital 的一部分。FID 仅关注首次输入的延迟，而 INP 则监测访问期间的所有点击、触摸和键盘输入，并通常选取其中最慢的一次作为数值。该指标涵盖了接收输入、执行处理程序以及绘制下一帧屏幕的全过程。

## LCP：最大的元素何时出现

LCP 元素通常是英雄图像或大标题。若了解浏览器绘制屏幕的顺序，即可看出该耗时从何处产生。顺序已在 [详细说明 → 浏览器渲染过程](#/post/fe-browser-render) 中另行记录。

web.dev 将 LCP 时间划分为四个阶段：

| 阶段 | 含义 | 建议占比 |
|---|---|---|
| TTFB | 从页面请求到 HTML 首字节到达的时间 | 约 40% |
| 资源加载延迟 | TTFB 之后开始接收 LCP 资源直至完成的时间 | 10% 以下 |
| 资源加载时间 | 接收 LCP 资源所花费的时间 | 约 40% |
| 元素渲染延迟 | 全部接收后实际绘制完成所需的时间 | 10% 以下 |

“建议占比”并非硬性规则。阅读后的思考是：两个延迟阶段属于可浪费的时间，应优先从这些方面着手优化。

效果最显著的是消除资源加载延迟。LCP 图像应直接写在 HTML 中，以便浏览器尽早发现；若仅在 CSS 或 JavaScript 内引用，则需等待较长时间才开始加载。此时可使用 `<link rel="preload">` 提前获取资源，或在图片上添加 `fetchpriority="high"` 属性。此方法仅建议用于少数几张图片。

```html
<!-- 첫 화면의 큰 이미지: lazy 금지, 우선순위 높임, 크기 명시 -->
<img src="hero.avif" width="1200" height="600"
     fetchpriority="high" alt="소개 이미지">
```

缩短某一阶段的时间可能导致时间转移至其他阶段。例如，即使压缩图像以减少加载时间，若页面在脚本加载期间隐藏该元素，节省的时间仍会转化为渲染延迟返回。

TTFB 取决于服务器与渲染方式。HTML 是由服务器生成、构建时预先生成，还是由浏览器生成，都会影响首屏表现。相关内容已在 [详细说明 → CSR·SSR·SSG](#/post/fe-rendering-modes) 中整理。

## INP：点击后响应迟缓

INP 不佳意味着从输入到下一帧屏幕更新耗时过长，主要原因通常是主线程繁忙。web.dev 将其分为三部分：

- **输入延迟**：其他长任务（long task）占用主线程，导致处理程序无法启动。
- **处理程序缓慢**：事件处理程序内部执行的操作耗时过长。
- **屏幕刷新缓慢**：由于复杂的布局、样式计算或大型 DOM，下一帧的渲染被推迟。

JavaScript 是交互的核心，因此响应迟缓的原因大多与 JavaScript 相关。正因如此，减小包体积的工作与优化 INP 紧密相连。

<details>
<summary>Lighthouse 中为何没有 INP</summary>

INP 需要知道用户实际何时点击了什么才能进行测量，而实验室工具无法获知这些信息。因此，Lighthouse 使用 TBT（Total Blocking Time）作为替代指标。Chrome DevTools 则能同时测量三项指标。其数值并非完全准确，web.dev 也指出 TBT 会遗漏无移动端视口页面的触摸延迟。

</details>

## CLS：阅读时内容被推开

CLS 是将“试图点击按钮时广告弹出将其挤开，导致误触其他元素”这种体验转化为数值的指标。当元素在帧之间改变起始位置时，即视为布局偏移（layout shift）。单次得分等于影响比例 × 移动距离比例。

<details>
<summary>分数计算示例</summary>

占据屏幕 75% 的元素若移动了屏幕高度的 25%，则其影响值为 0.75 × 0.25 = 0.1875。在 1 秒内发生的位移会被归为一组（会话窗口，最大 5 秒），CLS 即为这些组中最大组的总和。低于 0.1 为良好，超过 0.25 则为不良。用户输入后 500ms 内的位移不计入计算。

</details>

常见原因已确定：

- 尺寸未知的图像和视频
- 替代字体与尺寸不同的 Web 字体
- 自行改变尺寸的广告和外部小部件
- 覆盖在已有内容之上的动态内容

修复方法也很简单：为图像指定 `width` 和 `height` 以预先占位，动画应使用 `transform` 而非 `width`、`top`、`left`。对于用户点击后出现的内容，先显示加载指示器以模拟预期的变化。

## 图像与延迟加载

图像占用字节数最大，因此在减少加载时间时应优先处理。顺序为：匹配尺寸的分辨率、AVIF/WebP 等现代格式、压缩、CDN。

位于屏幕外的图像只需添加 `loading="lazy"` 一行即可。浏览器会在该图像进入视口附近一定距离时进行加载。此距离由浏览器决定，并随网络连接速度而变化。web.dev 的文章指出，Chrome 在 4G 网络下设为 1250px，而在更慢的连接中则缩减为 2500px。

需注意以下几点：

- 首屏显示的图像，尤其是 LCP 图像，不应使用 lazy 加载，否则会故意延迟加载。
- 若缺少 `width`·`height`，尺寸会被设为 0，导致整个画廊看似都在屏幕内并被全部加载；延迟加载的图像也会引发 CLS。
- `display: none` 的图像不会被接收，但 `opacity: 0` 的图像会被接收。
- 仅适用于 `<img>` 标签，不适用于 CSS 背景图像。

```html
<!-- 화면 밖 이미지 -->
<img src="card.webp" width="400" height="300" loading="lazy" alt="">
```

## 减少包体积：代码分割

JavaScript 文件过大时，其下载、解析和执行时间都会影响 INP 和 LCP。将初始页面不需要的代码延迟加载称为代码分割。动态 `import()` 是实现手段，React 中则通过 `React.lazy` 封装该功能。

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

web.dev 建议从路由级别开始进行分割，其次是仅在交互后加载的大型组件，最后是屏幕外不太重要的内容。可能无法接收到某些块：例如离线状态或重新部署导致旧文件地址失效时。因此建议使用 Suspense 作为错误边界包裹。如何拆分组件可参考 [详细指南 → 组件设计](#/post/fe-component)。

<details>
<summary>Suspense 与 SSR</summary>

根据 web.dev 的文章，Suspense 不支持服务器端渲染（SSR），此时推荐使用 `loadable-components`。由于文章撰写时的 React 版本与当前可能存在差异，在 SSR 环境中应单独查阅所用框架的文档。

</details>

## 测量：实验室与现场

测量值分为两类：

| | 实验室 (lab) | 现场 (field) |
|---|---|---|
| 数据来源 | 通过指定设备和网络直接加载 | 实际访客 |
| 工具 | Lighthouse, DevTools | CrUX, PageSpeed Insights, Search Console |
| 优点 | 在相同条件下可重复，便于调试 | 真实用户体验 |
| 缺点 | 仅覆盖单一场景 | 难以立即定位原因 |

CrUX 是从 Chrome 用户处收集的 28 天滚动数据集。实验室值与现场值不同并不奇怪。LCP 元素会因屏幕尺寸、个性化设置、A/B 测试而有所不同，且若有缓存则实际速度更快。INP 需用户点击才会触发，CLS 仅捕获实验室中首次加载页面的位移。web.dev 建议优先依据现场数据确定优先级，部署前通过实验室进行验证和调试，并应同时使用两者。

后续整理的排查顺序如下：首先查看 PageSpeed Insights 中的现场值，确认未通过的指标，然后利用 DevTools 或 Lighthouse 重现问题，并在上述三个区间（LCP 为四个区间，INP 为三部分）中定位原因。

## 常见误解

- Lighthouse 得分为 100 即代表完成：实验室得分可能与现场指标不同，正如上述 lab 与 field 的差异所示。
- lazy 加载适用于所有图像：对 LCP 图像使用 lazy 加载反而会导致变慢。
- 只需提升单一数值：减少一个区间的时间可能导致时间转移到其他区间。
- 仅减少包体积即可解决问题：还需同时考虑 TTFB、渲染方式及图像尺寸等因素。

---

← 概念图（[前端地图](#/post/fe-map)）

相关文章：[浏览器绘制屏幕的过程](#/post/fe-browser-render) · [CSR·SSR·SSG](#/post/fe-rendering-modes) · [组件设计](#/post/fe-component)

## 参考链接

- Web Vitals: https://web.dev/articles/vitals
- INP: https://web.dev/articles/inp
- CLS: https://web.dev/articles/cls
- LCP 优化：https://web.dev/articles/optimize-lcp
- 浏览器级图片懒加载：https://web.dev/articles/browser-level-image-lazy-loading
- 使用 React.lazy 和 Suspense 进行代码分割：https://web.dev/articles/code-splitting-suspense
- 实验室与现场数据的差异：https://web.dev/articles/lab-and-field-data-differences
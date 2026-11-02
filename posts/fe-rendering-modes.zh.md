CSR、SSR 和 SSG 的区别仅在于“谁在何时生成页面的 HTML"，与其争论哪一方更好，不如根据页面数据更新的频率来决定采用哪种方式。

## 首先从单行开始

浏览器要渲染画面，最终必须有 HTML。生成这个 HTML 的时机分为三种情况。浏览器渲染画面的顺序已在 [详细过程 → 浏览器渲染过程](#/post/fe-browser-render) 中单独说明。

| | 谁生成 | 何时生成 | 浏览器首次接收的内容 |
|---|---|---|---|
| CSR (Client-Side Rendering) | 浏览器的 JavaScript | 打开页面后 | 几乎空的 HTML + JS |
| SSR (Server-Side Rendering) | 服务器 | 每次收到请求时 | 已完成的 HTML |
| SSG (Static Site Generation) | 构建过程 | 部署前一次生成 | 预先准备好的 HTML 文件 |

web.dev 的渲染文章也按类似方式分类。CSR 是浏览器负责逻辑、获取数据、模板和路由的方式；SSR 是服务器为每次请求生成已完成 HTML 的方式；而静态渲染则是在构建时为每个 URL 预先生成一个 HTML 文件的方式。

## CSR：接收空壳，由浏览器填充

在 CSR 中，服务器提供的 HTML 大致如下所示。

```html
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
```

浏览器下载并执行 `app.js`，必要时调用 API 获取数据，随后填充到 `#root` 内部。内容出现在屏幕上的时间点被推迟到"JS 下载 → 执行 → 数据请求 → 渲染”之后。

优点在于：加载一次后切换页面速度快，体验像原生应用一样流畅。服务器只需提供静态文件，运维也简单。缺点在于首屏加载容易变慢。web.dev 指出，随着 JS 体积增大，TBT（最大任务时间）和 INP（交互到响应时间）等交互指标会变差，在移动端也难以保持快速响应。此外，搜索引擎若不执行 JS，可能导致内容无法显示。

## SSR：每次请求时服务器生成 HTML

SSR 是当请求到达时，服务器获取数据并生成完整的 HTML 后发送。浏览器在 JS 到达之前就能立即渲染内容。web.dev 指出，SSR 通常能加快 FCP（首次内容绘制），并减少客户端 JS 体积。相反，由于每次请求都需要服务器处理，TTFB（首字节时间）可能会增加。

适用于登录用户专属界面或接近实时的数据等、每次请求内容都会变化的页面。

在 [详细过程 → 请求处理流程](#/post/be-request-flow) 中可以查看服务器端的处理顺序。

## SSG：构建时预先生成

SSG 是在类似 `next build` 的构建阶段，将所有页面预先生成为 HTML 文件。收到请求时，服务器无需计算，直接返回该文件。因此易于将文件部署到 CDN，TTFB 和 FCP 保持稳定快速。web.dev 也提到其对 CDN 友好。

缺点是内容变更时需要重新构建。如果页面数量达到数万级，或内容因用户而异，则不切实际。适用于博客文章、文档、介绍页面等一旦生成后一段时间内不会频繁变更的场景。关于从就近位置提供文件的说明，可参考 [详细过程 → CDN 与缓存策略](#/post/infra-cdn-cache)。

## 水合（Hydration）：SSR 和 SSG 衍生出的概念

通过 SSR 或 SSG 接收 HTML 后，画面会立即显示，但点击按钮等操作可能暂时无反应。这是因为 HTML 中尚未附加事件处理程序。将 JS 附加事件和状态，使静态 HTML 变为交互式应用的过程称为“水合（Hydration）”。Next.js 文档将其定义为“在静态 HTML 上附加事件处理程序以使其具备交互性的 React 过程”。

React 的 `hydrateRoot` 就是在服务器已生成的 HTML 之上附加 React。

```js
import { hydrateRoot } from 'react-dom/client';

hydrateRoot(document.getElementById('root'), <App />);
```

（此代码为文档示例，尚未亲自运行测试。）

在此过程中需遵守一定条件。React 文档指出，客户端首次渲染的结果必须与服务器发送的 HTML 一致。若不一致，开发阶段会出现警告；虽然有时可自动恢复，但并无保障，严重时可能导致事件处理程序错误地附加到不相关的元素上。常见的导致不一致的原因包括：

- 在渲染过程中使用 `typeof window !== 'undefined'` 进行条件分支的代码
- 在渲染过程中使用如 `window.matchMedia` 等浏览器专用 API 的代码
- 服务器与客户端渲染不同数据的场景

像时间一样必须变化的值可以通过 `suppressHydrationWarning` 发出警告，但只能深入一个层级。

水合（hydration）也有成本。web.dev 指出，即使 FCP（首次内容绘制）变好了，TBT（最大任务持续时间）和 INP（交互到下一个画面变化的响应速度）也可能变差。这是因为虽然屏幕已经全部加载完成，但在脚本执行期间会出现无响应的状态。也有人指出，服务器发送 HTML 后客户端又执行了相同的 UI 代码，相当于做了两遍工作。

## 混合使用方式：ISR 与服务器组件

现实中很少只使用这三种方式中的一种。

ISR（增量静态再生）是减少 SSG“变化后需重新构建”问题的方法。根据 Next.js 文档，其工作原理如下：构建时生成的页面会立即从缓存中移除。若设置 `revalidate = 60`，则在 60 秒后的首次请求仍返回旧页面，同时后台开始构建新页面；待新页面构建完成后，后续请求将返回新页面。文档建议将 `revalidate` 值设为较高数值（如 1 小时而非 1 秒），若需精确控制变更，则应使用 `revalidatePath`、`revalidateTag` 等按需方式。如需实时数据，则应采用动态渲染。

Next.js 的 App Router 采用组件级别的混合策略。布局和页面默认为服务器组件，仅在需要状态或点击事件的部分添加 `'use client'` 声明为客户端组件。首次加载时，会预先生成并发送包含服务器组件结果（RSC Payload）和客户端组件的 HTML，浏览器直接渲染该 HTML 后，仅对客户端组件进行水合；后续页面跳转时，则预先接收并缓存 RSC Payload，客户端组件则在浏览器中无需服务器 HTML 的情况下绘制。文档指出，这种方式可减少发送给浏览器的 JavaScript 量。关于状态管理的相关讨论，请参见 [详细 → 状态管理](#/post/fe-state)。

## 选择标准

按问题顺序来看如下：

| 问题 | 倾向方向 |
|---|---|
| 内容不依赖访客且很少变化吗？ | SSG（若有变化周期则使用 ISR） |
| 每次请求或每个用户的内容都不同吗？ | SSR |
| 登录后类似仪表盘的应用，且不重视搜索曝光吗？ | CSR |
| 单页内混合了静态部分和交互部分吗？ | 服务器组件 + 客户端组件 |

关于性能的考量，可参考 [详细 → 前端性能](#/post/fe-performance) 中的指标进行理解。

## 常见误解

- SSR 总比 CSR 快：首次画面（FCP）确实更快，但由于服务器需为每次请求处理，TTFB（首字节时间）可能增加，且在水合完成前点击无响应。
- SSG 是静态的所以无法使用数据：实际上是在构建时获取数据并嵌入 HTML 中。但构建后发生的变化不会被反映，ISR 可填补这一空白。
- 水合意味着重新绘制 HTML：这只是在现有 HTML 上附加 React，前提是服务器与客户端结果一致；若不一致则会产生问题，并非真正“重绘”。
- 使用框架就不必关心此选择：Next.js 按路由区分静态/动态，并按组件级别划分服务器/客户端，因此选择并未消失，而是内化到代码中。

<details>
<summary>详细解析：指标术语</summary>

- TTFB：从发送请求到收到响应第一个字节的时间。
- FCP：屏幕上首次内容（文字或图片）绘制的时刻。
- TBT：主线程被阻塞导致无法响应用户输入的总时间。
- INP：用户点击或输入后到下一个画面变化所需的响应速度。

web.dev 的文章报告称，SSR 和静态渲染通过减少客户端 JavaScript 对 TBT 和 INP 有利，而 CSR 随着包体积增大受影响最严重。该文章的图表中出现了旧指标 TTI，但正文比较均以 TBT·INP 为标准。

</details>

<details>
<summary>详细解析：预渲染与流式传输</summary>

预渲染（prerendering）是指在构建 CSR 应用时运行一次以提取首 HTML 并保存的方式。FCP 会改善，但若真正需要交互则仍需 JavaScript。上述 SSG 与此有大量重叠部分，但 web.dev 将其分别说明。

web.dev 提出减少水合成本的方法包括流式 SSR 和渐进/部分水合，但也指出部分水合实现困难。Next.js 文档中提到服务器组件可逐步向客户端流式传输内容。

</details>

<details>
<summary>详细解析：查看 ISR 响应状态</summary>

根据 Next.js 文档，启用 ISR 的页面响应会包含 `x-nextjs-cache` 头，其值有四种。

- `HIT`：从缓存中直接返回
- `STALE`：从缓存返回的同时在后台重新生成
- `MISS`：缓存中不存在，因此进行新渲染
- `REVALIDATED`：按需重新生成

文档中也提到了需要注意的点：在静态导出（static export）模式下不支持 ISR；当运行多个实例时，默认的文件缓存是各实例独立的，因此按需重新验证仅适用于收到请求的实例。

</details>

## 参考链接

- web.dev, Rendering on the Web: https://web.dev/articles/rendering-on-the-web
- React, hydrateRoot: https://react.dev/reference/react-dom/client/hydrateRoot
- Next.js, Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js, Incremental Static Regeneration: https://nextjs.org/docs/app/guides/incremental-static-regeneration

← 概念图 (#/post/fe-map)

相关文章：[浏览器绘制页面的过程](#/post/fe-browser-render) · [前端性能](#/post/fe-performance) · [CDN 与缓存策略](#/post/infra-cdn-cache)
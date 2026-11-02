Web accessibility is about building for everyone, not just those who use a mouse and view the screen with their eyes. Most issues are resolved by using HTML appropriately for its purpose; ARIA serves as a supplement when that's still insufficient.

## What is Accessibility?

MDN describes accessibility as creating websites that can be used by as many people as possible. While it is often discussed in relation to disabilities, it also helps people facing difficulties due to circumstances such as mobile devices or slow network connections. According to WHO statistics cited by MDN, approximately 15% of the global population—over 1 billion people—have some form of disability.

The target groups can be broadly categorized as follows:

| Type | Examples | Requirements |
|---|---|---|
| Visual | Blindness, low vision, color blindness | Screen readers, zooming, sufficient luminance contrast |
| Auditory | Deafness, hearing impairment | Captions, transcripts |
| Motor | Inability to use a mouse or limited hand dexterity | Operation via keyboard alone |
| Cognitive | Difficulty concentrating or understanding | Simple language, consistent layout, clear error messages |

Most of the following content addresses how to fill in one of the cells in this table.

## WCAG as the Standard

The specific standards are defined by W3C's WCAG (Web Content Accessibility Guidelines), which are grouped into four principles:

- **Perceivable**: Information must be presentable whether through sight, hearing, or other means.
- **Operable**: Interfaces must be operable via alternative input methods such as a keyboard.
- **Understandable**: Content and operation must be predictable.
- **Robust**: Markup must be accurate so that assistive technologies can interpret it correctly.

Each criterion includes A, AA, and AAA levels; legal or contractual requirements typically mandate AA level compliance. The numeric references in this article are based on WCAG 2.2 standards.

As discussed in [Rendering Details → Browser Rendering](#/post/fe-browser-render), once the DOM is created, the browser also constructs an accessibility tree separately. Assistive technologies like screen readers read from this tree rather than screen pixels. Instead of CSS or JavaScript, it is the element's role, name, and state that are recorded here. Accessibility work ultimately ensures that this tree is correctly constructed.

## Semantic HTML First

Creating two buttons with the same visual appearance reveals differences in behavior:

```html
<!-- 눌러지긴 하지만 접근성 트리에서는 그냥 글자 -->
<div class="btn" onclick="save()">저장</div>

<!-- 포커스, Enter/Space, 역할 이름이 기본으로 따라온다 -->
<button type="button" onclick="save()">저장</button>
```

A `div` does not receive focus via Tab, cannot be activated by Enter or Space, and screen readers do not announce it as a button. To make a `div` behave like one, you must manually add `tabindex`, handle keyboard events, and assign roles. In contrast, a `button` element inherently supports all these features.

Therefore, elements should be chosen based on their intended purpose:

- Use `a` for navigation links and `button` for actions.
- Use `h1` through `h6` for headings in order; do not select them merely to increase font size.
- Divide content into landmarks using semantic regions like `header`, `nav`, `main`, and `footer`, allowing screen reader users to skip between sections.
- Use `ul`/`ol` for lists and `table` with `th` for tables.
- Connect input fields with `label`.

```html
<label for="email">이메일</label>
<input id="email" type="email" autocomplete="email">
```

Images should include alternative text via the `alt` attribute. Informative images should describe their content, while decorative images should use `alt=""` to allow screen readers to skip them. Leaving `alt` empty is different from omitting the attribute entirely; omitting it may cause the file name to be read aloud.

The same principle applies when creating [Components](#/post/fe-component). Filling a component's interior with `div` elements will replicate accessibility issues even if the component is reused extensively.

## Keyboard Navigation

Being usable without a mouse is one of the first methods MDN recommends for accessibility testing—you can test it yourself. Disable your mouse and navigate the entire page using only Tab, Shift+Tab, Enter, Space, Esc, and arrow keys.

There are three key things to check:

- Can you reach all interactive elements?
- Is the current focus indicator visible? It is common for `outline: none` to remove the focus ring without providing an alternative.
- Does the focus order match the visual reading order? Assigning positive values to `tabindex` often disrupts the sequence, so typically only 0 and -1 are used.

Modals are particularly tricky. When opened, focus must move into the modal; when closed, it should return to the button that triggered the action. Focus must not escape to the background page while the modal is open. Modern solutions like the `dialog` element and `showModal()` method significantly handle these requirements.

## Luminance Contrast

Luminance contrast measures the ratio of brightness difference between text color and background color. WCAG 2.2 Section 1.4.3 (AA) requires the following:

| Text Type | Required Contrast Ratio |
|---|---|
| Normal text | At least 4.5:1 |
| Large text (18pt or larger, or 14pt bold or heavier) | At least 3:1 |

将 pt 转换为 px 时，18pt 约为 24px，14pt 约为 18.5px。由于比例未进行四舍五入，因此 4.499:1 无法通过测试。非活动按钮的文本、纯装饰性元素以及 Logo 文字属于例外情况。按钮边框或图标等非文本元素另有标准（1.4.11）。

<details>
<summary>计算对比度比例（使用 Python 运行并验证的结果）</summary>

直接按照 WCAG 定义的相对亮度公式进行计算。将 sRGB 值转换为 0~1 范围后，若小于等于 0.03928 则除以 12.92，否则取 `((c+0.055)/1.055)^2.4`。亮度计算公式为 `0.2126R + 0.7152G + 0.0722B`，对比度则为 `(较亮一侧 + 0.05) / (较暗一侧 + 0.05)`。

在白色背景（#ffffff）上测试的结果如下：

| 文字颜色 | 对比度 | 普通文本 AA |
|---|---|---|
| #000000 | 21.0 : 1 | 通过 |
| #767676 | 4.54 : 1 | 通过 |
| #777777 | 4.48 : 1 | 失败 |
| #949494 | 3.03 : 1 | 仅大字通过 |

仅相差一个灰色阶数，结果就在“通过”与“失败”之间切换。肉眼几乎无法分辨，这也是需要使用设计工具或浏览器开发者工具的对比度检查器的原因。
</details>

仅靠颜色传递信息也属于同一范畴。如果仅用红色边框显示错误，色盲用户可能会错过。应同时提供图标或文字说明。

可触摸目标的大小也已纳入 WCAG 2.2 标准。2.5.8 (AA) 规定使用指针点击的目标尺寸应不小于 24x24 CSS 像素。但如果周围有足够的间距，即使更小也有例外情况可以通过。

## 何时使用 ARIA

ARIA（WAI-ARIA）是一组属性，用于在访问性树中添加仅用 HTML 无法表达的角色、状态和属性，例如 `role`、`aria-label`、`aria-expanded` 等。对于标签页、下拉框、树形结构等复合组件，由于缺乏原生 HTML 元素，因此需要 ARIA。

然而，W3C 文档反复强调的是“如果可以用则不要用”。总结如下：

- 如果已有包含所需语义和行为的原生元素，请使用它们
- 不要更改原生语义，除非绝对必要
- 使用 ARIA 创建的交互元素必须也可通过键盘操作
- 不要在接收焦点的元素上添加 `role="presentation"` 或 `aria-hidden="true"`

ARIA Authoring Practices Guide 也以"No ARIA is better than Bad ARIA"为题表达了相同观点。“角色是一种承诺”这一解释令人印象深刻。如果添加了 `role="button"`，该元素必须像按钮一样对 Enter 和 Space 键做出响应；但 ARIA 仅改变屏幕阅读器朗读的内容，并不提供键盘操作逻辑，这部分需要直接用 JavaScript 实现。

```html
<!-- 상태를 알려 주는 올바른 사용 예 -->
<button type="button" aria-expanded="false" aria-controls="menu">메뉴</button>
<ul id="menu" hidden>...</ul>
```

在打开和关闭时，需要将 `aria-expanded` 的值切换为 `true`/`false` 以保持一致性。如果不更改值，属性就会变成虚假声明。

## 数据揭示的现实情况

根据 WebAIM 每年对全球前 100 万个网站进行的自动检查项目 WebAIM Million 在 2026 年 2 月的分析结果，95.9% 的网站存在 WCAG 违规问题。平均每页错误数为 56.1 个。最常见的问题如下：

| 问题类型 | 受影响网站比例 |
|---|---|
| 对比度不足 | 83.9% |
| 图像缺少替代文本 | 53.1% |
| 输入框缺少标签 | 51% |
| 空链接 | 46.3% |
| 空按钮 | 30.6% |
| 未指定文档语言 | 13.5% |

上述问题直接反映在排名表中。另一个值得注意的现象是 ARIA：使用 ARIA 的页面平均有 59.1 个错误，而未使用的页面平均为 42 个错误。不过 WebAIM 并未断定 ARIA 导致了这些错误，而是指出使用 ARIA 的页面原本就更复杂。尽管如此，可以明确的是，大量添加 ARIA 并不意味着能提升可访问性。自动检测工具捕获的只是冰山一角，实际存在的问题可能更多。

## 检查清单

制定完成后，建议按以下顺序进行检查：

1. 将鼠标悬停并一直按 Tab 键，直到页面末尾，检查焦点是否可见且顺序是否正确。
2. 检查标题层级、地标（Landmarks）、按钮与链接的区分是否恰当。
3. 检查每张图片的 `alt` 属性；装饰性图片应使用空值。
4. 检查每个输入框是否连接了 `label`，以及错误消息是否以文本形式呈现。
5. 使用检测工具测量文字对比度是否超过 4.5:1（大号字体为 3:1）。
6. 检查 `html` 标签中是否包含 `lang` 属性。
7. 检查 ARIA 是否仅用于原生元素无法实现的地方，以及状态值是否得到更新。
8. 最后使用屏幕阅读器（Windows 使用 NVDA，Mac 使用 VoiceOver）进行一次测试。

自动检测工具只能覆盖第 1 至 7 项中的部分内容。MDN 也建议同时进行自动化测试和由残障人士进行的直接测试。即使工具显示“无问题”，仍需人工检查焦点顺序和 `alt` 文本是否恰当。

## 常见误区

- **无障碍功能仅针对残障人士**：按照 MDN 的解释，在移动设备、缓慢的网络连接或明亮的户外屏幕环境下，同样的改进同样有益。
- **添加 ARIA 就能提升无障碍性**：上述 W3C 规则与 WebAIM 的数据指向相反方向；应优先使用原生元素。
- **自动检测得分为 100 分即可结束**：检测器无法覆盖的领域很大。
- **之后再进行修正也可以**：MDN 建议从一开始就加以考虑，因为事后返工的成本很高。
- **视障人士不需要看图片，因此 `alt` 文本随便写就行**：`alt` 是用文字替代图片所起的作用；若像文件名或“图片”那样填写，则与未填写无异。

## 参考资料链接

- MDN, What is accessibility?: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/What_is_accessibility
- W3C, Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, Understanding SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C WAI, ARIA APG, Read Me First: https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/
- W3C, Using ARIA (Discontinued Draft): https://www.w3.org/TR/using-aria/
- WebAIM, The WebAIM Million: https://webaim.org/projects/million/

← 概念图 (#/post/fe-map)

相关文章：[可用性](#/post/fe-usability) · [组件](#/post/fe-component) · [浏览器渲染](#/post/fe-browser-render)
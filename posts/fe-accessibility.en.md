Web accessibility is not just about building for people who use a mouse and view the screen with their eyes; it's about creating experiences for everyone. Most issues are resolved by using HTML appropriately for its intended purpose, while ARIA serves as a supplement when that isn't enough.

## What is Accessibility?

MDN describes accessibility as building websites that can be used by as many people as possible. While it is often discussed in the context of disabilities, MDN notes that it also benefits people facing inconveniences due to circumstances such as mobile devices or slow network connections. According to WHO statistics cited by MDN, approximately 15% of the global population, over 1 billion people, have some form of disability.

The target audience can be broadly categorized into several groups:

| Type | Examples | Requirements |
|---|---|---|
| Visual | Blindness, low vision, color blindness | Screen readers, magnification, sufficient luminance contrast |
| Auditory | Deafness, hearing impairment | Captions, transcripts |
| Motor | Inability to use a mouse or limited hand dexterity | Operation via keyboard alone |
| Cognitive | Difficulty with attention and comprehension | Simple language, consistent layout, clear error messages |

The following discussion largely revolves around how to fill the cells in this table.

## WCAG as the Standard

The specific standards are defined by W3C's WCAG (Web Content Accessibility Guidelines), which are grouped into four principles:

- **Perceivable**: Information must be presentable in ways users can perceive, whether through sight, hearing, or other means.
- **Operable**: Interface components must be operable via alternative input methods, such as a keyboard.
- **Understandable**: Content and operation must be predictable and easy to understand.
- **Robust**: Markup must be accurate so that assistive technologies can interpret it correctly.

Each criterion includes A, AA, and AAA levels, with legal or contractual requirements typically mandating the AA level. The numeric references in this article are based on WCAG 2.2.

As discussed in [Details → Browser Rendering](#/post/fe-browser-render), once the DOM is created, the browser also constructs an accessibility tree separately. Assistive technologies like screen readers read this tree rather than screen pixels. Instead of CSS or JavaScript, it contains the role, name, and state of elements. Accessibility work ultimately ensures that this tree is constructed correctly.

## Semantic HTML First

Creating two buttons with the same visual appearance reveals significant differences in behavior.

```html
<!-- 눌러지긴 하지만 접근성 트리에서는 그냥 글자 -->
<div class="btn" onclick="save()">저장</div>

<!-- 포커스, Enter/Space, 역할 이름이 기본으로 따라온다 -->
<button type="button" onclick="save()">저장</button>
```

A `div` does not receive focus via Tab, cannot be activated with Enter or Space, and screen readers do not announce it as a button. To make a `div` behave like one, you must manually add `tabindex`, handle key events, and assign roles. A `button` element possesses all these features by default.

Therefore, elements should be chosen based on their purpose:

- Use `a` for navigation and `button` for actions.
- Use `h1` through `h6` for headings in order; do not choose them merely to increase font size.
- Divide content into landmarks using `header`, `nav`, `main`, and `footer` so screen reader users can jump between sections.
- Use `ul`/`ol` for lists and `table` with `th` for tables.
- Connect input fields with `label`.

```html
<label for="email">이메일</label>
<input id="email" type="email" autocomplete="email">
```

Images should include alternative text via the `alt` attribute. Images conveying information should describe their content, while decorative images should have `alt=""` to allow screen readers to skip them. Leaving an image empty is different from omitting the attribute entirely; omitting it may cause the file name to be read aloud.

The same principle applies when creating [Components](#/post/fe-component). Filling a component's interior with `div`s means that accessibility issues will be replicated even if the component is reused extensively.

## Keyboard Navigation

Being usable without a mouse is also the first method MDN recommends for accessibility testing, and it can be tested directly. Try navigating the entire page using only Tab, Shift+Tab, Enter, Space, Esc, and arrow keys after releasing the mouse.

There are three key things to check:

- Can you reach all interactive elements?
- Is the current focus location visible? It is common for `outline: none` to remove the focus ring without providing an alternative indicator.
- Does the focus order match the visual reading order? Assigning positive values to `tabindex` often disrupts the sequence, so typically only 0 and -1 are used.

Modals are particularly tricky. When opened, focus must move into the modal; when closed, it should return to the button that opened it. Focus must not escape to the background page while the modal is open. Modern solutions like the `dialog` element and `showModal()` are known to handle this aspect quite well.

## Luminance Contrast

Luminance contrast measures the ratio of brightness difference between text color and background color. WCAG 2.1 Section 1.4.3 (AA) requires the following:

| Text Type | Required Contrast Ratio |
|---|---|
| Normal text | At least 4.5:1 |
| Large text (18pt or larger, or 14pt bold and heavier) | At least 3:1 |

Changing pt to px results in approximately 18pt being 24px and 14pt being 18.5px. The ratio is not rounded, so a value of 4.499:1 fails the test. Exceptions apply to text on inactive buttons, purely decorative elements, and logo text. Non-text elements such as button borders or icons have separate criteria (1.4.11).

<details>
<summary>Calculate contrast ratios (values verified by running Python)</summary>

I directly translated and calculated using the relative luminance formula defined by WCAG. sRGB values are converted to a 0–1 range; if the value is less than or equal to 0.03928, divide by 12.92, otherwise take `((c+0.055)/1.055)^2.4`. Luminance is calculated as `0.2126R + 0.7152G + 0.0722B`, and contrast is `(lighter side + 0.05) / (darker side + 0.05)`.

The results for text on a white background (#ffffff) are as follows:

| Text Color | Contrast Ratio | Normal Text AA |
|---|---|---|
| #000000 | 21.0 : 1 | Pass |
| #767676 | 4.54 : 1 | Pass |
| #777777 | 4.48 : 1 | Fail |
| #949494 | 3.03 : 1 | Pass for large text only |

A single shade of gray difference determines pass or fail, which is nearly impossible to distinguish by eye alone. This is why we use design tools or browser developer contrast checkers.
</details>

Not conveying information using color alone follows the same logic. Showing an error with only a red border will be missed by users with color vision deficiency; icons or text labels should accompany it.

Touch target sizes are also included in WCAG 2.2. Section 2.5.8 (AA) states that targets activated by a pointer must be at least 24x24 CSS pixels. Exceptions exist where smaller targets pass if there is sufficient spacing from surrounding elements.

## When to Use ARIA

ARIA (WAI-ARIA) is a collection of attributes added to the accessibility tree to convey roles, states, and properties that cannot be expressed with HTML alone, such as `role`, `aria-label`, and `aria-expanded`. Complex widgets like tabs, comboboxes, and trees require ARIA because they lack native HTML elements.

However, W3C documentation repeatedly emphasizes "if you can avoid it, don't use it." To summarize:

- Use native elements that already convey the necessary meaning and behavior
- Do not change native semantics unless absolutely necessary
- Elements manipulated via ARIA must also be usable via keyboard
- Do not add `role="presentation"` or `aria-hidden="true"` to focusable elements

The ARIA Authoring Practices Guide makes the same point with the title "No ARIA is better than Bad ARIA." The explanation that a role is a promise resonated. Adding `role="button"` implies the element must respond to Enter and Space like a button, but ARIA only changes semantics; it does not provide keyboard behavior, which must be implemented directly in JavaScript.

```html
<!-- 상태를 알려 주는 올바른 사용 예 -->
<button type="button" aria-expanded="false" aria-controls="menu">메뉴</button>
<ul id="menu" hidden>...</ul>
```

When opening or closing, you must toggle `aria-expanded` between `true` and `false` for the meaning to be correct. Failing to update the value turns the attribute into a lie.

## Reality in Numbers

According to February 2026 analysis of the WebAIM Million, which automatically scans the top one million websites annually by WebAIM, WCAG violations were detected on 95.9% of homepages, with an average of 56.1 errors per page. The most common issues were as follows:

| Issue | Percentage of Websites Affected |
|---|---|
| Insufficient luminance contrast | 83.9% |
| Missing image alt text | 53.1% |
| Missing input field labels | 51% |
| Empty links | 46.3% |
| Empty buttons | 30.6% |
| Undeclared document language | 13.5% |

The items described above appear directly in this ranking list. Another notable issue is ARIA. Pages using ARIA had an average of 59.1 errors, while those not using it had 42. However, WebAIM does not definitively state that ARIA causes these errors; they suggest pages using ARIA may be inherently more complex. Nevertheless, it is clear that adding more ARIA does not necessarily improve accessibility. Since these numbers only reflect issues caught by automated checks, the actual problems are likely even greater.

## Checklist

Here is the order I determined for reviewing after creation:

1. Tab through the entire page with your mouse released to verify focus visibility and correct tab order.
2. Check whether headings, landmarks, buttons, and links are properly distinguished.
3. Verify that each image has an `alt` attribute; decorative images should have an empty value.
4. Ensure every input field is connected to a `label` and that error messages are conveyed via text.
5. Use an inspection tool to verify that text contrast meets the 4.5:1 ratio (3:1 for large text).
6. Check whether the `html` element includes a `lang` attribute.
7. Ensure ARIA is used only where native elements are insufficient and that state values are updated appropriately.
8. Finally, test the site once using a screen reader (NVDA on Windows, VoiceOver on Mac).

Automated testing tools catch only some of the issues listed in points 1–7. MDN also recommends combining automated tests with direct testing by users with disabilities. Even if a tool reports "no issues," human review is still necessary to confirm that focus order and `alt` text are appropriate.

## Common Misconceptions

- Accessibility is only for people with disabilities: As explained by MDN, the same improvements also benefit mobile users, those on slow networks, and people viewing screens in bright outdoor conditions.
- Adding ARIA improves accessibility: This contradicts W3C guidelines and WebAIM metrics; native elements should be used first.
- A perfect score of 100 from an automated checker means you're done: Automated tools miss many areas.
- You can fix issues later: MDN advises considering accessibility from the start, as retrofitting is costly.
- Since visually impaired users don't need to see images, `alt` text can be approximate: `alt` text describes the function of an image; using a filename or generic terms like "image" renders it nearly useless.

## Reference Links

- MDN, What is accessibility?: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility/What_is_accessibility
- W3C, Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- W3C, Understanding SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- W3C WAI, ARIA APG, Read Me First: https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/
- W3C, Using ARIA (Discontinued Draft): https://www.w3.org/TR/using-aria/
- WebAIM, The WebAIM Million: https://webaim.org/projects/million/

← Concept map (#/post/fe-map)

Related posts: [Usability](#/post/fe-usability) · [Components](#/post/fe-component) · [Browser Rendering](#/post/fe-browser-render)
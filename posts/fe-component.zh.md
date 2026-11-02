组件是将数据流动的画面切分而成的碎片，而设计的关键不在于如何切分，而在于在哪里停止以及由谁来持有状态。

## 什么是组件

组件就是将画面的一部分封装成一个函数。它接收输入并返回相应的画面片段。无论是按钮、搜索框、商品单行这样的小部件，还是由它们组成的整个表格，都可以成为组件。本文的例子基于 React，但 Vue 或 Svelte 虽然说法不同，思路是一样的。

输入通过 props 传入。React 文档指出 props 是组件的“唯一参数”。并且组件不应直接修改 props；如果需要改变值，应使用 state。props 是在每次渲染时接收到的只读快照。

```jsx
function Avatar({ person, size = 100 }) {
  return <img src={person.imageUrl} width={size} height={size} />;
}
```

默认值（`size = 100`）仅在值完全不存在或为 `undefined` 时使用。传递 `size={0}` 或 `size={null}` 则不会应用默认值。这起初可能令人困惑，但文档中已明确说明。

## 如何切分

文档中的"Thinking in React"建议从绘制方框的草图开始。每个方框命名，内部的方框成为其子组件。是否应该切分需通过三个维度审视：代码（创建新函数或对象时的标准）、CSS（是否需要单独定义类）和设计（图层是否需要独立运作）。

标准很简单：理想情况下，组件应只关注一件事；规模变大时则进行拆分。拆分时应确保数据模型的一个片段对应一个组件。文档中的商品表格示例如下所示。

```text
FilterableProductTable
├─ SearchBar
└─ ProductTable
   ├─ ProductCategoryRow
   └─ ProductRow
```

表头通常不单独拆分。但如果添加了排序等功能导致表头变得复杂，文档建议此时拆分为 `ProductTableHeader`。我的理解是：不要预先拆分，而是在规模变大时再进行拆分。这与 [内聚度·耦合度](#/post/be-coupling-cohesion) 或 [SOLID](#/post/cs-solid) 中的单一职责原则一脉相承。

## 组合 (Composition)

存在两种做法：一种是不断添加选项以实现重用，另一种是从外部决定内部填充什么内容，后者即为组合。在标签之间插入的内容通过名为 `children` 的 prop 传入。

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

<Card>
  <Avatar person={me} />
</Card>
```

`Card` 不知道内部是包含头像还是文字，正因如此它可以在任何地方使用。相反，如果像 `showAvatar`、`showTitle`、`showFooter` 这样的布尔 prop 开始增多，则意味着是时候转向组合了。
还有一种做法是通过 `{...props}` 将接收到的 props 整体传递给子组件。文档警告说：“节制地使用，如果在每个组件中都这样使用，说明出了问题。”虽然方便，但会导致无法看清数据流向。

## 数据向下流，事件向上冒

React 中数据只能从上往下流动。父组件持有 state 并通过 props 传递下去；子组件若想修改值，则调用父组件传入的函数。文档承认这种方式比双向绑定代码稍长，但数据流向清晰可见。

```jsx
<SearchBar
  filterText={filterText}
  onFilterTextChange={setFilterText}
/>
```

state 存放位置由文档指引：找到所有使用该 state 绘制画面的组件，并将它们置于最近的一个共同父组件之下。这就是状态提升 (lifting state up)。每个 state 应只有一个所有者 (single source of truth)。这并非指将所有 state 集中到一处，而是指为每一条信息确定唯一的拥有者。关于全局状态的讨论将在 [状态管理](#/post/fe-state) 中继续。

state 应保持最小化。文档提出了三个问题：时间流逝后是否不变？是否由父组件通过 props 传递？是否可通过其他 state 或 props 计算得出？只要符合其中一项，就不应作为 state。商品列表是 props，而根据搜索词过滤后的列表只需计算即可，因此 state 仅剩搜索词和复选框的值。

## 受控与非受控

文档中的手风琴示例很好地展示了这一区分。如果面板是否打开 (`isActive`) 由面板自身持有，则为非受控 (uncontrolled)；如果由父组件通过 props 传递 `isActive`，则为受控 (controlled)。

| | 非受控 | 受控 |
|---|---|---|
| 状态所有者 | 组件自身 | 父组件 |
| 写入 | 容易，配置少 | 父组件需提供 props |
| 灵活性 | 父组件无法干预 | 可协调多个组件协同工作 |

一旦产生“一次只能打开一个”的规则，单个面板便无法自行决定，此时需转为受控模式。文档也指出实际上两者是混合使用的，并根据需要相互转换。并非从一开始就需要全部采用受控模式。

## 容器/展示

存在一种模式，将处理数据和状态的组件（容器）与仅接收 props 并负责渲染的组件（展示层）区分开来。这个命名源自 Dan Abramov 的文章。不过，文章顶部附有一则更新说明：现在并不再推荐这种划分方式。其理由是：虽然如果代码库自然契合这种结构尚可接受，但过度教条地强制执行已见太多；当初试图分离状态逻辑的初衷，如今也可以通过自定义钩子（hooks）在任意边界内实现。

因此，我们更倾向于将这种模式理解为“不要混合渲染代码与处理数据的代码”，而不是简单地“把文件拆成两个”。目前，通过自定义钩子提取逻辑的做法更为常见。

## 过度抽象

创建组件时最常见的错误就是过早泛化。例如，因为按钮在两个地方使用，就创建了 `GenericButton`；当出现第三种情况时，又增加一个 prop；等到大概十个属性时，它就变成了一个拥有 `variant`、`size`、`iconLeft`、`iconRight`、`loading`、`as` 等属性的怪物。使用者不知道哪些组合是有效的，而创建者也害怕修改它。

检查时可以问以下几个问题：

- 是否出现过三次以上相同的外观？如果只出现两次，直接复制即可。
- 当 prop 增加时，它们之间是否相互影响？如果是，就应该通过组合来拆分。
- 能否用一句话描述这个组件的名称？如果名称是“既做 A 又做 B"，那就应该拆分为两个组件。
- 反之，是否因为拆分得太细，需要打开三个文件才能理解一行代码？

拆分过度与合并过度这两种错误都存在，因此很难说哪一方才是正确答案。不过，普遍认为：将已合并的组件后期再拆分，比将已拆分的组件后期再合并要容易得多。

## 常见误解

- **组件越小越好**：评判标准不是大小，而是职责。即使只有一行代码，也必须有存在的理由；即使长达百行，只要只做一件事也是可以的。
- **通过修改 props 来更新值**：props 是只读的。需要更新的值应放在 state 中。
- **state 存得越多越方便**：如果将可计算的数值存入 state，容易导致两个值不一致的 bug。
- **必须严格遵守容器/展示层模式**：作者本人也强调不应强制推行此模式。
- **可复用的组件才是好组件**：复用是结果而非目标；那些不被使用的通用组件反而是负担。

<details>
<summary>详细解析：一次尝试提升状态层级</summary>

按照文档中的手风琴示例，初始顺序如下：每个 `Panel` 都拥有自己的 `isActive` state，导致两个面板同时打开。若要确保只有一个面板打开，需执行以下步骤：1) 在子组件中移除 state；2) 由父级 `Accordion` 直接管理并下发该值；3) 在父组件中添加 state 并同步下发事件处理器。

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

此时，面板不再自行决定是否打开，而是根据父组件下发的状态进行渲染，并仅反馈“已被点击”的事实。此代码为简化后的文档示例，我尚未亲自运行验证。关于无障碍性方面（如使用 `aria-expanded` 替代按钮等），将在 [Web 无障碍](#/post/fe-accessibility) 专题中单独讨论。

</details>

← [前端 Map](#/post/fe-map)

相关文章：[状态管理](#/post/fe-state) · [CSR·SSR·SSG](#/post/fe-rendering-modes) · [SOLID 原则](#/post/cs-solid) · [设计模式](#/post/cs-design-patterns)

## 参考链接

- React 文档，Thinking in React: https://react.dev/learn/thinking-in-react
- React 文档，Passing Props to a Component: https://react.dev/learn/passing-props-to-a-component
- React 文档，Sharing State Between Components: https://react.dev/learn/sharing-state-between-components
- Dan Abramov, Presentational and Container Components: https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
A component is a piece of the UI broken down to match the flow of data, whereas design is less about how you split things and more about where to stop and who holds the state.

## What is a Component?

A component is a single function that renders a portion of the screen. It takes input and returns the corresponding UI fragment. Small elements like buttons, search bars, or product rows, as well as larger structures like entire tables, become components. While this article uses React as an example, Vue or Svelte operate on the same principles despite different terminology.

Input comes in via **props**. The React documentation states that props are the "only argument" for a component, and components must not mutate them directly. If values need to change, use state. Props are read-only snapshots received fresh on every render.

```jsx
function Avatar({ person, size = 100 }) {
  return <img src={person.imageUrl} width={size} height={size} />;
}
```

Defaults (e.g., `size = 100`) are only used when no value is provided or when the value is `undefined`. Passing `size={0}` or `size={null}` will not trigger the default; these distinctions can be confusing at first but are explicitly documented.

## How to Split?

The "Thinking in React" guide suggests starting by drawing boxes for your layout ideas. Each box gets a name, and boxes inside become children. Whether to split further is evaluated through three lenses: code (when creating new functions or objects), CSS (whether a separate class is needed), and design (whether layers should operate independently).

The criteria are simple: ideally, a component should focus on one thing, and if it grows too large, break it down. When splitting, aim for a one-to-one correspondence between a piece of the data model and a component. The product table example in the documentation looks like this:

```text
FilterableProductTable
├─ SearchBar
└─ ProductTable
   ├─ ProductCategoryRow
   └─ ProductRow
```

Do not extract the header separately unless functionality like sorting makes it complex; at that point, split it into `ProductTableHeader`. The documentation advises against pre-splitting and suggests dividing only when necessary, which aligns with principles of cohesion, coupling, and the Single Responsibility Principle from [Cohesion & Coupling](#/post/be-coupling-cohesion) or [SOLID](#/post/cs-solid).

## Composition

There are two approaches: attaching more options for reuse versus letting the outside decide what goes inside. The latter is composition. Content placed between tags enters via a prop called `children`.

```jsx
function Card({ children }) {
  return <div className="card">{children}</div>;
}

<Card>
  <Avatar person={me} />
</Card>
```

A `Card` doesn't know whether an avatar or text will appear inside; this ignorance makes it highly reusable. Conversely, when boolean props like `showAvatar`, `showTitle`, and `showFooter` start accumulating, it's time to switch to composition. Spreading received props with `{...props}` to pass them entirely to children is also possible. The documentation warns against overusing this: "Be restrained; if you're using it for every component, something is wrong." It's convenient, but it obscures what data is flowing down.

## Data Flows Down, Events Flow Up

React enforces a unidirectional data flow: data flows from parent to child. Parents hold state and pass it down via props; if a child needs to change a value, it calls a function provided by the parent. The documentation acknowledges this approach results in slightly longer code than two-way binding but offers clearer visibility into the data flow.

```jsx
<SearchBar
  filterText={filterText}
  onFilterTextChange={setFilterText}
/>
```

The documentation guides you on where to place state: find all components that render using that state and move them to their nearest common parent. This is known as **lifting state up**. Each piece of state should have a single owner (single source of truth). This doesn't mean gathering all state in one place, but rather assigning one owner per piece of information. Discussions on global state continue in [State Management](#/post/fe-state).

Keep state minimal. The documentation asks three questions: Does it change over time? Is it passed down via props? Can it be derived from other state or props? If the answer is yes to any, it's not state. For example, a product list is a prop, and a filtered list based on search terms can be computed; thus, only the search term and checkbox values remain as state.

## Controlled vs Uncontrolled Components

The accordion example in the documentation clearly illustrates this distinction. If a panel holds its own `isActive` state, it's uncontrolled. If the parent provides `isActive`, it's controlled.

| | Uncontrolled | Controlled |
|---|---|---|
| State Owner | The component itself | The parent |
| Writing | Easy, fewer settings | Parent must provide props |
| Flexibility | Parents cannot interfere | Multiple components can be coordinated |

Once a rule like "only one panel open at a time" is introduced, a single panel can no longer decide independently, so it must become controlled. The documentation notes that in practice, both approaches often mix, and you should migrate between them as needed. There's no need to build everything as controlled from the start.

## Container/Presentation

There is a pattern that separates components (containers) responsible for fetching data and managing state from components (presentational) that only receive props and render UI. This naming convention spread via an article by Dan Abramov. However, a note at the top of that article now advises against this separation. The gist is that while it can be useful if it fits naturally into your codebase, I've seen too many cases where it's enforced dogmatically; furthermore, the original goal of separating state logic has been achieved with hooks, which allow arbitrary boundaries without needing such a split.

Therefore, instead of thinking "split files into two," we should adopt the mindset of "do not mix rendering code with data-handling code." Currently, extracting logic via custom hooks is more common.

## Over-Abstraction

The most common mistake when creating components is premature generalization. For instance, if a button is used in two places, you create a `GenericButton`; when a third case arises, you add another prop; and by the time there are ten cases, it becomes a monster with props like `variant`, `size`, `iconLeft`, `iconRight`, `loading`, `as`, and so on. The user doesn't know which combinations are possible, and the creator fears modifying it.

Here are questions to ask during review:

- Has this exact shape appeared more than twice? If only twice, copying is acceptable.
- Do props affect each other when added? If so, it's time to split via composition.
- Can you explain the component's name in a single sentence? If it does "X and Y," it should be split into two.
- Conversely, have you split things too finely that you need to open three files just to understand one line?

Both mistakes—splitting too much and merging too much—exist, making it hard to declare one side the correct answer. However, there is a common sentiment that refactoring merged components apart later is generally easier than merging split components later.

## Common Misconceptions

- **Components are better when smaller:** The metric isn't size but responsibility. Even a single-line component needs a reason to exist, and even a hundred-line component is fine if it does one thing.
- **Updating values by changing props:** Props are read-only. Values that need to change should be stored in state.
- **More state is easier:** Storing computable values in state can lead to bugs where two values get out of sync.
- **You must strictly follow Container/Presentational separation:** The author concludes that creators shouldn't enforce this themselves.
- **Reusable components are good components:** Reusability is a result, not a goal; unused generic components are just baggage.

<details>
<summary>Detailed explanation: Try lifting state once</summary>

Following the accordion example in the document, the sequence is as follows: Initially, each `Panel` has its own `isActive` state, causing two panels to open simultaneously. To ensure only one opens, you must: 1) remove the state from the panel, 2) have the parent `Accordion` directly pass down values, and 3) add the state to the parent along with event handlers.

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

The panel no longer decides on its own whether to open or close; instead, it renders based on the value passed down by the parent and merely reports that it was clicked. This code is a condensed version of the document's example, which I have not executed myself. Regarding accessibility (e.g., using `aria-expanded` instead of buttons), see [Web Accessibility](#/post/fe-accessibility) separately.

</details>

← [Frontend Map](#/post/fe-map)

Related posts: [State Management](#/post/fe-state) · [CSR·SSR·SSG](#/post/fe-rendering-modes) · [SOLID Principles](#/post/cs-solid) · [Design Patterns](#/post/cs-design-patterns)

## Reference Links

- React Docs, Thinking in React: https://react.dev/learn/thinking-in-react
- React Docs, Passing Props to a Component: https://react.dev/learn/passing-props-to-a-component
- React Docs, Sharing State Between Components: https://react.dev/learn/sharing-state-between-components
- Dan Abramov, Presentational and Container Components: https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
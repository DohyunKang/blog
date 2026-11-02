State management is about deciding where a screen should store values and who gets to modify them; categorizing the types of values was far more important than choosing a library.

## What is State?

State (state) refers to values that change over time, and when they change, the UI must update accordingly. Text entered in an input field, whether a menu is open, the logged-in user, and lists received from the server are all examples of state. Think of the UI as simply a rendering result derived from the state; therefore, if the UI behaves unexpectedly, it's usually because the state is incorrect.

[For more details → Component Design](#/post/fe-component), which will be covered later, modern frontends break down the UI into components. As soon as you split the UI, the question "Which component holds this value?" arises. State management is essentially a collection of answers to this question.

## Categorizing State into Three Types

Initially, I thought all state was the same, but realizing their different characteristics made it easier to categorize them.

| Type | Examples | Typical Location | Characteristics |
|---|---|---|---|
| Local State | Text being typed, modal open/closed status | Inside that component | No need for others to know about it |
| Shared (Global) State | Logged-in user, theme, shopping cart | Common parent, context, store | Read and modified by multiple screens together |
| Server State | Post list, product information | Server is the source of truth; client holds a copy | Asynchronous, can be changed by others, can become stale |

The criteria are "Who needs to know about this value?" and "Where is the original source?". If the original is on the server, it's server state. If there's no original and only one component uses it, it's local state. If multiple components use it, it's shared state.

## Starting Local and Lifting Up

The React documentation's basic principle is to keep state close by initially and lift it up when needed. If two components must always change together, remove their individual states, move them to the nearest common parent, and pass them down via props. This process is called "lifting state up." The documentation notes that this is one of the most common tasks in React code.

The accordion example in the documentation was easy to understand. If each panel holds its own `isActive`, both can open simultaneously. If the parent holds only a single `activeIndex`, the structure guarantees that only one item opens. The documentation also mentions that lifting state often changes the nature of the stored values.

```js
const [activeIndex, setActiveIndex] = useState(0);
<Panel isActive={activeIndex === 0} onShow={() => setActiveIndex(0)} />
```

Terms emerging here are controlled and uncontrolled components. A component moving based on its own internal state is uncontrolled, while one receiving important values via props to drive behavior is controlled. Uncontrolled components are easier to write but harder to synchronize with others; controlled components are more flexible but require the parent to configure everything. The documentation states that this distinction isn't strict and a single component can mix both approaches.

One key principle: designate one component as the owner for each value (single source of truth). This doesn't mean gathering all state in one place, but rather avoiding duplicating the same value in two locations.

## Shaping State Structure

Just as deciding where to store state affects bugs, how you structure it also determines bug potential. The React documentation's "Choosing State Shape" lists five guidelines:

- Group values that change together. Instead of storing `x` and `y` separately, use a single `position`.
- Avoid contradictory structures. Having both `isSending` and `isSent` as booleans could allow them to be true simultaneously. Storing a single value in `status` like `'typing' | 'sending' | 'sent'` prevents this.
- Don't store values that can be calculated. Create `fullName` by combining `firstName + ' ' + lastName` during rendering rather than storing it. Copying props into state causes the state to fail to update when props change.
- Don't duplicate data in multiple places. Store `selectedId` instead of a `selectedItem` object and look up the item from the list.
- Avoid deep nesting. Fixing one level often requires copying all upper levels, which is cumbersome and error-prone. Flat structures using IDs for lookup are better.

All these points convey the same message: minimize state and calculate the rest.

## Treating Server State Separately

For a while, many developers stored data received from the server directly in a global store and used it that way. The TanStack Query documentation takes a different view. It defines server state as remote data you don't own, requiring asynchronous APIs to read or write, potentially changed by others without your knowledge, and capable of becoming stale within your app. Therefore, it argues that local state libraries are not suitable for this purpose.

According to the documentation, the responsibilities handled by such a library include fetching, caching, synchronization, refreshing, merging identical requests (deduplication), determining staleness and refetching in the background, cleaning up unused data, and pagination. Building these features directly is quite a large undertaking. Delegating server state to such tools leaves only truly client-side values in the global store, significantly reducing its size. This understanding is based on reading and summarizing the documentation; I haven't personally verified how much reduction occurs in actual projects.

As shown in [Details → CSR, SSR, SSG](#/post/fe-rendering-modes), depending on the rendering method, server data may be included in HTML from the very beginning, so where you retrieve server state also varies accordingly.

## When to Use a Global State Library

When starting locally and lifting up, there will come a time when you need to pass props through multiple levels. At that point, your options are roughly as follows:

| Option | Applicable Case |
|---|---|
| Lift directly | When it can be resolved within two or three levels |
| Context | Values used widely and rarely changed, such as theme or logged-in user |
| External Store (Redux, Zustand, etc.) | When many places read and modify frequently, and you want to narrow the update scope |
| Server State Tools | Data whose source resides on the server |

The core of an external store is surprisingly small: a value, a read function, a mutation function, and a list of subscribers. The code below implements this structure in pure JavaScript and was run directly with Node.js.

```js
function createStore(init) {
  let s = init; const ls = new Set();
  return {
    get: () => s,
    set: (f) => { const n = f(s); if (Object.is(n, s)) return; s = n; ls.forEach(l => l()); },
    sub: (l) => { ls.add(l); return () => ls.delete(l); },
  };
}
const st = createStore({ count: 0 });
let calls = 0;
const un = st.sub(() => calls++);
st.set(s => ({ count: s.count + 1 }));  // 알림
st.set(s => s);                         // 같은 값이라 알림 없음
un();
st.set(s => ({ count: s.count + 1 }));  // 구독 해제 후라 알림 없음
console.log(st.get(), calls);           // { count: 2 } 1
```

It's important that subscribers are notified only when values change. Libraries that reduce unnecessary re-renders are an evolution of this concept. This connects to the discussion on [Frontend Performance](#/post/fe-performance).

## Common Misconceptions

- Keeping all state globally is better organized: The documentation advocates the opposite. Keep it close and lift it only when needed.
- Data received from the server is just state: It can become stale, and since there's a separate source, management differs.
- Using a library solves design issues: State structures with duplication or contradictions cannot be fixed by any library.
- Redux is the standard and must always be used: It's just one option; the criteria are scale and update patterns.

<details>
<summary>Detailed explanation: Derived values and redundant state examples</summary>

Taking a shopping cart as an example, keep only `items` (the product array) as state, and calculate `totalPrice` and `count` from `items` during rendering. If these values are stored separately as state, you must update all three when removing a product; missing even one will cause the UI to become inconsistent.

The same applies to selected items. Storing a `selectedItem` object means that if you change the name in `items`, the selected item retains its old name. If you store only `selectedId`, it always finds the latest entry in the list, so inconsistency is impossible. This example illustrates applying the documentation's principles to different scenarios.

</details>

## Reference Links

- React Docs, Sharing State Between Components: https://react.dev/learn/sharing-state-between-components
- React Docs, Choosing the State Structure: https://react.dev/learn/choosing-the-state-structure
- TanStack Query, Overview: https://tanstack.com/query/latest/docs/framework/react/overview

← [Concept Map](#/post/fe-map)

Related posts: [Component Design](#/post/fe-component) · [CSR, SSR, SSG](#/post/fe-rendering-modes) · [Frontend Performance](#/post/fe-performance)
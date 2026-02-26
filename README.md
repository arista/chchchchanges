# chchchchanges

Automatic change tracking for JavaScript objects using Proxies. Wrap your objects once, then get notified whenever something changes — no manual subscriptions, no decorators, no boilerplate.

## Quick Start

```ts
import { Changes } from "chchchchanges"

const state = Changes.enableChanges({ count: 0 })

Changes.detectChanges(
  () => { void state.count },          // track dependencies
  () => { console.log("changed!") },   // called when they change
)

state.count = 1  // logs: "changed!"
state.count = 2  // logs: "changed!"
```

`detectChanges` runs your function to discover what it reads, then calls your callback whenever any of those values change. It works with nested objects, arrays, Maps, and Sets — any value returned through an enabled object is automatically tracked.

```ts
const app = Changes.enableChanges({
  user: { name: "Alice" },
  todos: [{ text: "Ship it", done: false }],
  tags: new Set(["urgent"]),
})

Changes.detectChanges(
  () => { void app.todos[0].done },
  () => { console.log("todo status changed") },
)

app.todos[0].done = true  // logs: "todo status changed"
```

## Before/After Callbacks

Capture state before a change takes effect, then react after:

```ts
Changes.detectChanges(
  () => { void state.count },
  {
    before: () => {
      const oldVal = state.count
      return () => {
        console.log(`${oldVal} -> ${state.count}`)
      }
    },
  },
)

state.count = 42  // logs: "0 -> 42"
```

## Cached Functions

Wrap a computation so its result is cached and automatically invalidated when dependencies change. Cached functions also act as change sources — anything watching them gets notified too.

```ts
const state = Changes.enableChanges({ items: [10, 20, 30] })

const total = Changes.createCachedFunction(() =>
  state.items.reduce((sum, n) => sum + n, 0),
)

total()  // 60 (computed)
total()  // 60 (cached)

state.items.push(40)
total()  // 100 (recomputed)
```

Chain them for derived computations with minimal fan-out:

```ts
const subtotal = Changes.createCachedFunction(() =>
  cart.items.reduce((sum, item) => sum + item.price, 0),
)
const tax = Changes.createCachedFunction(() => subtotal() * taxRate.value)
const grandTotal = Changes.createCachedFunction(() => subtotal() + tax())

// Changing an item price only recomputes subtotal, tax, and grandTotal
// — not every individual watcher
```

## Cleanup

Call `remove()` to stop listening:

```ts
const detecting = Changes.detectChanges(
  () => { void state.count },
  () => { console.log("changed") },
)

detecting.remove()
state.count = 99  // nothing logged
```

## API

### `Changes`

Top-level entry point. Uses a shared global `ChangeDomain`.

| Method | Description |
|---|---|
| `enableChanges<T>(val: T): T` | Wrap a value for change tracking |
| `detectChanges<T>(f: () => T, onChange): ChangeDetecting<T>` | Track dependencies and get notified on change |
| `createCachedFunction<T>(f: () => T): () => T` | Create a cached, auto-invalidating computation |
| `createDomain(): ChangeDomain` | Create an independent tracking domain |
| `globalDomain` | The shared `ChangeDomain` used by the shorthand methods |

### `ChangeDomain`

An isolated change-tracking scope. Objects from one domain cannot be used in another.

Has the same `enableChanges`, `detectChanges`, and `createCachedFunction` methods as `Changes`, but scoped to this domain.

### `ChangeDetecting<T>`

Returned by `detectChanges`.

| Property | Description |
|---|---|
| `result: T` | The return value of the tracked function |
| `remove()` | Stop listening for changes |

### `ChangeCallback`

The `onChange` parameter accepts three forms:

```ts
// Simple after-callback (default)
() => void

// Before-callback, optionally returning an after-callback
{ before: () => (() => void) | void }

// Explicit after-callback
{ after: () => void }
```

Before-callbacks run before the mutation takes effect. If a before-callback returns a function, that function runs after the mutation.

## Supported Types

| Type | Tracking granularity |
|---|---|
| **Object** | Per-property change sources for get, set, has, delete, defineProperty, ownKeys, prototype, extensibility |
| **Array** | Single change source for all reads/writes (optimized for iteration-heavy use) |
| **Map** | Per-key sources for get/has, plus sources for size, keys, and clear |
| **Set** | Per-key source for has, plus sources for size, keys, and clear |
| **Primitives** | Passed through unchanged |
| **Functions** | Proxied for apply/construct passthrough; getter-only properties use cached functions |

## How It Works

`enableChanges` wraps objects in [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) handlers that intercept reads and writes. During `detectChanges`, reads subscribe the current listener to fine-grained change sources. Writes notify those sources through a transaction that orchestrates before-callbacks, performs the mutation, then drains after-callbacks.

Nested objects returned through a proxy are automatically wrapped. The same proxy is always returned for the same underlying object (identity-preserving).

## Install

```
npm install chchchchanges
```

## License

ISC

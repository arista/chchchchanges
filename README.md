# chchchchanges

Automatic change tracking for JavaScript objects using Proxies. Wrap your objects once, then get notified whenever something changes — no manual subscriptions, no decorators, no boilerplate.

## Quick Start

```ts
import { Changes } from "chchchchanges"

const domain = Changes.create()
const state = domain.enableChanges({ count: 0 })

domain.detectChanges(
  () => { void state.count },          // track dependencies
  () => { console.log("changed!") },   // called when they change
)

state.count = 1  // logs: "changed!"
state.count = 2  // logs: "changed!"
```

`detectChanges` runs your function to discover what it reads, then calls your callback whenever any of those values change. It works with nested objects, arrays, Maps, and Sets — any value returned through an enabled object is automatically tracked.

```ts
const domain = Changes.create()
const app = domain.enableChanges({
  user: { name: "Alice" },
  todos: [{ text: "Ship it", done: false }],
  tags: new Set(["urgent"]),
})

domain.detectChanges(
  () => { void app.todos[0].done },
  () => { console.log("todo status changed") },
)

app.todos[0].done = true  // logs: "todo status changed"
```

## Before/After Callbacks

Capture state before a change takes effect, then react after:

```ts
domain.detectChanges(
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
const domain = Changes.create()
const state = domain.enableChanges({ items: [10, 20, 30] })

const total = domain.createCachedFunction(() =>
  state.items.reduce((sum, n) => sum + n, 0),
)

total.call()  // 60 (computed)
total.call()  // 60 (cached)

state.items.push(40)
total.call()  // 100 (recomputed)
```

Chain them for derived computations with minimal fan-out:

```ts
const subtotal = domain.createCachedFunction(() =>
  cart.items.reduce((sum, item) => sum + item.price, 0),
)
const tax = domain.createCachedFunction(() => subtotal.call() * taxRate.value)
const grandTotal = domain.createCachedFunction(() => subtotal.call() + tax.call())

// Changing an item price only recomputes subtotal, tax, and grandTotal
// — not every individual watcher
```

## Subscriptions

Subscribe directly to an object to receive detailed change notifications:

```ts
const domain = Changes.create()
const state = domain.enableChanges({ count: 0 })

domain.subscribe(state, (change) => {
  console.log(change.type, change.prop, change.value)
})

state.count = 5  // logs: "ObjectSet" "count" 5
```

Subscriptions report the specific mutation — property name, new value, array method called, etc. Use before-callbacks to capture state before the change:

```ts
domain.subscribe(state, {
  before: (change) => {
    const oldVal = state[change.prop]
    return () => console.log(`${change.prop}: ${oldVal} -> ${state[change.prop]}`)
  },
})
```

## Cleanup

Call `remove()` to stop listening. Both `ChangeDetecting` and `CachedFunction` support this:

```ts
const detecting = domain.detectChanges(
  () => { void state.count },
  () => { console.log("changed") },
)

detecting.remove()
state.count = 99  // nothing logged
```

```ts
const total = domain.createCachedFunction(() =>
  state.items.reduce((sum, n) => sum + n, 0),
)

total.remove()  // disconnect when no longer needed
```

## API

### `Changes`

Top-level entry point for creating change domains.

| Method | Description |
|---|---|
| `create(config?: ChangesConfig): ChangeDomain` | Create a new change-tracking domain |

### `ChangesConfig`

Configuration options for creating a domain.

| Property | Description |
|---|---|
| `name?: string` | Optional name for the domain (defaults to "Domain#N") |
| `logger?: ChangeEventLogger` | Optional logger function for debugging events |

### `ChangeDomain`

An isolated change-tracking scope. Objects from one domain cannot be used in another.

| Method | Description |
|---|---|
| `enableChanges<T>(val: T, name?: string): T` | Wrap a value for change tracking |
| `detectChanges<T>(f: () => T, onChange, name?): ChangeDetecting<T>` | Track dependencies and get notified on change |
| `createCachedFunction<T>(f: () => T, name?): CachedFunction<T>` | Create a cached, auto-invalidating computation |
| `subscribe<T extends Object>(obj: T, listener): T` | Subscribe to changes on an object |
| `unsubscribe<T extends Object>(obj: T, listener)` | Remove a subscription |

### `ChangeDetecting<T>`

Returned by `detectChanges`.

| Property | Description |
|---|---|
| `result: T` | The return value of the tracked function |
| `remove()` | Stop listening for changes |

### `CachedFunction<T>`

Returned by `createCachedFunction`.

| Method | Description |
|---|---|
| `call(): T` | Execute the cached function, returning the cached value if still valid |
| `remove()` | Disconnect from change notifications (call when no longer needed) |
| `addListener(listener: () => void)` | Subscribe to be notified when the cached value is invalidated |
| `removeListener(listener: () => void)` | Unsubscribe from invalidation notifications |

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

## Debugging

Pass a logger function when creating a domain to receive detailed events:

```ts
const domain = Changes.create({
  name: "MyApp",
  logger: (event) => console.log(event),
})

const state = domain.enableChanges({ count: 0 }, "state")

domain.detectChanges(
  () => { void state.count },
  () => {},
  "CountWatcher",
)
// logs: { type: "DetectChangesEntered", domain: "MyApp", detectChanges: "CountWatcher#1" }
// logs: { type: "ChangeSourceReferenced", domain: "MyApp", source: "state.count", detectChanges: "CountWatcher#1" }
// logs: { type: "DetectChangesExited", domain: "MyApp", detectChanges: "CountWatcher#1" }

state.count = 1
// logs: { type: "TransactionStarted", domain: "MyApp", transaction: 1 }
// logs: { type: "BeforeChangeNotified", ... }
// logs: { type: "AfterChangeNotified", ... }
// logs: { type: "TransactionEnded", domain: "MyApp", transaction: 1 }
```

See [debugging.md](./docs/debugging.md) for full event documentation.

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

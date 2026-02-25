# Plans

This document tracks the roadmap and planned features for chchchchanges

## Current Focus

Specify the [architecture](./docs/ARCHITECTURE.md) and [behaviors](./docs/change-sources.md)

Determine if the specification is clear so far (no implementation yet, although thoughts about the implementation are welcome)

Start looking at the [change sources](./docs/change-sources.md) to see if the rules specified there will achieve the desired results.

Take a look at the [design](./docs/design.md), which isn't set in stone yet - it's my best guess as to what will be needed.

Think carefully about notification process outlined in [change-transactions](./docs/change-transaction.md).  This process turned out to be more complex than I expected, it would help to see if I've missed something.

Please ask any clarifying questions, but eventually would like to see the analysis placed in ./analysis.md

## TODO

### Missing Object Types

Determine which additional object types need special handling in [change-sources.md](./docs/change-sources.md):

- **WeakMap / WeakSet**: Cannot be iterated, so limited change tracking is possible. Probably best to leave unproxied or only track `get`/`has`/`set`/`delete`.
- **Date**: Has many mutator methods (`setTime`, `setFullYear`, etc.). May need at least a simple "value changed" source.
- **TypedArrays** (`Uint8Array`, `Float64Array`, etc.): Similar to Arrays, could use a single change source.
- **RegExp**: Has mutable `lastIndex`. Probably fine to treat as a generic Object.
- **Promise**: Should likely pass through unproxied - proxying `then`/`catch` could cause subtle issues.
- **Functions**: `apply()` and `construct()` pass through with no change tracking, but should a bare function be wrapped at all?

### Cycle Detection

Decide on a strategy for detecting dependency cycles in afterNotification chains. The `wasNotified` flag prevents double-notification of a single listener, but doesn't catch cycles where after-callbacks create new listeners that get triggered in the same transaction. See [change-transaction.md](./docs/change-transaction.md#dependency-cycles).

### Nested before-Callback Depth

Consider whether there should be a recursion depth limit for nested before-callbacks. A before-callback can trigger mutations that reuse the current transaction, whose before-callbacks can trigger further mutations, leading to deeply nested call stacks.

### Extension Mechanism

Consider allowing applications to define their own ChangeProxy behaviors for custom object types. See FIXME in [change-sources.md](./docs/change-sources.md).

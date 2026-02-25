# Analysis

Review of the chchchchanges specification: architecture, change sources, design, and change transactions.

## Overall Assessment

The specification is well-structured and the core reactive model is sound. The concept of transparent dependency tracking via Proxies, with one-shot listeners that are re-established by re-running functions, is a clean design.

Most naming inconsistencies, missing behaviors, and ambiguities identified in the initial review have been addressed. The remaining open items are future design considerations.

---

## Architecture (ARCHITECTURE.md)

The architecture document is clear and well-organized.

---

## Change Sources (change-sources.md)

### Missing Object Types (the FIXMEs)

Types worth considering:

- **WeakMap / WeakSet**: Cannot be iterated, so limited change tracking is possible. Probably best to leave unproxied or only track `get`/`has`/`set`/`delete`.
- **Date**: Has many mutator methods (`setTime`, `setFullYear`, etc.). If Date objects are accessed through change-enabled objects, they probably need at least a simple "value changed" source.
- **TypedArrays** (`Uint8Array`, `Float64Array`, etc.): Similar to Arrays, could use a single change source.
- **RegExp**: Has mutable `lastIndex`. Probably fine to treat as a generic Object.
- **Promise**: Should likely pass through unproxied - proxying a Promise's `then`/`catch` could cause subtle issues.
- **Functions**: The spec handles `apply()` and `construct()` traps (pass through, no change behavior), but should a bare function (not a method on a proxied object) be wrapped? Probably not, since functions themselves don't change.

---

## Design (design.md)

### ChangeDetecting.remove() and Listener Lifecycle

The `ChangeDetecting.remove()` function is well-motivated (preventing callback reference leaks). Worth noting: since listeners are one-shot (cleared on notification), the leak only persists until the next change. `remove()` is still valuable for cases where the application tears down a component but the underlying data lives on and rarely changes.

---

## Change Transactions (change-transaction.md)

### Nested before-Callbacks and Transaction Growth

When a before-callback triggers a mutation that calls `withTransaction`, the existing transaction is reused (since `withTransaction` checks for an existing transaction). This means:

1. The nested mutation's `notify()` calls add more items to the same transaction
2. Those notify calls process their own before-callbacks immediately
3. Any after-callbacks from those nested notifications are added to the same afterNotifications list

This could lead to deeply nested call stacks if before-callbacks trigger chains of mutations. Consider whether there should be a recursion depth limit.

---

## Resolved Items

The following issues were identified and have been fixed in the spec:

### Bugs / Errors Fixed
1. ~~`SetChangeSources` fields named `mapSize`, `mapKeys`, `mapClear`~~ - renamed to `setSize`, `setKeys`, `setClear`
2. ~~`ChangeSubscription` has duplicate `source` field~~ - removed `ChangeSourceLocator` field
3. ~~Code example in change-transaction.md labeled as `get()` trap~~ - corrected to `set()` trap with `withTransaction` and proper `changeContext` gating
4. ~~`getPrototypeOf` / `setPrototypeOf` reference wrong ChangeSource name~~ - corrected to `ObjectPrototypeOfChangeSource`
5. ~~`getOwnPropertyDescriptor` references `ObjectOwnPropertyChangeSource`~~ - corrected to `ObjectOwnPropertyDescriptorChangeSource`

### Missing Behaviors Added
6. ~~`Map.has(key)` subscribed to wrong source~~ - now subscribes to `MapHasKeyChangeSource[key]`
7. ~~`Set.has(key)` behavior missing~~ - added with `SetHasChangeSource[key]` and `SetClearChangeSource`
8. ~~`Set.add(key, val)` wrong signature~~ - corrected to `add(key)`
9. ~~Missing `this` note for Sets~~ - added (use target, not receiver)
10. ~~`apply()` and `construct()` had no explicit behavior~~ - added "no change tracking - pass through to target"

### Clarifications Resolved
11. ~~ChangeProxy auto-wrapping vs enableChanges~~ - ChangeProxy section now states it passes values through `enableChanges`
12. ~~`createCachedFunction` location inconsistency~~ - architecture corrected to say "obtained from a ChangeDomain"
13. ~~`ChangeSource.notify()` vs `ChangeTransaction.notify()`~~ - removed `notify()` from `ChangeSource`
14. ~~`detectChanges` async support unclear~~ - explicitly states async functions are not supported
15. ~~afterNotifications iteration strategy undefined~~ - specified as index-based iteration
16. ~~Cross-domain transaction interaction~~ - modifying objects in another ChangeDomain during a transaction is now an error
17. ~~ChangeSource cleanup ordering~~ - clarified that cleanup happens strictly after all afterNotifications
18. ~~CachedFunction ChangeContext subscription mechanism~~ - added Cached Functions section to change-sources.md detailing subscription and invalidation behavior
19. ~~Re-entrancy during detection~~ - design.md now recommends against mutations during `detectChanges` and `createCachedFunction`, since notifications are suppressed
20. ~~ChangeDomain isolation cross-domain error~~ - `enableChanges` now explicitly throws an error if the value is already change-enabled in another ChangeDomain

---

## Remaining Future Design Considerations

1. Decide on a cycle detection strategy for afterNotification chains
2. Determine which additional object types need special handling (Date, WeakMap/WeakSet, TypedArrays, Promise)
3. Consider recursion depth limits for nested before-callbacks
4. Consider the extension mechanism (FIXME in change-sources.md)

# Plans

This document tracks the roadmap and planned features for chchchchanges

## Current Focus

Implement Step 1 from the Initial Development Plan below.  Implement on branch nsa-changesourcelistener

## Initial Development Plan

The implementation is broken into 10 steps, each intended as a reviewable unit. Each step builds on the previous ones and includes its own tests.

### Step 1: ChangeSource and ChangeListener ✅

The foundational pub/sub primitives. A ChangeSource holds a set of ChangeListeners and can list-and-clear them. A ChangeListener tracks its subscriptions across multiple ChangeSources, supports a `wasNotified` flag, and can unsubscribe from all sources at once.

Key types: `ChangeSource`, `ChangeListener`, `ChangeSubscription`, `ChangeCallback` (`AfterChangeCallback`, `BeforeChangeCallback`).

Tests: subscribe/unsubscribe, listAndClearListeners clears the list, listener can subscribe to multiple sources, duplicate subscribe is idempotent, wasNotified flag behavior.

### Step 2: ChangeTransaction

The notification orchestration layer. Implements `notify(source)` which processes before-callbacks immediately (allowing recursive nesting) and queues after-callbacks. The `complete()` method drains after-callbacks via index-based iteration (supporting growth during iteration), then cleans up empty ChangeSources.

Tests: before-callback runs immediately with access to old values, after-callback runs on complete, nested mutations during before-callbacks reuse the transaction, after-callbacks added during iteration are processed, empty ChangeSources are removed after completion, wasNotified prevents double-notification.

### Step 3: ChangeDomain, ChangeContext, and detectChanges

The coordination layer. ChangeDomain manages a current ChangeContext and current ChangeTransaction. `withTransaction` creates or reuses a transaction, skipping entirely if a ChangeContext is active (inside detectChanges). `detectChanges` installs a ChangeContext, runs the function, and returns a `ChangeDetecting` result with `remove()` for cleanup.

Tests: detectChanges returns the function's result, onChange fires when a dependency changes, nested detectChanges suspends/resumes outer context, remove() unsubscribes from all sources, withTransaction skips when inside detectChanges.

### Step 4: ChangeProxy infrastructure and enableChanges

The proxy creation and type-dispatch framework. Implements the object-to-proxy mapping using well-known Symbols (navigate between proxy and target, check domain ownership). `enableChanges` passes through primitives, returns existing proxies as-is, errors on cross-domain conflicts, and dispatches to type-specific proxy handlers based on the target (plain Object, Array, Map, Set). Initially only the Object handler is registered; others are added in later steps.

Tests: primitives pass through unchanged, same proxy returned for same object, proxy-target Symbol navigation works, cross-domain wrap throws, enableChanges is idempotent.

### Step 5: Object ChangeProxy

The most complex handler — implements all Object proxy traps per the spec. Each trap either subscribes to or notifies the appropriate ChangeSources (ObjectPropertyChangeSource, ObjectHasPropertyChangeSource, ObjectOwnKeysChangeSource, ObjectOwnPropertyDescriptorChangeSource, ObjectPrototypeOfChangeSource, ObjectIsExtensibleChangeSource). Return values and arguments are passed through `enableChanges` to auto-wrap nested objects. The getter-with-no-setter optimization (wrapping in a CachedFunction) is deferred to Step 9.

Tests: get subscribes to property source, set notifies property + hasProperty + ownKeys, delete notifies same as set, has subscribes to hasProperty, defineProperty notifies ownPropertyDescriptor + property + hasProperty + ownKeys, ownKeys subscribes to ownKeys source, prototype traps, isExtensible/preventExtensions, returned objects are auto-wrapped, end-to-end with detectChanges (mutate property → onChange fires).

### Step 6: Array ChangeProxy

Arrays use a single ArrayChangeSource. All accessor traps (get, has, ownKeys, etc.) subscribe to it; all mutator traps (set, deleteProperty, defineProperty) notify it. No special method interception needed since array methods use the underlying traps.

Tests: array element access subscribes, push/pop/splice trigger onChange, iteration subscribes, sort triggers onChange, index assignment triggers onChange, returned elements are auto-wrapped.

### Step 7: Map ChangeProxy

Extends Object proxy with Map-specific function traps. Intercepts `get` to detect Map method access and returns wrapped functions. Implements MapKeyChangeSource, MapHasKeyChangeSource, MapSizeChangeSource, MapKeysChangeSource, and MapClearChangeSource per the spec. Map methods must call through to the target (not the proxy receiver) for `this`.

Tests: map.get(key) subscribes to MapKey + MapClear, map.has(key) subscribes to MapHasKey + MapClear, map.set notifies MapKey + MapHasKey + MapSize + MapKeys, map.delete same as set, map.clear notifies MapSize + MapKeys + MapClear, iteration subscribes to MapKeys, map.size subscribes to MapSize, values returned from map.get are auto-wrapped.

### Step 8: Set ChangeProxy

Similar to Map but for Sets. Implements SetHasChangeSource, SetSizeChangeSource, SetKeysChangeSource, and SetClearChangeSource. Set methods also call through to the target for `this`.

Tests: set.has subscribes to SetHas + SetClear, set.add notifies SetHas + SetSize + SetKeys, set.delete same as add, set.clear notifies SetSize + SetKeys + SetClear, iteration subscribes to SetKeys, set.size subscribes to SetSize.

### Step 9: CachedFunction

Implements `createCachedFunction` on ChangeDomain. The caching function uses `detectChanges` internally to track dependencies of the wrapped function. On first call (or when invalidated), it evaluates the function in a new ChangeContext and caches the result. It also acts as a ChangeSource — if called during another `detectChanges`, the caller subscribes to the CachedFunction's source. When invalidated, it notifies its own listeners. The result is passed through `enableChanges`.

Also wires CachedFunction into the Object proxy: when `get` encounters a getter-with-no-setter property, it wraps the getter in a CachedFunction and subscribes to that instead of the plain ObjectPropertyChangeSource.

Tests: caches result and returns same value on second call, invalidates when dependency changes, re-evaluates after invalidation, acts as a ChangeSource for outer detectChanges, getter-only properties use CachedFunction, nested CachedFunctions work correctly.

### Step 10: Public API

The top-level `Changes` export that ties everything together. Creates a global ChangeDomain. Exposes `createDomain()`, `globalDomain`, and shorthand methods (`enableChanges`, `detectChanges`, `createCachedFunction`) that delegate to the global domain. This is the library's entry point exported from `src/index.ts`.

Tests: Changes.enableChanges wraps objects, Changes.detectChanges tracks and notifies, Changes.createCachedFunction works, Changes.createDomain returns independent domains, cross-domain interactions error correctly, full end-to-end scenarios (nested objects, collections, cached functions, before/after callbacks).

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

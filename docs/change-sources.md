# Change Sources

The bulk of the library's functionality is involved in identifying and notifying [ChangeSources](./ARCHITECTURE.md) for various types of Objects.  This boils down to knowing which intercepted Proxy calls imply the existence of a ChangeSource, and which intercepted Proxy calls imply a possible change to be published by one of those ChangeSources.

Note that all of this is "best effort".  It's possible for an application to use functions like defineProperty() to create objects that subvert some of the assumptions made here.  The idea is for these rules to try to work with Objects that behave in typically-expected ways.

For each type of Object, there is a list of potential ChangeSources, and what should happen in response to Proxy traps for the ChangeProxy wrapping that Object:

When "subscribe to ...ChangeSource" is specified, that means:

* see if there is currently a ChangeContext for the ChangeProxy's ChangeDomain.  If so:
    * create the ChangeSource, if not already created
    * add a ChangeListener from the ChangeContext to the ChangeSource

When "notify ...ChangeSource" is specified, that means:

* see if the ChangeSource exists.  If so:
    * send the notification to that ChangeSource

Unless otherwise specified, once it has executed the specified behaviors, the ChangeProxy should pass the call to the proxy's target (the "wrapped" Object).  Before doing so, it should wrap any arguments in ChangeProxies, and wrap any return value in ChangeProxies.

Some Object types also intercept specific function calls, aka "function traps".  Where those are specified, that means that calling get({function name}) needs to return a Proxied wrapper around the underlying function, and the specified behavior should be invoked when that Proxy's apply() method is called.

## Object Change Sources

These apply to "generic" Objects, that aren't covered by other cases.

ChangeSources:

* ObjectPrototypeOfChangeSource
* ObjectIsExtensibleChangeSource
* ObjectOwnPropertyDescriptorChangeSource[prop]
* ObjectHasPropertyChangeSource[prop]
* ObjectPropertyChangeSource[prop]
* ObjectOwnKeysChangeSource

Proxy traps:

* get(prop)
    * subscribe to ObjectPropertyChangeSource[prop]
* has(prop)
    * subscribe to ObjectHasPropertyChangeSource[prop]
* set(prop, value)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
* deleteProperty(prop)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
* defineProperty(prop)
    * notify ObjectPropertyChangeSource[prop]
    * notify ObjectHasPropertyChangeSource[prop]
    * notify ObjectOwnKeysChangeSource
    * notify ObjectOwnPropertyDescriptorChangeSource[prop]
* getOwnPropertyDescriptor(prop)
    * subscribe to ObjectOwnPropertyChangeSource[prop]
* getPrototypeOf()
    * subscribe to ObjectPropertyChangeSource
* setPrototypeOf()
    * notify ObjectPropertyChangeSource
* isExtensible()
    * subscribe to ObjectIsExtensibleChangeSource
* preventExtensions()
    * notify ObjectIsExtensibleChangeSource
* ownKeys()
    * subscribe to ObjectOwnKeysChangeSource
* apply()
* construct()

## Array Change Sources

Arrays inherit the same ChangeSources and proxy trap behaviors from Objects, while adding some sources and behaviors:

ChangeSources:

* ArrayLengthChangeSource
* ArrayElementChangeSource[index]
* ArrayIteratorChangeSource



FIXME - specify this

## Map Change Sources

FIXME - specify this

## Set Change Sources

FIXME - specify this

## Others???

FIXME - are there other objects that should be treated specially?

## Extension Mechanism???

FIXME - allow an application to define its own ChangeProxy behaviors?

---

## Implementation Notes

### Arrays

Arrays can largely reuse the Object rules. Unlike Map/Set, array methods like `push`, `pop`, `splice`, etc. operate on properties via `this[index]` and `this.length`, which triggers the proxy's `get`/`set`/`deleteProperty` traps.

For example, `arr.push(item)` triggers:
1. `get("push")` — accessing the method
2. `get("length")` — push reads current length
3. `set(index, item)` — push assigns to the next index
4. `set("length", newLength)` — push updates length

Considerations:
- A single method call triggers multiple traps — batching notifications may be desirable
- Iteration (`forEach`, `for...of`, `map`, etc.) creates subscriptions to many indices — may want an `ArrayIteratorChangeSource` for coarse-grained "anything changed" tracking
- Methods like `includes`, `indexOf` read every element, creating many fine-grained subscriptions

For a first pass, Object rules should work; Array-specific optimizations can be added later based on real-world usage patterns.

### Map and Set

Map and Set **cannot** reuse Object rules. Their methods operate on internal slots (`[[MapData]]`, `[[SetData]]`) that proxies cannot intercept. When `map.set(key, value)` executes, only the `get("set")` trap fires — the actual mutation is invisible to the proxy.

**Solution:** Intercept method names in the `get` trap and return wrapped functions that subscribe/notify appropriately (see "function traps" in the preamble above).

**`this` binding issue:** Map/Set methods check internal slots and throw `TypeError` if `this` isn't a real Map/Set. Wrapped methods must call the original method on the target, not the proxy:

```javascript
get(target, prop, receiver) {
  const value = Reflect.get(target, prop, target)
  if (typeof value === 'function') {
    return function(...args) {
      // subscribe/notify logic here
      return value.apply(target, args)  // call on target
    }
  }
  return value
}
```

**Special symbols to handle:**
- `Symbol.iterator` — used by `for...of`, spread, `Array.from()`. Should subscribe to contents/keys source.
- `Symbol.toStringTag` — pass through for proper `Object.prototype.toString()` behavior
- `size` — a getter, not a method; handle directly in `get` trap

**Suggested ChangeSources for Map:**

| Operation | Subscribe | Notify |
|-----------|-----------|--------|
| `get(key)` | MapKey[key] | — |
| `has(key)` | MapHasKey[key] | — |
| `set(key, val)` | — | MapKey[key], MapHasKey[key], MapSize, MapKeys |
| `delete(key)` | — | MapKey[key], MapHasKey[key], MapSize, MapKeys |
| `clear()` | — | all keys, MapSize, MapKeys |
| `size` | MapSize | — |
| `keys()`/`values()`/`entries()`/`forEach()`/`Symbol.iterator` | MapKeys | — |

Set is similar but without key/value distinction — just membership (`SetHas[value]`, `SetSize`, `SetValues`).

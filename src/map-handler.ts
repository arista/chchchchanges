import { ChangeSource } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import { CHANGE_PROXY_STATE, enableChanges } from "./change-proxy.js"
import type { ObjectChangeSources } from "./object-handler.js"
import { createObjectHandler } from "./object-handler.js"

export interface MapChangeSources extends ObjectChangeSources {
  mapKey: Map<unknown, ChangeSource> | null
  mapHasKey: Map<unknown, ChangeSource> | null
  mapSize: ChangeSource | null
  mapKeys: ChangeSource | null
  mapClear: ChangeSource | null
}

function subscribeSingle(state: ChangeProxyState, field: "mapSize" | "mapKeys" | "mapClear"): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = state.changeSources as MapChangeSources
  if (!cs[field]) {
    cs[field] = new ChangeSource(() => {
      cs[field] = null
    })
  }
  cs[field]!.subscribe(ctx.listener)
}

function subscribeKeyed(
  state: ChangeProxyState,
  field: "mapKey" | "mapHasKey",
  key: unknown,
): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = state.changeSources as MapChangeSources
  if (!cs[field]) cs[field] = new Map()
  const map = cs[field]!
  let source = map.get(key)
  if (!source) {
    source = new ChangeSource(() => {
      map.delete(key)
      if (map.size === 0) cs[field] = null
    })
    map.set(key, source)
  }
  source.subscribe(ctx.listener)
}

function wrapValueIterator(
  iter: IterableIterator<unknown>,
  domain: ChangeProxyState["changeDomain"],
): IterableIterator<unknown> {
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const result = iter.next()
      if (result.done) return result
      return { done: false, value: enableChanges(result.value, domain) }
    },
  }
}

function wrapEntryIterator(
  iter: IterableIterator<[unknown, unknown]>,
  domain: ChangeProxyState["changeDomain"],
): IterableIterator<[unknown, unknown]> {
  return {
    [Symbol.iterator]() {
      return this
    },
    next() {
      const result = iter.next()
      if (result.done) return result
      return {
        done: false,
        value: [result.value[0], enableChanges(result.value[1], domain)],
      }
    },
  }
}

export function createMapHandler(state: ChangeProxyState): ProxyHandler<object> {
  const domain = state.changeDomain
  const target = state.target as Map<unknown, unknown>

  // Pre-initialize changeSources with both Object and Map fields
  // so inherited Object traps can safely cast to ObjectChangeSources
  state.changeSources = {
    prototypeOf: null,
    isExtensible: null,
    ownPropertyDescriptor: null,
    hasProperty: null,
    property: null,
    ownKeys: null,
    cachedGetters: null,
    mapKey: null,
    mapHasKey: null,
    mapSize: null,
    mapKeys: null,
    mapClear: null,
  }

  const objectHandler = createObjectHandler(state)

  // Pre-create wrapped Map methods (stable references, no per-access allocation)
  const wrappedGet = (key: unknown) => {
    subscribeKeyed(state, "mapKey", key)
    subscribeSingle(state, "mapClear")
    return enableChanges(target.get(key), domain)
  }

  const wrappedHas = (key: unknown) => {
    subscribeKeyed(state, "mapHasKey", key)
    subscribeSingle(state, "mapClear")
    return target.has(key)
  }

  const wrappedSet = (key: unknown, value: unknown) => {
    const wrappedValue = enableChanges(value, domain)
    if (domain.changeContext != null) {
      target.set(key, wrappedValue)
      return state.proxy
    }
    domain.withTransaction((t) => {
      const cs = state.changeSources as MapChangeSources | null
      t.notify(cs?.mapKey?.get(key) ?? null)
      t.notify(cs?.mapHasKey?.get(key) ?? null)
      t.notify(cs?.mapSize ?? null)
      t.notify(cs?.mapKeys ?? null)
      t.notifySubscription(state, {
        type: "MapSet",
        target: state.proxy as Map<unknown, unknown>,
        key,
        value: wrappedValue,
      })
      target.set(key, wrappedValue)
    })
    return state.proxy
  }

  const wrappedDelete = (key: unknown) => {
    if (domain.changeContext != null) {
      return target.delete(key)
    }
    return domain.withTransaction((t) => {
      const cs = state.changeSources as MapChangeSources | null
      t.notify(cs?.mapKey?.get(key) ?? null)
      t.notify(cs?.mapHasKey?.get(key) ?? null)
      t.notify(cs?.mapSize ?? null)
      t.notify(cs?.mapKeys ?? null)
      t.notifySubscription(state, {
        type: "MapDelete",
        target: state.proxy as Map<unknown, unknown>,
        key,
      })
      return target.delete(key)
    })
  }

  const wrappedClear = () => {
    if (domain.changeContext != null) {
      target.clear()
      return
    }
    domain.withTransaction((t) => {
      const cs = state.changeSources as MapChangeSources | null
      t.notify(cs?.mapSize ?? null)
      t.notify(cs?.mapKeys ?? null)
      t.notify(cs?.mapClear ?? null)
      t.notifySubscription(state, {
        type: "MapClear",
        target: state.proxy as Map<unknown, unknown>,
      })
      target.clear()
    })
  }

  const wrappedKeys = () => {
    subscribeSingle(state, "mapKeys")
    return target.keys()
  }

  const wrappedValues = () => {
    subscribeSingle(state, "mapKeys")
    return wrapValueIterator(target.values(), domain)
  }

  const wrappedEntries = () => {
    subscribeSingle(state, "mapKeys")
    return wrapEntryIterator(target.entries(), domain)
  }

  const wrappedForEach = (
    callback: (value: unknown, key: unknown, map: unknown) => void,
    thisArg?: unknown,
  ) => {
    subscribeSingle(state, "mapKeys")
    target.forEach((value, key) => {
      callback.call(thisArg, enableChanges(value, domain), key, state.proxy)
    })
  }

  const wrappedIterator = () => {
    return wrappedEntries()
  }

  return {
    ...objectHandler,

    get(_target, prop, _receiver) {
      if (prop === CHANGE_PROXY_STATE) return state

      // Map property: size
      if (prop === "size") {
        subscribeSingle(state, "mapSize")
        return target.size
      }

      // Map methods
      switch (prop) {
        case "get":
          return wrappedGet
        case "has":
          return wrappedHas
        case "set":
          return wrappedSet
        case "delete":
          return wrappedDelete
        case "clear":
          return wrappedClear
        case "keys":
          return wrappedKeys
        case "values":
          return wrappedValues
        case "entries":
          return wrappedEntries
        case "forEach":
          return wrappedForEach
      }
      if (prop === Symbol.iterator) return wrappedIterator

      // Fall through to Object handler for non-Map properties
      return objectHandler.get!(_target, prop, _receiver)
    },
  }
}

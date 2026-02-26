import { ChangeSource } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import { CHANGE_PROXY_STATE } from "./change-proxy.js"
import type { ObjectChangeSources } from "./object-handler.js"
import { createObjectHandler } from "./object-handler.js"

export interface SetChangeSources extends ObjectChangeSources {
  setHas: Map<unknown, ChangeSource> | null
  setSize: ChangeSource | null
  setKeys: ChangeSource | null
  setClear: ChangeSource | null
}

function subscribeSingle(state: ChangeProxyState, field: "setSize" | "setKeys" | "setClear"): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = state.changeSources as SetChangeSources
  if (!cs[field]) {
    cs[field] = new ChangeSource(() => {
      cs[field] = null
    })
  }
  cs[field]!.subscribe(ctx.listener)
}

function subscribeKeyed(state: ChangeProxyState, key: unknown): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = state.changeSources as SetChangeSources
  if (!cs.setHas) cs.setHas = new Map()
  const map = cs.setHas
  let source = map.get(key)
  if (!source) {
    source = new ChangeSource(() => {
      map.delete(key)
      if (map.size === 0) cs.setHas = null
    })
    map.set(key, source)
  }
  source.subscribe(ctx.listener)
}

export function createSetHandler(state: ChangeProxyState): ProxyHandler<object> {
  const domain = state.changeDomain
  const target = state.target as Set<unknown>

  // Pre-initialize changeSources with both Object and Set fields
  state.changeSources = {
    prototypeOf: null,
    isExtensible: null,
    ownPropertyDescriptor: null,
    hasProperty: null,
    property: null,
    ownKeys: null,
    setHas: null,
    setSize: null,
    setKeys: null,
    setClear: null,
  }

  const objectHandler = createObjectHandler(state)

  // Pre-create wrapped Set methods
  const wrappedHas = (key: unknown) => {
    subscribeKeyed(state, key)
    subscribeSingle(state, "setClear")
    return target.has(key)
  }

  const wrappedAdd = (key: unknown) => {
    if (domain.changeContext != null) {
      target.add(key)
      return state.proxy
    }
    domain.withTransaction((t) => {
      const cs = state.changeSources as SetChangeSources | null
      t.notify(cs?.setHas?.get(key) ?? null)
      t.notify(cs?.setSize ?? null)
      t.notify(cs?.setKeys ?? null)
      target.add(key)
    })
    return state.proxy
  }

  const wrappedDelete = (key: unknown) => {
    if (domain.changeContext != null) {
      return target.delete(key)
    }
    return domain.withTransaction((t) => {
      const cs = state.changeSources as SetChangeSources | null
      t.notify(cs?.setHas?.get(key) ?? null)
      t.notify(cs?.setSize ?? null)
      t.notify(cs?.setKeys ?? null)
      return target.delete(key)
    })
  }

  const wrappedClear = () => {
    if (domain.changeContext != null) {
      target.clear()
      return
    }
    domain.withTransaction((t) => {
      const cs = state.changeSources as SetChangeSources | null
      t.notify(cs?.setSize ?? null)
      t.notify(cs?.setKeys ?? null)
      t.notify(cs?.setClear ?? null)
      target.clear()
    })
  }

  const wrappedValues = () => {
    subscribeSingle(state, "setKeys")
    return target.values()
  }

  const wrappedEntries = () => {
    subscribeSingle(state, "setKeys")
    return target.entries()
  }

  const wrappedForEach = (
    callback: (value: unknown, key: unknown, set: unknown) => void,
    thisArg?: unknown,
  ) => {
    subscribeSingle(state, "setKeys")
    target.forEach((value, key) => {
      callback.call(thisArg, value, key, state.proxy)
    })
  }

  const wrappedIterator = () => {
    subscribeSingle(state, "setKeys")
    return target.values()
  }

  const wrappedKeys = () => {
    subscribeSingle(state, "setKeys")
    return target.keys()
  }

  return {
    ...objectHandler,

    get(_target, prop, _receiver) {
      if (prop === CHANGE_PROXY_STATE) return state

      // Set property: size
      if (prop === "size") {
        subscribeSingle(state, "setSize")
        return target.size
      }

      // Set methods
      switch (prop) {
        case "has":
          return wrappedHas
        case "add":
          return wrappedAdd
        case "delete":
          return wrappedDelete
        case "clear":
          return wrappedClear
        case "values":
          return wrappedValues
        case "entries":
          return wrappedEntries
        case "forEach":
          return wrappedForEach
        case "keys":
          return wrappedKeys
      }
      if (prop === Symbol.iterator) return wrappedIterator

      // Fall through to Object handler for non-Set properties
      return objectHandler.get!(_target, prop, _receiver)
    },
  }
}

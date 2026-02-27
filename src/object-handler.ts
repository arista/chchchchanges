import { ChangeSource } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import { CHANGE_PROXY_STATE, enableChanges } from "./change-proxy.js"
import type { CachedFunction } from "./cached-function.js"

export interface ObjectChangeSources {
  prototypeOf: ChangeSource | null
  isExtensible: ChangeSource | null
  ownPropertyDescriptor: Map<PropertyKey, ChangeSource> | null
  hasProperty: Map<PropertyKey, ChangeSource> | null
  property: Map<PropertyKey, ChangeSource> | null
  ownKeys: ChangeSource | null
  cachedGetters: Map<PropertyKey, CachedFunction<unknown> | null> | null
}

function ensureCS(state: ChangeProxyState): ObjectChangeSources {
  if (!state.changeSources) {
    state.changeSources = {
      prototypeOf: null,
      isExtensible: null,
      ownPropertyDescriptor: null,
      hasProperty: null,
      property: null,
      ownKeys: null,
      cachedGetters: null,
    }
  }
  return state.changeSources as ObjectChangeSources
}

function subscribeSingle(
  state: ChangeProxyState,
  field: "prototypeOf" | "isExtensible" | "ownKeys",
): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = ensureCS(state)
  if (!cs[field]) {
    cs[field] = new ChangeSource(() => {
      cs[field] = null
    })
  }
  cs[field]!.subscribe(ctx.listener)
}

function subscribeKeyed(
  state: ChangeProxyState,
  field: "ownPropertyDescriptor" | "hasProperty" | "property",
  key: PropertyKey,
): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = ensureCS(state)
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

function getPropertyDescriptor(obj: object, prop: PropertyKey): PropertyDescriptor | undefined {
  let current: object | null = obj
  while (current) {
    const desc = Object.getOwnPropertyDescriptor(current, prop)
    if (desc) return desc
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

export function createObjectHandler(state: ChangeProxyState): ProxyHandler<object> {
  const domain = state.changeDomain

  return {
    get(target, prop, receiver) {
      if (prop === CHANGE_PROXY_STATE) return state

      // Check for cached getter-only property (fast path)
      const cs = state.changeSources as ObjectChangeSources | null
      const cachedGetter = cs?.cachedGetters?.get(prop)
      if (cachedGetter) return cachedGetter.call()

      // Check for getter-with-no-setter — wrap in CachedFunction
      if (domain.changeContext && cachedGetter === undefined) {
        const desc = getPropertyDescriptor(target, prop)
        if (desc?.get && !desc.set) {
          const csObj = ensureCS(state)
          if (!csObj.cachedGetters) csObj.cachedGetters = new Map()
          const fn = domain.createCachedFunction(() => desc.get!.call(state.proxy))
          csObj.cachedGetters.set(prop, fn)
          return fn.call()
        }
        // Negative cache: not a getter-only property
        if (cs?.cachedGetters) cs.cachedGetters.set(prop, null)
      }

      subscribeKeyed(state, "property", prop)
      const value = Reflect.get(target, prop, receiver)
      // Proxy invariant: non-configurable, non-writable own data properties
      // must return the exact target value — skip wrapping for these
      if ((typeof value === "object" && value !== null) || typeof value === "function") {
        const desc = Object.getOwnPropertyDescriptor(target, prop)
        if (desc && !desc.configurable && "value" in desc && !desc.writable) {
          return value
        }
      }
      return enableChanges(value, domain)
    },

    has(target, prop) {
      subscribeKeyed(state, "hasProperty", prop)
      return Reflect.has(target, prop)
    },

    set(target, prop, value, receiver) {
      const wrappedValue = enableChanges(value, domain)
      if (domain.changeContext != null) {
        return Reflect.set(target, prop, wrappedValue, receiver)
      }
      return domain.withTransaction((t) => {
        const cs = state.changeSources as ObjectChangeSources | null
        t.notify(cs?.property?.get(prop) ?? null)
        t.notify(cs?.hasProperty?.get(prop) ?? null)
        t.notify(cs?.ownKeys ?? null)
        t.notifySubscription(state, {
          type: "ObjectSet",
          target: state.proxy,
          prop,
          value: wrappedValue,
        })
        // Suppress subscription notifications from nested defineProperty calls
        // that may be triggered by Reflect.set when the receiver is a proxy
        return t.withSuppressedObjectChanges(state, () => {
          return Reflect.set(target, prop, wrappedValue, receiver)
        })
      })
    },

    deleteProperty(target, prop) {
      if (domain.changeContext != null) {
        return Reflect.deleteProperty(target, prop)
      }
      return domain.withTransaction((t) => {
        const cs = state.changeSources as ObjectChangeSources | null
        t.notify(cs?.property?.get(prop) ?? null)
        t.notify(cs?.hasProperty?.get(prop) ?? null)
        t.notify(cs?.ownKeys ?? null)
        t.notifySubscription(state, {
          type: "ObjectDeleteProperty",
          target: state.proxy,
          prop,
        })
        return Reflect.deleteProperty(target, prop)
      })
    },

    defineProperty(target, prop, descriptor) {
      if ("value" in descriptor) {
        descriptor = { ...descriptor, value: enableChanges(descriptor.value, domain) }
      }
      if (domain.changeContext != null) {
        return Reflect.defineProperty(target, prop, descriptor)
      }
      return domain.withTransaction((t) => {
        const cs = state.changeSources as ObjectChangeSources | null
        t.notify(cs?.property?.get(prop) ?? null)
        t.notify(cs?.hasProperty?.get(prop) ?? null)
        t.notify(cs?.ownKeys ?? null)
        t.notify(cs?.ownPropertyDescriptor?.get(prop) ?? null)
        t.notifySubscription(state, {
          type: "ObjectDefineProperty",
          target: state.proxy,
          key: prop,
          descriptor,
        })
        return Reflect.defineProperty(target, prop, descriptor)
      })
    },

    getOwnPropertyDescriptor(target, prop) {
      subscribeKeyed(state, "ownPropertyDescriptor", prop)
      const desc = Reflect.getOwnPropertyDescriptor(target, prop)
      if (desc && "value" in desc) {
        // Proxy invariant: non-configurable, non-writable data properties
        // must return the exact descriptor — skip wrapping for these
        if (!desc.configurable && !desc.writable) return desc
        return { ...desc, value: enableChanges(desc.value, domain) }
      }
      return desc
    },

    getPrototypeOf(target) {
      subscribeSingle(state, "prototypeOf")
      return Reflect.getPrototypeOf(target)
    },

    setPrototypeOf(target, proto) {
      if (domain.changeContext != null) {
        return Reflect.setPrototypeOf(target, proto)
      }
      return domain.withTransaction((t) => {
        const cs = state.changeSources as ObjectChangeSources | null
        t.notify(cs?.prototypeOf ?? null)
        t.notifySubscription(state, {
          type: "ObjectSetPrototypeOf",
          target: state.proxy,
          prototype: proto,
        })
        return Reflect.setPrototypeOf(target, proto)
      })
    },

    isExtensible(target) {
      subscribeSingle(state, "isExtensible")
      return Reflect.isExtensible(target)
    },

    preventExtensions(target) {
      if (domain.changeContext != null) {
        return Reflect.preventExtensions(target)
      }
      return domain.withTransaction((t) => {
        const cs = state.changeSources as ObjectChangeSources | null
        t.notify(cs?.isExtensible ?? null)
        t.notifySubscription(state, {
          type: "ObjectPreventExtensions",
          target: state.proxy,
        })
        return Reflect.preventExtensions(target)
      })
    },

    ownKeys(target) {
      subscribeSingle(state, "ownKeys")
      return Reflect.ownKeys(target)
    },

    apply(target, thisArg, argArray) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      return Reflect.apply(target as Function, thisArg, argArray)
    },

    construct(target, argArray, newTarget) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      return Reflect.construct(target as Function, argArray, newTarget)
    },
  }
}

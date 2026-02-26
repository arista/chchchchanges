import { ChangeSource } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import { CHANGE_PROXY_STATE, enableChanges } from "./change-proxy.js"

export interface ArrayChangeSources {
  array: ChangeSource | null
}

function ensureCS(state: ChangeProxyState): ArrayChangeSources {
  if (!state.changeSources) {
    state.changeSources = { array: null }
  }
  return state.changeSources as ArrayChangeSources
}

function subscribe(state: ChangeProxyState): void {
  const ctx = state.changeDomain.changeContext
  if (!ctx) return
  const cs = ensureCS(state)
  if (!cs.array) {
    cs.array = new ChangeSource(() => {
      cs.array = null
    })
  }
  cs.array.subscribe(ctx.listener)
}

function notify(state: ChangeProxyState, t: { notify(source: ChangeSource | null): void }): void {
  const cs = state.changeSources as ArrayChangeSources | null
  t.notify(cs?.array ?? null)
}

export function createArrayHandler(state: ChangeProxyState): ProxyHandler<object> {
  const domain = state.changeDomain

  return {
    get(target, prop, receiver) {
      if (prop === CHANGE_PROXY_STATE) return state
      subscribe(state)
      const value = Reflect.get(target, prop, receiver)
      // Don't wrap functions — array methods are shared on Array.prototype
      // and are called with the proxy as `this`, working through proxy traps
      if (typeof value === "function") return value
      if (typeof value === "object" && value !== null) {
        const desc = Object.getOwnPropertyDescriptor(target, prop)
        if (desc && !desc.configurable && "value" in desc && !desc.writable) {
          return value
        }
        return enableChanges(value, domain)
      }
      return value
    },

    has(target, prop) {
      subscribe(state)
      return Reflect.has(target, prop)
    },

    set(target, prop, value, receiver) {
      const wrappedValue = enableChanges(value, domain)
      if (domain.changeContext != null) {
        return Reflect.set(target, prop, wrappedValue, receiver)
      }
      return domain.withTransaction((t) => {
        notify(state, t)
        return Reflect.set(target, prop, wrappedValue, receiver)
      })
    },

    deleteProperty(target, prop) {
      if (domain.changeContext != null) {
        return Reflect.deleteProperty(target, prop)
      }
      return domain.withTransaction((t) => {
        notify(state, t)
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
        notify(state, t)
        return Reflect.defineProperty(target, prop, descriptor)
      })
    },

    getOwnPropertyDescriptor(target, prop) {
      subscribe(state)
      const desc = Reflect.getOwnPropertyDescriptor(target, prop)
      if (desc && "value" in desc) {
        return { ...desc, value: enableChanges(desc.value, domain) }
      }
      return desc
    },

    getPrototypeOf(target) {
      subscribe(state)
      return Reflect.getPrototypeOf(target)
    },

    setPrototypeOf(target, proto) {
      if (domain.changeContext != null) {
        return Reflect.setPrototypeOf(target, proto)
      }
      return domain.withTransaction((t) => {
        notify(state, t)
        return Reflect.setPrototypeOf(target, proto)
      })
    },

    isExtensible(target) {
      subscribe(state)
      return Reflect.isExtensible(target)
    },

    preventExtensions(target) {
      if (domain.changeContext != null) {
        return Reflect.preventExtensions(target)
      }
      return domain.withTransaction((t) => {
        notify(state, t)
        return Reflect.preventExtensions(target)
      })
    },

    ownKeys(target) {
      subscribe(state)
      return Reflect.ownKeys(target)
    },
  }
}

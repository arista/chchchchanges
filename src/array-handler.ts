import { ChangeSource } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import { CHANGE_PROXY_STATE, enableChanges } from "./change-proxy.js"
import type { Change } from "./change-types.js"

export interface ArrayChangeSources {
  array: ChangeSource | null
}

const ARRAY_MUTATORS = new Set([
  "fill",
  "copyWithin",
  "pop",
  "push",
  "reverse",
  "sort",
  "shift",
  "splice",
  "unshift",
])

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
    // Array has only one ChangeSource, whose name is the same as the Array's base name
    cs.array = new ChangeSource(state.name, () => {
      cs.array = null
    })
  }
  cs.array.subscribe(ctx.listener)
  state.changeDomain.logger?.({
    type: "ChangeSourceReferenced",
    domain: state.changeDomain.name,
    source: cs.array.name,
    detectChanges: ctx.name,
  })
}

function notify(state: ChangeProxyState, t: { notify(source: ChangeSource | null): void }): void {
  const cs = state.changeSources as ArrayChangeSources | null
  t.notify(cs?.array ?? null)
}

function createArrayChange(
  proxy: unknown[],
  method: string,
  target: unknown[],
  args: unknown[],
): Change {
  switch (method) {
    case "fill": {
      const [value, start = 0, end = target.length] = args
      return {
        type: "ArrayFill",
        target: proxy,
        value,
        start: start as number,
        end: end as number,
      }
    }
    case "copyWithin": {
      const [dest, start, end = target.length] = args
      return {
        type: "ArrayCopyWithin",
        target: proxy,
        dest: dest as number,
        start: start as number,
        end: end as number,
      }
    }
    case "pop":
      return { type: "ArrayPop", target: proxy }
    case "push":
      return { type: "ArrayPush", target: proxy, elements: args }
    case "reverse":
      return { type: "ArrayReverse", target: proxy }
    case "sort":
      return { type: "ArraySort", target: proxy }
    case "shift":
      return { type: "ArrayShift", target: proxy }
    case "splice": {
      const [start, deleteCount, ...items] = args
      const change: Change = {
        type: "ArraySplice",
        target: proxy,
        start: start as number,
        deleteCount: deleteCount as number,
      }
      if (items.length > 0) {
        ;(change as { items?: unknown[] }).items = items
      }
      return change
    }
    case "unshift":
      return { type: "ArrayUnshift", target: proxy, elements: args }
    default:
      throw new Error(`Unknown array mutator: ${method}`)
  }
}

export function createArrayHandler(state: ChangeProxyState): ProxyHandler<object> {
  const domain = state.changeDomain
  const wrappedMutators = new Map<string, Function>()

  function getWrappedMutator(method: string, target: unknown[]): Function {
    let wrapped = wrappedMutators.get(method)
    if (wrapped) return wrapped

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalMethod = (target as any)[method] as (...args: unknown[]) => unknown

    wrapped = function (this: unknown[], ...args: unknown[]) {
      // If inside detectChanges, just run the method normally
      // (it will go through proxy traps which handle ChangeSource notifications)
      if (domain.changeContext != null) {
        return originalMethod.apply(this, args)
      }

      // Outside detectChanges, we need to handle subscription notifications
      return domain.withTransaction((t) => {
        notify(state, t)

        // Suppress object-level subscription notifications during the method
        // and report the array-level change instead
        const change = createArrayChange(state.proxy as unknown[], method, target, args)

        const result = t.withSuppressedObjectChanges(state, () => {
          return originalMethod.apply(state.proxy, args)
        })

        t.notifySubscription(state, change)
        return result
      })
    }

    wrappedMutators.set(method, wrapped)
    return wrapped
  }

  return {
    get(target, prop, receiver) {
      if (prop === CHANGE_PROXY_STATE) return state

      // Intercept array mutator methods for subscription notifications
      if (typeof prop === "string" && ARRAY_MUTATORS.has(prop)) {
        subscribe(state)
        return getWrappedMutator(prop, target as unknown[])
      }

      subscribe(state)
      const value = Reflect.get(target, prop, receiver)
      // Don't wrap other functions — they work through proxy traps
      if (typeof value === "function") return value
      if (typeof value === "object" && value !== null) {
        const desc = Object.getOwnPropertyDescriptor(target, prop)
        if (desc && !desc.configurable && "value" in desc && !desc.writable) {
          return value
        }
        // Array element names use bracket notation and update on each access
        const childName = `${state.name}[${String(prop)}]`
        return enableChanges(value, domain, childName)
      }
      return value
    },

    has(target, prop) {
      subscribe(state)
      return Reflect.has(target, prop)
    },

    set(target, prop, value, receiver) {
      const childName = `${state.name}[${String(prop)}]`
      const wrappedValue = enableChanges(value, domain, childName)
      if (domain.changeContext != null) {
        return Reflect.set(target, prop, wrappedValue, receiver)
      }
      return domain.withTransaction((t) => {
        notify(state, t)
        t.notifySubscription(state, {
          type: "ObjectSet",
          target: state.proxy,
          prop,
          value: wrappedValue,
        })
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
        const childName = `${state.name}[${String(prop)}]`
        descriptor = { ...descriptor, value: enableChanges(descriptor.value, domain, childName) }
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
        const childName = `${state.name}[${String(prop)}]`
        return { ...desc, value: enableChanges(desc.value, domain, childName) }
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

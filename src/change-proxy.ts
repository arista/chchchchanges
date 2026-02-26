import type { ChangeDomain } from "./change-domain.js"
import { createArrayHandler } from "./array-handler.js"
import { createMapHandler } from "./map-handler.js"
import { createObjectHandler } from "./object-handler.js"

export const CHANGE_PROXY_STATE = Symbol.for("chchchchanges.proxyState")

export interface ChangeProxyState {
  proxy: object
  readonly target: object
  readonly changeDomain: ChangeDomain
  changeSources: unknown
}

const proxyStateMap = new WeakMap<object, ChangeProxyState>()

export function getProxyState(val: unknown): ChangeProxyState | undefined {
  if (val == null || typeof val !== "object") return undefined
  return (val as Record<symbol, ChangeProxyState | undefined>)[CHANGE_PROXY_STATE]
}

export function getExistingProxyState(target: object): ChangeProxyState | undefined {
  return proxyStateMap.get(target)
}

export function enableChanges<T>(val: T, domain: ChangeDomain): T {
  // Pass through primitives and null/undefined
  if (val === null || val === undefined) return val
  if (typeof val !== "object" && typeof val !== "function") return val

  // Check if already a proxy
  const existingState = getProxyState(val)
  if (existingState) {
    if (existingState.changeDomain !== domain) {
      throw new Error("Object is already associated with a different ChangeDomain")
    }
    return val
  }

  // Check if target already has a proxy
  const targetState = proxyStateMap.get(val as object)
  if (targetState) {
    if (targetState.changeDomain !== domain) {
      throw new Error("Object is already associated with a different ChangeDomain")
    }
    return targetState.proxy as T
  }

  // Create new proxy
  const state: ChangeProxyState = {
    proxy: null!,
    target: val as object,
    changeDomain: domain,
    changeSources: null,
  }
  const handler = createHandler(val as object, state)
  state.proxy = new Proxy(val as object, handler)
  proxyStateMap.set(val as object, state)
  return state.proxy as T
}

function createHandler(target: object, state: ChangeProxyState): ProxyHandler<object> {
  if (Array.isArray(target)) return createArrayHandler(state)
  if (target instanceof Map) return createMapHandler(state)
  // Step 8 will add Set dispatch before the default
  return createObjectHandler(state)
}

import type { ChangeDomain } from "./change-domain.js"
import type { SubscriptionListener } from "./change-types.js"
import { createArrayHandler } from "./array-handler.js"
import { createMapHandler } from "./map-handler.js"
import { createObjectHandler } from "./object-handler.js"
import { createSetHandler } from "./set-handler.js"

export const CHANGE_PROXY_STATE = Symbol.for("chchchchanges.proxyState")

export interface ChangeProxyState {
  proxy: object
  readonly target: object
  readonly changeDomain: ChangeDomain
  readonly name: string
  changeSources: unknown
  objectSubscriptions: Set<SubscriptionListener> | null
}

const proxyStateMap = new WeakMap<object, ChangeProxyState>()

const rawValues = new WeakSet<object>()

/**
 * Mark an object as raw: enableChanges will return it untouched and never proxy
 * it or (by extension) anything reached through it. Use this for objects that
 * manage their own state/reactivity and must not be deep-proxied when they
 * happen to be nested inside change-enabled state (e.g. a self-contained
 * reactive data structure). Returns the same object for convenient chaining.
 */
export function markRaw<T extends object>(value: T): T {
  rawValues.add(value)
  return value
}

export function isMarkedRaw(value: unknown): boolean {
  return typeof value === "object" && value !== null && rawValues.has(value)
}

/**
 * Whether an object is one of the four shapes we have a handler for.
 *
 * This is an allow-list, and it has to be. Proxying an object with internal
 * slots does not degrade it, it *breaks* it: `Date.prototype.getTime` and
 * friends read `[[DateValue]]` off `this`, and a Proxy has no such slot, so
 * every method throws "this is not a Date object" — including the ones nothing
 * calls explicitly, so `JSON.stringify` and `<` on a wrapped Date throw too.
 * `instanceof Date` still passes, because the prototype chain is intact, which
 * is why this failed silently until something called a method.
 *
 * The same applies to `RegExp`, `URL`, `Promise`, `WeakMap`/`WeakSet`, typed
 * arrays and `Error`. A block-list of those would be a list that is wrong the
 * next time the platform adds an exotic type, so the test is the other way
 * round: wrap what we handle, pass through everything else.
 *
 * Class instances are still wrapped — `Object.prototype.toString` reports
 * `[object Object]` for them, since only a `Symbol.toStringTag` changes that.
 * An object that sets `toStringTag` therefore stops being proxied; nothing in
 * chchchchanges, multindex, brint, hanbok or taterhome sets one, and a class
 * that wants both can `markRaw` deliberately or drop the tag.
 *
 * Functions do not come through here: `enableChanges` accepts them and they
 * keep their existing object-handler treatment, which this does not change.
 */
function isProxyableObject(val: object): boolean {
  if (Array.isArray(val)) return true
  if (val instanceof Map) return true
  if (val instanceof Set) return true
  return Object.prototype.toString.call(val) === "[object Object]"
}

export function getProxyState(val: unknown): ChangeProxyState | undefined {
  if (val == null || typeof val !== "object") return undefined
  return (val as Record<symbol, ChangeProxyState | undefined>)[CHANGE_PROXY_STATE]
}

export function getExistingProxyState(target: object): ChangeProxyState | undefined {
  return proxyStateMap.get(target)
}

export function enableChanges<T>(val: T, domain: ChangeDomain, name?: string): T {
  // Pass through primitives and null/undefined
  if (val === null || val === undefined) return val
  if (typeof val !== "object" && typeof val !== "function") return val

  // Pass through values explicitly marked raw — they manage their own state and
  // must never be proxied.
  if (rawValues.has(val as object)) return val

  // Return an already-enabled proxy immediately. This MUST come before the
  // iterator probe below: reading CHANGE_PROXY_STATE does not create a
  // subscription, but reading `.next` would go through the proxy's get trap and,
  // for an array/map/set proxy, subscribe the current change context to the
  // whole collection. That makes anything which merely re-wraps an already-
  // enabled value (e.g. reading a reactive array off a change-enabled object)
  // spuriously depend on the collection's structure.
  const existingState = getProxyState(val)
  if (existingState) {
    if (existingState.changeDomain !== domain) {
      throw new Error("Object is already associated with a different ChangeDomain")
    }
    return val
  }

  // Pass through iterators — their .next() method requires `this` to be the
  // actual iterator object, not a proxy. This covers generators, array iterators,
  // map iterators, set iterators, etc.
  if (typeof (val as { next?: unknown }).next === "function") return val

  // Pass through objects we have no handler for. See isProxyableObject: the
  // iterator check above is the same rule found one exotic type at a time, and
  // this subsumes it.
  if (typeof val === "object" && !isProxyableObject(val as object)) return val

  // Check if target already has a proxy
  const targetState = proxyStateMap.get(val as object)
  if (targetState) {
    if (targetState.changeDomain !== domain) {
      throw new Error("Object is already associated with a different ChangeDomain")
    }
    return targetState.proxy as T
  }

  // Generate name if not provided
  const objectId = domain.generateObjectId()
  const objectName = name ?? generateObjectTypeName(val as object, objectId)

  // Create new proxy
  const state: ChangeProxyState = {
    proxy: null!,
    target: val as object,
    changeDomain: domain,
    name: objectName,
    changeSources: null,
    objectSubscriptions: null,
  }
  const handler = createHandler(val as object, state)
  state.proxy = new Proxy(val as object, handler)
  proxyStateMap.set(val as object, state)
  return state.proxy as T
}

function generateObjectTypeName(target: object, id: number): string {
  if (Array.isArray(target)) return `Array#${id}`
  if (target instanceof Map) return `Map#${id}`
  if (target instanceof Set) return `Set#${id}`
  return `Object#${id}`
}

function createHandler(target: object, state: ChangeProxyState): ProxyHandler<object> {
  if (Array.isArray(target)) return createArrayHandler(state)
  if (target instanceof Map) return createMapHandler(state)
  if (target instanceof Set) return createSetHandler(state)
  return createObjectHandler(state)
}

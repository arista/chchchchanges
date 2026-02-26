import { ChangeSource } from "./change-source.js"
import type { ChangeDomain, ChangeDetecting } from "./change-domain.js"
import { enableChanges } from "./change-proxy.js"

export type CachedFunctionListener = () => void

export interface CachedFunction<T> {
  call(): T
  remove(): void
  addListener(listener: CachedFunctionListener): void
  removeListener(listener: CachedFunctionListener): void
}

export function createCachedFunction<T>(domain: ChangeDomain, fn: () => T): CachedFunction<T> {
  let cacheValid = false
  let cachedValue: T | null = null
  let changeSource: ChangeSource | null = null
  let detecting: ChangeDetecting<T> | null = null
  const listeners = new Set<CachedFunctionListener>()

  function notifyListeners() {
    for (const listener of listeners) {
      listener()
    }
  }

  function call(): T {
    // Subscribe caller to CF's source if inside detectChanges
    const ctx = domain.changeContext
    if (ctx) {
      if (!changeSource) {
        changeSource = new ChangeSource(() => {
          changeSource = null
        })
      }
      changeSource.subscribe(ctx.listener)
    }

    if (cacheValid) {
      return cachedValue!
    }

    // Remove old dependency tracking
    if (detecting) {
      detecting.remove()
      detecting = null
    }

    // Evaluate with detectChanges to track dependencies
    detecting = domain.detectChanges(fn, () => {
      // After-callback: invalidate cache and notify CF's own listeners
      cacheValid = false
      if (detecting) {
        detecting.remove()
        detecting = null
      }
      domain.withTransaction((t) => {
        t.notify(changeSource)
      })
      notifyListeners()
    })

    cachedValue = enableChanges(detecting.result, domain) as T
    cacheValid = true
    return cachedValue
  }

  function remove(): void {
    if (detecting) {
      detecting.remove()
      detecting = null
    }
    cacheValid = false
    cachedValue = null
    changeSource = null
    listeners.clear()
  }

  function addListener(listener: CachedFunctionListener): void {
    listeners.add(listener)
  }

  function removeListener(listener: CachedFunctionListener): void {
    listeners.delete(listener)
  }

  return { call, remove, addListener, removeListener }
}

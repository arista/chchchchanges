import type { ChangeCallback } from "./change-callback.js"
import type { ChangeDetecting } from "./change-domain.js"
import { ChangeDomain } from "./change-domain.js"
import type { CachedFunction } from "./cached-function.js"

const globalDomain = new ChangeDomain()

export const Changes = {
  get globalDomain(): ChangeDomain {
    return globalDomain
  },

  createDomain(): ChangeDomain {
    return new ChangeDomain()
  },

  enableChanges<T>(val: T): T {
    return globalDomain.enableChanges(val)
  },

  detectChanges<T>(f: () => T, onChange: ChangeCallback): ChangeDetecting<T> {
    return globalDomain.detectChanges(f, onChange)
  },

  createCachedFunction<T>(fn: () => T): CachedFunction<T> {
    return globalDomain.createCachedFunction(fn)
  },
}

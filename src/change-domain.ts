import type { ChangeCallback } from "./change-callback.js"
import { ChangeListener } from "./change-source.js"
import { ChangeTransaction } from "./change-transaction.js"
import { enableChanges } from "./change-proxy.js"
import { createCachedFunction as createCF, type CachedFunction } from "./cached-function.js"

export interface ChangeDetecting<T> {
  result: T
  remove(): void
}

export class ChangeContext {
  readonly listener: ChangeListener

  constructor(onChange: ChangeCallback) {
    this.listener = new ChangeListener(onChange)
  }
}

export class ChangeDomain {
  changeContext: ChangeContext | null = null
  private transaction: ChangeTransaction | null = null

  enableChanges<T>(val: T): T {
    return enableChanges(val, this)
  }

  withTransaction<R>(f: (t: ChangeTransaction) => R): R {
    const isNew = this.transaction == null
    if (isNew) {
      this.transaction = new ChangeTransaction()
    }
    try {
      return f(this.transaction!)
    } finally {
      if (isNew) {
        this.transaction!.complete()
        this.transaction = null
      }
    }
  }

  createCachedFunction<T>(fn: () => T): CachedFunction<T> {
    return createCF(this, fn)
  }

  detectChanges<T>(f: () => T, onChange: ChangeCallback): ChangeDetecting<T> {
    const prev = this.changeContext
    const ctx = new ChangeContext(onChange)
    this.changeContext = ctx
    try {
      const result = f()
      return {
        result,
        remove() {
          ctx.listener.unsubscribe()
        },
      }
    } finally {
      this.changeContext = prev
    }
  }
}

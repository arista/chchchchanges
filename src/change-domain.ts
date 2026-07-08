import type { ChangeCallback } from "./change-callback.js"
import { ChangeListener } from "./change-source.js"
import { ChangeTransaction } from "./change-transaction.js"
import { enableChanges, getProxyState } from "./change-proxy.js"
import { createCachedFunction as createCF, type CachedFunction } from "./cached-function.js"
import { createMappedArray as createMA } from "./mapped-array.js"
import type { SubscriptionListener } from "./change-types.js"
import type { ChangesConfig, ChangeEventLogger } from "./change-event.js"

export interface ChangeDetecting<T> {
  result: T
  remove(): void
}

let globalDomainIdCounter = 0
function generateDomainId(): number {
  return ++globalDomainIdCounter
}

export class ChangeContext {
  readonly listener: ChangeListener
  readonly name: string

  constructor(onChange: ChangeCallback, name: string) {
    this.listener = new ChangeListener(onChange, name)
    this.name = name
  }
}

export class ChangeDomain {
  changeContext: ChangeContext | null = null
  private transaction: ChangeTransaction | null = null

  readonly name: string
  readonly logger: ChangeEventLogger | null

  private transactionIdCounter = 0
  private objectIdCounter = 0
  private detectChangesIdCounter = 0
  private cachedFunctionIdCounter = 0

  constructor(config?: ChangesConfig) {
    this.name = config?.name ?? `Domain#${generateDomainId()}`
    this.logger = config?.logger ?? null
  }

  generateObjectId(): number {
    return ++this.objectIdCounter
  }

  generateDetectChangesId(): number {
    return ++this.detectChangesIdCounter
  }

  generateCachedFunctionId(): number {
    return ++this.cachedFunctionIdCounter
  }

  enableChanges<T>(val: T, name?: string): T {
    return enableChanges(val, this, name)
  }

  withTransaction<R>(f: (t: ChangeTransaction) => R): R {
    const isNew = this.transaction == null
    if (isNew) {
      const txId = ++this.transactionIdCounter
      this.transaction = new ChangeTransaction(txId, this)
      this.logger?.({
        type: "TransactionStarted",
        domain: this.name,
        transaction: txId,
      })
    }
    try {
      return f(this.transaction!)
    } finally {
      if (isNew) {
        const txId = this.transaction!.id
        this.transaction!.complete()
        this.logger?.({
          type: "TransactionEnded",
          domain: this.name,
          transaction: txId,
        })
        this.transaction = null
      }
    }
  }

  createCachedFunction<T>(fn: () => T, name?: string): CachedFunction<T> {
    return createCF(this, fn, name)
  }

  createMappedArray<T, U>(source: T[], fn: (item: T) => U): U[] {
    return createMA(this, source, fn)
  }

  detectChanges<T>(f: () => T, onChange: ChangeCallback, name?: string): ChangeDetecting<T> {
    const prev = this.changeContext
    const id = this.generateDetectChangesId()
    const dcName = name ? `${name}#${id}` : `DetectChanges#${id}`
    const ctx = new ChangeContext(onChange, dcName)

    // Suspend previous if exists
    if (prev && this.logger) {
      this.logger({
        type: "DetectChangesSuspended",
        domain: this.name,
        detectChanges: prev.name,
      })
    }

    this.changeContext = ctx
    this.logger?.({
      type: "DetectChangesEntered",
      domain: this.name,
      detectChanges: dcName,
    })

    try {
      const result = f()
      return {
        result,
        remove() {
          ctx.listener.unsubscribe()
        },
      }
    } finally {
      this.logger?.({
        type: "DetectChangesExited",
        domain: this.name,
        detectChanges: dcName,
      })
      this.changeContext = prev

      // Resume previous if exists
      if (prev && this.logger) {
        this.logger({
          type: "DetectChangesResumed",
          domain: this.name,
          detectChanges: prev.name,
        })
      }
    }
  }

  subscribe<T extends object>(obj: T, listener: SubscriptionListener): T {
    const proxy = this.enableChanges(obj)
    const state = getProxyState(proxy)!
    if (!state.objectSubscriptions) {
      state.objectSubscriptions = new Set()
    }
    state.objectSubscriptions.add(listener)
    return proxy as T
  }

  unsubscribe<T extends object>(obj: T, listener: SubscriptionListener): void {
    const state = getProxyState(obj)
    if (!state?.objectSubscriptions) return
    state.objectSubscriptions.delete(listener)
    if (state.objectSubscriptions.size === 0) {
      state.objectSubscriptions = null
    }
  }
}

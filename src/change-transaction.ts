import type { AfterChangeCallback } from "./change-callback.js"
import type { ChangeSource, ChangeListener } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import type { Change, SubscriptionListener } from "./change-types.js"

export class ChangeTransaction {
  readonly afterNotifications: AfterChangeCallback[] = []
  readonly changeSources = new Set<ChangeSource>()
  readonly subscriptionAfterCallbacks: Array<() => void> = []
  private suppressedState: ChangeProxyState | null = null

  notify(source: ChangeSource | null): void {
    if (source == null) return

    this.changeSources.add(source)
    const listeners = source.listAndClearListeners()

    for (const listener of listeners) {
      if (listener.wasNotified) continue
      listener.wasNotified = true
      listener.unsubscribe()
      this.processCallback(listener)
    }
  }

  complete(): void {
    for (let i = 0; i < this.afterNotifications.length; i++) {
      this.afterNotifications[i]!()
    }

    for (let i = 0; i < this.subscriptionAfterCallbacks.length; i++) {
      this.subscriptionAfterCallbacks[i]!()
    }

    for (const source of this.changeSources) {
      if (!source.hasListeners) {
        source.remove()
      }
    }
  }

  notifySubscription(state: ChangeProxyState, change: Change): void {
    if (this.suppressedState === state) return

    const subs = state.objectSubscriptions
    if (!subs || subs.size === 0) return

    for (const listener of subs) {
      this.processSubscriptionCallback(listener, change)
    }
  }

  withSuppressedObjectChanges<R>(state: ChangeProxyState, fn: () => R): R {
    const prev = this.suppressedState
    this.suppressedState = state
    try {
      return fn()
    } finally {
      this.suppressedState = prev
    }
  }

  private processSubscriptionCallback(listener: SubscriptionListener, change: Change): void {
    if (typeof listener === "function") {
      this.subscriptionAfterCallbacks.push(() => listener(change))
    } else if ("before" in listener) {
      const result = listener.before(change)
      if (typeof result === "function") {
        const afterFn = result
        this.subscriptionAfterCallbacks.push(() => afterFn(change))
      }
    } else {
      this.subscriptionAfterCallbacks.push(() => listener.after(change))
    }
  }

  private processCallback(listener: ChangeListener): void {
    const cb = listener.callback
    if (typeof cb === "function") {
      // Plain function — treated as after callback
      this.afterNotifications.push(cb)
    } else if ("before" in cb) {
      const result = cb.before()
      if (typeof result === "function") {
        this.afterNotifications.push(result)
      }
    } else {
      this.afterNotifications.push(cb.after)
    }
  }
}

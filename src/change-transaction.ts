import type { AfterChangeCallback } from "./change-callback.js"
import type { ChangeSource, ChangeListener } from "./change-source.js"
import type { ChangeProxyState } from "./change-proxy.js"
import type { Change, SubscriptionListener } from "./change-types.js"
import type { ChangeDomain } from "./change-domain.js"

export class ChangeTransaction {
  readonly id: number
  private readonly domain: ChangeDomain
  readonly afterNotifications: AfterChangeCallback[] = []
  readonly changeSources = new Set<ChangeSource>()
  readonly subscriptionAfterCallbacks: Array<() => void> = []
  private suppressedState: ChangeProxyState | null = null

  constructor(id: number, domain: ChangeDomain) {
    this.id = id
    this.domain = domain
  }

  notify(source: ChangeSource | null): void {
    if (source == null) return

    this.changeSources.add(source)
    const listeners = source.listAndClearListeners()

    for (const listener of listeners) {
      if (listener.wasNotified) continue
      listener.wasNotified = true
      listener.unsubscribe()
      this.processCallback(listener, source.name)
    }
  }

  complete(): void {
    // Drain both queues to a fixed point, preferring afterNotifications
    // (reactive dependency callbacks) before subscriptionAfterCallbacks
    // (subscribe() observers) within each wave.
    //
    // A single flat pass of each queue is not enough: a callback can enqueue
    // more work into either queue while draining. Appending within the queue
    // currently draining is fine (its loop re-reads length), but a
    // subscription callback that mutates reactive state enqueues an
    // afterNotification *after* that queue's loop has already finished. A flat
    // two-loop drain would strand it — the dependency's listener was already
    // consumed (listAndClearListeners + unsubscribe) to build a callback that
    // then never runs, silently dropping the update and leaving the dependency
    // detached. This is reachable whenever a subscribe() listener writes to a
    // change-enabled object that has detectChanges/CachedFunction dependents
    // (e.g. a derived reactive collection). Looping until both queues are
    // exhausted keeps such late-enqueued work in the transaction. Cursors are
    // monotonic, so each callback runs exactly once; a genuine propagation
    // cycle would loop forever here, which is preferable to a silent drop.
    let afterIndex = 0
    let subscriptionIndex = 0
    while (
      afterIndex < this.afterNotifications.length ||
      subscriptionIndex < this.subscriptionAfterCallbacks.length
    ) {
      while (afterIndex < this.afterNotifications.length) {
        this.afterNotifications[afterIndex++]!()
      }
      while (subscriptionIndex < this.subscriptionAfterCallbacks.length) {
        this.subscriptionAfterCallbacks[subscriptionIndex++]!()
      }
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

  private processCallback(listener: ChangeListener, sourceName: string): void {
    const cb = listener.callback
    const logger = this.domain.logger

    if (typeof cb === "function") {
      // Plain function — treated as after callback
      this.afterNotifications.push(() => {
        logger?.({
          type: "ChangeNotified",
          domain: this.domain.name,
          transaction: this.id,
          source: sourceName,
          phase: "after",
          detectChanges: listener.detectChangesName,
        })
        cb()
      })
    } else if ("before" in cb) {
      logger?.({
        type: "ChangeNotified",
        domain: this.domain.name,
        transaction: this.id,
        source: sourceName,
        phase: "before",
        detectChanges: listener.detectChangesName,
      })
      const result = cb.before()
      if (typeof result === "function") {
        const afterFn = result
        this.afterNotifications.push(() => {
          logger?.({
            type: "ChangeNotified",
            domain: this.domain.name,
            transaction: this.id,
            source: sourceName,
            phase: "after",
            detectChanges: listener.detectChangesName,
          })
          afterFn()
        })
      }
    } else {
      this.afterNotifications.push(() => {
        logger?.({
          type: "ChangeNotified",
          domain: this.domain.name,
          transaction: this.id,
          source: sourceName,
          phase: "after",
          detectChanges: listener.detectChangesName,
        })
        cb.after()
      })
    }
  }
}

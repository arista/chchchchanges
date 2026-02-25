import type { ChangeCallback } from "./change-callback.js"

export interface ChangeSubscription {
  readonly source: ChangeSource
  readonly listener: ChangeListener
}

export class ChangeSource {
  private readonly listeners = new Set<ChangeListener>()
  readonly remove: () => void

  constructor(remove: () => void) {
    this.remove = remove
  }

  subscribe(listener: ChangeListener): void {
    if (this.listeners.has(listener)) return
    this.listeners.add(listener)
    listener.subscriptions.push({ source: this, listener })
  }

  unsubscribe(listener: ChangeListener): void {
    this.listeners.delete(listener)
  }

  listAndClearListeners(): ChangeListener[] {
    const result = [...this.listeners]
    this.listeners.clear()
    return result
  }

  get hasListeners(): boolean {
    return this.listeners.size > 0
  }
}

export class ChangeListener {
  wasNotified = false
  readonly callback: ChangeCallback
  readonly subscriptions: ChangeSubscription[] = []

  constructor(callback: ChangeCallback) {
    this.callback = callback
  }

  unsubscribe(): void {
    for (const sub of this.subscriptions) {
      sub.source.unsubscribe(this)
    }
    this.subscriptions.length = 0
  }
}

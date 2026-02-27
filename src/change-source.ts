import type { ChangeCallback } from "./change-callback.js"

export interface ChangeSubscription {
  readonly source: ChangeSource
  readonly listener: ChangeListener
}

export class ChangeSource {
  private readonly listeners = new Set<ChangeListener>()
  readonly name: string
  readonly remove: () => void

  constructor(name: string, remove: () => void) {
    this.name = name
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
  readonly detectChangesName: string
  readonly subscriptions: ChangeSubscription[] = []

  constructor(callback: ChangeCallback, detectChangesName: string) {
    this.callback = callback
    this.detectChangesName = detectChangesName
  }

  unsubscribe(): void {
    for (const sub of this.subscriptions) {
      sub.source.unsubscribe(this)
    }
    this.subscriptions.length = 0
  }
}

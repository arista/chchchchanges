import type { AfterChangeCallback } from "./change-callback.js"
import type { ChangeSource, ChangeListener } from "./change-source.js"

export class ChangeTransaction {
  readonly afterNotifications: AfterChangeCallback[] = []
  readonly changeSources = new Set<ChangeSource>()

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

    for (const source of this.changeSources) {
      if (!source.hasListeners) {
        source.remove()
      }
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

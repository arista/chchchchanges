import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeSource, ChangeListener } from "../src/change-source.js"
import { ChangeTransaction } from "../src/change-transaction.js"

function makeSource(): ChangeSource {
  return new ChangeSource(() => {})
}

function makeRemovableSource() {
  const state = { source: null as unknown as ChangeSource, removed: false }
  state.source = new ChangeSource(() => {
    state.removed = true
  })
  return state
}

describe("ChangeTransaction", () => {
  describe("notify", () => {
    it("should ignore null source", () => {
      const t = new ChangeTransaction()
      t.notify(null)
      assert.equal(t.afterNotifications.length, 0)
      assert.equal(t.changeSources.size, 0)
    })

    it("should add source to changeSources set", () => {
      const source = makeSource()
      const t = new ChangeTransaction()

      t.notify(source)

      assert.ok(t.changeSources.has(source))
    })

    it("should call before-callback immediately during notify", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener({
        before: () => {
          order.push("before")
        },
      })
      source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source)
      order.push("after-notify")

      assert.deepStrictEqual(order, ["before", "after-notify"])
    })

    it("should queue after-callback from before-callback return value", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener({
        before: () => {
          order.push("before")
          return () => {
            order.push("after")
          }
        },
      })
      source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source)
      order.push("between")
      t.complete()

      assert.deepStrictEqual(order, ["before", "between", "after"])
    })

    it("should queue plain function callback as after-notification", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener(() => {
        order.push("after")
      })
      source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source)
      order.push("between")
      t.complete()

      assert.deepStrictEqual(order, ["between", "after"])
    })

    it("should queue {after} callback as after-notification", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener({
        after: () => {
          order.push("after")
        },
      })
      source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source)
      order.push("between")
      t.complete()

      assert.deepStrictEqual(order, ["between", "after"])
    })

    it("should clear listeners from the source", () => {
      const source = makeSource()
      const listener = new ChangeListener(() => {})
      source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source)

      assert.ok(!source.hasListeners)
    })

    it("should unsubscribe listener from all its sources", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const listener = new ChangeListener(() => {})
      source1.subscribe(listener)
      source2.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source1)

      // listener was unsubscribed from all sources
      assert.ok(!source2.hasListeners)
      assert.equal(listener.subscriptions.length, 0)
    })

    it("should skip listeners already marked wasNotified", () => {
      const source = makeSource()
      const calls: string[] = []
      const listener = new ChangeListener(() => {
        calls.push("called")
      })
      source.subscribe(listener)

      // Pre-mark as notified
      listener.wasNotified = true

      const t = new ChangeTransaction()
      t.notify(source)

      assert.equal(calls.length, 0)
      assert.equal(t.afterNotifications.length, 0)
    })

    it("should not double-notify a listener from two sources", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const calls: string[] = []
      const listener = new ChangeListener(() => {
        calls.push("called")
      })
      source1.subscribe(listener)
      source2.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(source1)
      t.notify(source2)
      t.complete()

      // Only called once despite being subscribed to two notified sources
      assert.equal(calls.length, 1)
    })

    it("should handle notify on source with no listeners", () => {
      const source = makeSource()
      const t = new ChangeTransaction()

      // Should not throw
      t.notify(source)

      assert.ok(t.changeSources.has(source))
    })
  })

  describe("complete", () => {
    it("should process after-notifications in order", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const order: number[] = []
      const listener1 = new ChangeListener(() => {
        order.push(1)
      })
      const listener2 = new ChangeListener(() => {
        order.push(2)
      })
      source1.subscribe(listener1)
      source2.subscribe(listener2)

      const t = new ChangeTransaction()
      t.notify(source1)
      t.notify(source2)
      t.complete()

      assert.deepStrictEqual(order, [1, 2])
    })

    it("should process after-notifications added during iteration", () => {
      const source = makeSource()
      const order: number[] = []

      // This listener's after-callback will push another after-notification
      const t = new ChangeTransaction()
      const listener = new ChangeListener(() => {
        order.push(1)
        // Simulate a change during after-callback that adds more work
        t.afterNotifications.push(() => {
          order.push(2)
        })
      })
      source.subscribe(listener)

      t.notify(source)
      t.complete()

      assert.deepStrictEqual(order, [1, 2])
    })

    it("should remove empty ChangeSources after all after-notifications", () => {
      const state = makeRemovableSource()
      const listener = new ChangeListener(() => {})
      state.source.subscribe(listener)

      const t = new ChangeTransaction()
      t.notify(state.source)
      t.complete()

      // Source had no listeners after notify cleared them, so remove was called
      assert.ok(state.removed)
    })

    it("should not remove ChangeSources that still have listeners", () => {
      const state = makeRemovableSource()
      const listener1 = new ChangeListener(() => {})
      const listener2 = new ChangeListener(() => {})
      state.source.subscribe(listener1)
      state.source.subscribe(listener2)

      const t = new ChangeTransaction()

      // Clear both listeners, then re-add one to simulate a source that still has subscribers
      state.source.listAndClearListeners()
      state.source.subscribe(listener2)
      t.changeSources.add(state.source)

      t.complete()

      assert.ok(!state.removed)
    })

    it("should clean up sources only after all after-notifications have run", () => {
      const state1 = makeRemovableSource()
      const source2 = makeSource()
      const order: string[] = []

      // Listener on source2 re-subscribes a new listener to source1 during after-callback
      const listener2 = new ChangeListener(() => {
        order.push("after-callback")
        const newListener = new ChangeListener(() => {})
        state1.source.subscribe(newListener)
      })
      source2.subscribe(listener2)

      // Listener on source1 with no-op after
      const listener1 = new ChangeListener(() => {
        order.push("source1-after")
      })
      state1.source.subscribe(listener1)

      const t = new ChangeTransaction()
      t.notify(state1.source)
      t.notify(source2)
      t.complete()

      // source1 should NOT be removed because the after-callback re-added a listener
      assert.ok(!state1.removed)
    })
  })

  describe("nested before-callbacks", () => {
    it("should allow before-callbacks to trigger additional notify calls", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const order: string[] = []

      const listener2 = new ChangeListener({
        before: () => {
          order.push("before-2")
          return () => {
            order.push("after-2")
          }
        },
      })
      source2.subscribe(listener2)

      const t = new ChangeTransaction()

      const listener1 = new ChangeListener({
        before: () => {
          order.push("before-1")
          // Nested notify during before-callback
          t.notify(source2)
          return () => {
            order.push("after-1")
          }
        },
      })
      source1.subscribe(listener1)

      t.notify(source1)
      order.push("all-notified")
      t.complete()

      // before-1 runs, triggers before-2 inside it (so after-2 queued first), then after-1 queued
      assert.deepStrictEqual(order, ["before-1", "before-2", "all-notified", "after-2", "after-1"])
    })

    it("should track sources from nested notify calls", () => {
      const source1 = makeSource()
      const source2 = makeSource()

      const t = new ChangeTransaction()

      const listener2 = new ChangeListener(() => {})
      source2.subscribe(listener2)

      const listener1 = new ChangeListener({
        before: () => {
          t.notify(source2)
        },
      })
      source1.subscribe(listener1)

      t.notify(source1)

      assert.ok(t.changeSources.has(source1))
      assert.ok(t.changeSources.has(source2))
    })
  })
})

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeSource, ChangeListener } from "../src/change-source.js"
import { ChangeTransaction } from "../src/change-transaction.js"
import { ChangeDomain } from "../src/change-domain.js"

let sourceCounter = 0

function makeSource(): ChangeSource {
  return new ChangeSource(`test.source${++sourceCounter}`, () => {})
}

function makeRemovableSource() {
  const state = { source: null as unknown as ChangeSource, removed: false }
  state.source = new ChangeSource(`test.removable${++sourceCounter}`, () => {
    state.removed = true
  })
  return state
}

function makeTransaction(): ChangeTransaction {
  const domain = new ChangeDomain()
  return new ChangeTransaction(1, domain)
}

describe("ChangeTransaction", () => {
  describe("notify", () => {
    it("should ignore null source", () => {
      const t = makeTransaction()
      t.notify(null)
      assert.equal(t.afterNotifications.length, 0)
      assert.equal(t.changeSources.size, 0)
    })

    it("should add source to changeSources set", () => {
      const source = makeSource()
      const t = makeTransaction()

      t.notify(source)

      assert.ok(t.changeSources.has(source))
    })

    it("should call before-callback immediately during notify", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener(
        {
          before: () => {
            order.push("before")
          },
        },
        "TestDetect",
      )
      source.subscribe(listener)

      const t = makeTransaction()
      t.notify(source)
      order.push("after-notify")

      assert.deepStrictEqual(order, ["before", "after-notify"])
    })

    it("should queue after-callback from before-callback return value", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener(
        {
          before: () => {
            order.push("before")
            return () => {
              order.push("after")
            }
          },
        },
        "TestDetect",
      )
      source.subscribe(listener)

      const t = makeTransaction()
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
      }, "TestDetect")
      source.subscribe(listener)

      const t = makeTransaction()
      t.notify(source)
      order.push("between")
      t.complete()

      assert.deepStrictEqual(order, ["between", "after"])
    })

    it("should queue {after} callback as after-notification", () => {
      const source = makeSource()
      const order: string[] = []
      const listener = new ChangeListener(
        {
          after: () => {
            order.push("after")
          },
        },
        "TestDetect",
      )
      source.subscribe(listener)

      const t = makeTransaction()
      t.notify(source)
      order.push("between")
      t.complete()

      assert.deepStrictEqual(order, ["between", "after"])
    })

    it("should clear listeners from the source", () => {
      const source = makeSource()
      const listener = new ChangeListener(() => {}, "TestDetect")
      source.subscribe(listener)

      const t = makeTransaction()
      t.notify(source)

      assert.ok(!source.hasListeners)
    })

    it("should unsubscribe listener from all its sources", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const listener = new ChangeListener(() => {}, "TestDetect")
      source1.subscribe(listener)
      source2.subscribe(listener)

      const t = makeTransaction()
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
      }, "TestDetect")
      source.subscribe(listener)

      // Pre-mark as notified
      listener.wasNotified = true

      const t = makeTransaction()
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
      }, "TestDetect")
      source1.subscribe(listener)
      source2.subscribe(listener)

      const t = makeTransaction()
      t.notify(source1)
      t.notify(source2)
      t.complete()

      // Only called once despite being subscribed to two notified sources
      assert.equal(calls.length, 1)
    })

    it("should handle notify on source with no listeners", () => {
      const source = makeSource()
      const t = makeTransaction()

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
      }, "TestDetect1")
      const listener2 = new ChangeListener(() => {
        order.push(2)
      }, "TestDetect2")
      source1.subscribe(listener1)
      source2.subscribe(listener2)

      const t = makeTransaction()
      t.notify(source1)
      t.notify(source2)
      t.complete()

      assert.deepStrictEqual(order, [1, 2])
    })

    it("should process after-notifications added during iteration", () => {
      const source = makeSource()
      const order: number[] = []

      // This listener's after-callback will push another after-notification
      const t = makeTransaction()
      const listener = new ChangeListener(() => {
        order.push(1)
        // Simulate a change during after-callback that adds more work
        t.afterNotifications.push(() => {
          order.push(2)
        })
      }, "TestDetect")
      source.subscribe(listener)

      t.notify(source)
      t.complete()

      assert.deepStrictEqual(order, [1, 2])
    })

    it("should remove empty ChangeSources after all after-notifications", () => {
      const state = makeRemovableSource()
      const listener = new ChangeListener(() => {}, "TestDetect")
      state.source.subscribe(listener)

      const t = makeTransaction()
      t.notify(state.source)
      t.complete()

      // Source had no listeners after notify cleared them, so remove was called
      assert.ok(state.removed)
    })

    it("should not remove ChangeSources that still have listeners", () => {
      const state = makeRemovableSource()
      const listener1 = new ChangeListener(() => {}, "TestDetect1")
      const listener2 = new ChangeListener(() => {}, "TestDetect2")
      state.source.subscribe(listener1)
      state.source.subscribe(listener2)

      const t = makeTransaction()

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
        const newListener = new ChangeListener(() => {}, "TestDetectNew")
        state1.source.subscribe(newListener)
      }, "TestDetect2")
      source2.subscribe(listener2)

      // Listener on source1 with no-op after
      const listener1 = new ChangeListener(() => {
        order.push("source1-after")
      }, "TestDetect1")
      state1.source.subscribe(listener1)

      const t = makeTransaction()
      t.notify(state1.source)
      t.notify(source2)
      t.complete()

      // source1 should NOT be removed because the after-callback re-added a listener
      assert.ok(!state1.removed)
    })

    it("should drain after-notifications enqueued during subscription callbacks", () => {
      // Regression: a subscription after-callback runs in the second drain loop
      // and enqueues an after-notification (first queue). A flat two-loop drain
      // would strand it; the fixed-point drain must still run it.
      const order: number[] = []
      const t = makeTransaction()
      t.subscriptionAfterCallbacks.push(() => {
        order.push(1)
        t.afterNotifications.push(() => {
          order.push(2)
        })
      })

      t.complete()

      assert.deepStrictEqual(order, [1, 2])
    })

    it("delivers detectChanges invalidation when a subscribe() callback mutates reactive state", () => {
      // The real-world shape (a derived reactive collection): a subscribe()
      // listener mirrors a change onto another change-enabled object that has a
      // detectChanges dependent. The dependent's invalidation is enqueued during
      // the subscription drain and must still fire within this transaction.
      const domain = new ChangeDomain()
      const src = domain.enableChanges({ n: 0 })
      const derived = domain.enableChanges({ n: 0 })

      domain.subscribe(src, () => {
        derived.n = src.n
      })

      let runs = 0
      domain.detectChanges(
        () => derived.n,
        () => {
          runs++
        },
      )

      src.n = 5

      assert.equal(derived.n, 5)
      assert.equal(runs, 1)
    })
  })

  describe("nested before-callbacks", () => {
    it("should allow before-callbacks to trigger additional notify calls", () => {
      const source1 = makeSource()
      const source2 = makeSource()
      const order: string[] = []

      const listener2 = new ChangeListener(
        {
          before: () => {
            order.push("before-2")
            return () => {
              order.push("after-2")
            }
          },
        },
        "TestDetect2",
      )
      source2.subscribe(listener2)

      const t = makeTransaction()

      const listener1 = new ChangeListener(
        {
          before: () => {
            order.push("before-1")
            // Nested notify during before-callback
            t.notify(source2)
            return () => {
              order.push("after-1")
            }
          },
        },
        "TestDetect1",
      )
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

      const t = makeTransaction()

      const listener2 = new ChangeListener(() => {}, "TestDetect2")
      source2.subscribe(listener2)

      const listener1 = new ChangeListener(
        {
          before: () => {
            t.notify(source2)
          },
        },
        "TestDetect1",
      )
      source1.subscribe(listener1)

      t.notify(source1)

      assert.ok(t.changeSources.has(source1))
      assert.ok(t.changeSources.has(source2))
    })
  })
})

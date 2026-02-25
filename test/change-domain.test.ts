import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeSource, ChangeListener } from "../src/change-source.js"
import { ChangeDomain, ChangeContext } from "../src/change-domain.js"

describe("ChangeContext", () => {
  it("should create a listener from the onChange callback", () => {
    const cb = () => {}
    const ctx = new ChangeContext(cb)

    assert.equal(ctx.listener.callback, cb)
    assert.equal(ctx.listener.wasNotified, false)
  })
})

describe("ChangeDomain", () => {
  describe("detectChanges", () => {
    it("should return the function's result", () => {
      const domain = new ChangeDomain()
      const detecting = domain.detectChanges(
        () => 42,
        () => {},
      )

      assert.equal(detecting.result, 42)
    })

    it("should set changeContext during function execution", () => {
      const domain = new ChangeDomain()
      let contextDuringExec: typeof domain.changeContext = null

      domain.detectChanges(
        () => {
          contextDuringExec = domain.changeContext
        },
        () => {},
      )

      assert.ok(contextDuringExec !== null)
      assert.ok(contextDuringExec instanceof ChangeContext)
    })

    it("should restore changeContext to null after execution", () => {
      const domain = new ChangeDomain()

      domain.detectChanges(
        () => {},
        () => {},
      )

      assert.equal(domain.changeContext, null)
    })

    it("should restore changeContext even if function throws", () => {
      const domain = new ChangeDomain()

      assert.throws(() => {
        domain.detectChanges(
          () => {
            throw new Error("test error")
          },
          () => {},
        )
      })

      assert.equal(domain.changeContext, null)
    })

    it("should fire onChange when a subscribed source is notified", () => {
      const domain = new ChangeDomain()
      const source = new ChangeSource(() => {})
      const calls: string[] = []

      domain.detectChanges(
        () => {
          // Simulate what a proxy handler would do: subscribe context's listener
          source.subscribe(domain.changeContext!.listener)
        },
        () => {
          calls.push("onChange")
        },
      )

      // Simulate a mutation notifying the source
      domain.withTransaction((t) => {
        t.notify(source)
      })

      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should fire before-callback on notification", () => {
      const domain = new ChangeDomain()
      const source = new ChangeSource(() => {})
      const order: string[] = []

      domain.detectChanges(
        () => {
          source.subscribe(domain.changeContext!.listener)
        },
        {
          before: () => {
            order.push("before")
            return () => {
              order.push("after")
            }
          },
        },
      )

      domain.withTransaction((t) => {
        t.notify(source)
        order.push("mutation")
      })

      assert.deepStrictEqual(order, ["before", "mutation", "after"])
    })

    it("should suspend and resume outer context on nested detectChanges", () => {
      const domain = new ChangeDomain()
      const outerSource = new ChangeSource(() => {})
      const innerSource = new ChangeSource(() => {})
      const outerCalls: string[] = []
      const innerCalls: string[] = []

      domain.detectChanges(
        () => {
          const outerCtx = domain.changeContext
          outerSource.subscribe(outerCtx!.listener)

          // Nested detectChanges installs a new context
          domain.detectChanges(
            () => {
              assert.notEqual(domain.changeContext, outerCtx)
              innerSource.subscribe(domain.changeContext!.listener)
            },
            () => {
              innerCalls.push("inner-onChange")
            },
          )

          // Outer context is restored
          assert.equal(domain.changeContext, outerCtx)
        },
        () => {
          outerCalls.push("outer-onChange")
        },
      )

      // Notify inner source — only inner callback fires
      domain.withTransaction((t) => {
        t.notify(innerSource)
      })
      assert.deepStrictEqual(innerCalls, ["inner-onChange"])
      assert.deepStrictEqual(outerCalls, [])

      // Notify outer source — only outer callback fires
      domain.withTransaction((t) => {
        t.notify(outerSource)
      })
      assert.deepStrictEqual(outerCalls, ["outer-onChange"])
    })

    it("should allow remove() to unsubscribe from all sources", () => {
      const domain = new ChangeDomain()
      const source = new ChangeSource(() => {})
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => {
          source.subscribe(domain.changeContext!.listener)
        },
        () => {
          calls.push("onChange")
        },
      )

      // Remove before any notification
      detecting.remove()

      // Source should have no listeners
      assert.ok(!source.hasListeners)

      // Notification should not fire callback
      domain.withTransaction((t) => {
        t.notify(source)
      })
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("withTransaction", () => {
    it("should pass return value through", () => {
      const domain = new ChangeDomain()
      const result = domain.withTransaction(() => 99)

      assert.equal(result, 99)
    })

    it("should create a new transaction and complete it", () => {
      const domain = new ChangeDomain()
      const source = new ChangeSource(() => {})
      const calls: string[] = []

      const listener = new ChangeListener(() => {
        calls.push("after")
      })
      source.subscribe(listener)

      domain.withTransaction((t) => {
        t.notify(source)
        // After-callback not yet called
        assert.deepStrictEqual(calls, [])
      })

      // After-callback runs on complete
      assert.deepStrictEqual(calls, ["after"])
    })

    it("should reuse existing transaction for nested calls", () => {
      const domain = new ChangeDomain()
      let outerTransaction: unknown = null
      let innerTransaction: unknown = null

      domain.withTransaction((t) => {
        outerTransaction = t
        domain.withTransaction((t2) => {
          innerTransaction = t2
        })
      })

      assert.equal(outerTransaction, innerTransaction)
    })

    it("should only complete when outermost withTransaction finishes", () => {
      const domain = new ChangeDomain()
      const source = new ChangeSource(() => {})
      const calls: string[] = []

      const listener = new ChangeListener(() => {
        calls.push("after")
      })
      source.subscribe(listener)

      domain.withTransaction(() => {
        domain.withTransaction((t2) => {
          t2.notify(source)
        })
        // Inner withTransaction did NOT call complete — after-callback not yet fired
        assert.deepStrictEqual(calls, [])
      })

      // Outer withTransaction called complete
      assert.deepStrictEqual(calls, ["after"])
    })

    it("should clean up transaction even if function throws", () => {
      const domain = new ChangeDomain()

      assert.throws(() => {
        domain.withTransaction(() => {
          throw new Error("test error")
        })
      })

      // Should be able to start a new transaction
      const result = domain.withTransaction(() => "ok")
      assert.equal(result, "ok")
    })
  })
})

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Changes } from "../src/changes.js"
import { getProxyState } from "../src/change-proxy.js"

describe("Changes (Public API)", () => {
  describe("create", () => {
    it("should create a new ChangeDomain", () => {
      const domain = Changes.create()
      assert.ok(domain)
    })

    it("should create independent domains", () => {
      const domain1 = Changes.create()
      const domain2 = Changes.create()

      assert.notEqual(domain1, domain2)
    })

    it("should accept optional config with name", () => {
      const domain = Changes.create({ name: "MyDomain" })
      assert.equal(domain.name, "MyDomain")
    })

    it("should accept optional config with logger", () => {
      const events: unknown[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })
      assert.ok(domain.logger)
    })
  })

  describe("ChangeDomain.enableChanges", () => {
    it("should wrap objects", () => {
      const domain = Changes.create()
      const obj = domain.enableChanges({ a: 1 })
      assert.ok(getProxyState(obj))
      assert.equal(obj.a, 1)
    })

    it("should pass through primitives", () => {
      const domain = Changes.create()
      assert.equal(domain.enableChanges(42), 42)
      assert.equal(domain.enableChanges("hello"), "hello")
      assert.equal(domain.enableChanges(null), null)
    })

    it("should wrap arrays", () => {
      const domain = Changes.create()
      const arr = domain.enableChanges([1, 2, 3])
      assert.ok(getProxyState(arr))
      assert.equal(arr.length, 3)
    })

    it("should wrap Maps", () => {
      const domain = Changes.create()
      const map = domain.enableChanges(new Map([["a", 1]]))
      assert.ok(getProxyState(map))
      assert.equal(map.get("a"), 1)
    })

    it("should wrap Sets", () => {
      const domain = Changes.create()
      const set = domain.enableChanges(new Set([1, 2]))
      assert.ok(getProxyState(set))
      assert.equal(set.has(1), true)
    })

    it("should accept optional name", () => {
      const events: unknown[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })
      const obj = domain.enableChanges({ x: 1 }, "myObj")
      domain.detectChanges(() => { void obj.x }, () => {})

      const refEvent = events.find((e: unknown) => (e as { type: string }).type === "ChangeSourceReferenced")
      assert.ok(refEvent)
      assert.equal((refEvent as { source: string }).source, "myObj.x")
    })
  })

  describe("ChangeDomain.detectChanges", () => {
    it("should track and notify on changes", () => {
      const domain = Changes.create()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => calls.push("onChange"),
      )

      obj.a = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should return ChangeDetecting with result and remove", () => {
      const domain = Changes.create()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => obj.a * 10,
        () => calls.push("onChange"),
      )

      assert.equal(detecting.result, 10)

      detecting.remove()
      obj.a = 2
      assert.deepStrictEqual(calls, [])
    })

    it("should accept optional name", () => {
      const events: unknown[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })
      const obj = domain.enableChanges({ x: 1 })

      domain.detectChanges(() => { void obj.x }, () => {}, "MyWatcher")

      const enterEvent = events.find((e: unknown) => (e as { type: string }).type === "DetectChangesEntered")
      assert.ok(enterEvent)
      assert.match((enterEvent as { detectChanges: string }).detectChanges, /^MyWatcher#\d+$/)
    })
  })

  describe("ChangeDomain.createCachedFunction", () => {
    it("should cache and invalidate", () => {
      const domain = Changes.create()
      const obj = domain.enableChanges({ a: 1 })
      let callCount = 0

      const cached = domain.createCachedFunction(() => {
        callCount++
        return obj.a * 2
      })

      assert.equal(cached.call(), 2)
      assert.equal(cached.call(), 2)
      assert.equal(callCount, 1)

      obj.a = 5
      assert.equal(cached.call(), 10)
      assert.equal(callCount, 2)
    })

    it("should accept optional name", () => {
      const events: unknown[] = []
      const domain = Changes.create({ logger: (e) => events.push(e) })
      const obj = domain.enableChanges({ x: 1 })

      const cf = domain.createCachedFunction(() => obj.x * 2, "double")

      domain.detectChanges(() => { cf.call() }, () => {})

      const refEvent = events.find((e: unknown) => (e as { type: string, source: string }).source === "double")
      assert.ok(refEvent)
    })
  })

  describe("cross-domain interactions", () => {
    it("should error when wrapping an object from a different domain", () => {
      const domain1 = Changes.create()
      const domain2 = Changes.create()

      const obj = domain1.enableChanges({ a: 1 })

      assert.throws(() => {
        domain2.enableChanges(obj)
      }, /different ChangeDomain/)
    })
  })

  describe("end-to-end scenarios", () => {
    it("should track nested objects through the public API", () => {
      const domain = Changes.create()
      const state = domain.enableChanges({
        user: { name: "Alice", age: 30 },
        items: [1, 2, 3],
      })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void state.user.name
        },
        () => calls.push("name-changed"),
      )

      state.user.name = "Bob"
      assert.deepStrictEqual(calls, ["name-changed"])
    })

    it("should work with collections end-to-end", () => {
      const domain = Changes.create()
      const state = domain.enableChanges({
        tags: new Set(["a", "b"]),
        metadata: new Map([["key", "value"]]),
      })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void state.tags.size
        },
        () => calls.push("tags-changed"),
      )

      domain.detectChanges(
        () => {
          state.metadata.get("key")
        },
        () => calls.push("metadata-changed"),
      )

      state.tags.add("c")
      assert.deepStrictEqual(calls, ["tags-changed"])

      state.metadata.set("key", "new-value")
      assert.deepStrictEqual(calls, ["tags-changed", "metadata-changed"])
    })

    it("should work with cached functions end-to-end", () => {
      const domain = Changes.create()
      const state = domain.enableChanges({ items: [1, 2, 3, 4, 5] })
      const calls: string[] = []

      const total = domain.createCachedFunction(() =>
        state.items.reduce((sum: number, n: number) => sum + n, 0),
      )

      domain.detectChanges(
        () => {
          total.call()
        },
        () => calls.push("total-changed"),
      )

      assert.equal(total.call(), 15)

      state.items.push(10)
      assert.deepStrictEqual(calls, ["total-changed"])
      assert.equal(total.call(), 25)
    })

    it("should work with before/after callbacks end-to-end", () => {
      const domain = Changes.create()
      const state = domain.enableChanges({ count: 0 })
      const order: string[] = []

      domain.detectChanges(
        () => {
          void state.count
        },
        {
          before: () => {
            order.push(`before:${state.count}`)
            return () => {
              order.push(`after:${state.count}`)
            }
          },
        },
      )

      state.count = 42
      assert.deepStrictEqual(order, ["before:0", "after:42"])
    })
  })
})

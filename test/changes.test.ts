import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { Changes } from "../src/changes.js"
import { getProxyState } from "../src/change-proxy.js"

describe("Changes (Public API)", () => {
  describe("enableChanges", () => {
    it("should wrap objects", () => {
      const obj = Changes.enableChanges({ a: 1 })
      assert.ok(getProxyState(obj))
      assert.equal(obj.a, 1)
    })

    it("should pass through primitives", () => {
      assert.equal(Changes.enableChanges(42), 42)
      assert.equal(Changes.enableChanges("hello"), "hello")
      assert.equal(Changes.enableChanges(null), null)
    })

    it("should wrap arrays", () => {
      const arr = Changes.enableChanges([1, 2, 3])
      assert.ok(getProxyState(arr))
      assert.equal(arr.length, 3)
    })

    it("should wrap Maps", () => {
      const map = Changes.enableChanges(new Map([["a", 1]]))
      assert.ok(getProxyState(map))
      assert.equal(map.get("a"), 1)
    })

    it("should wrap Sets", () => {
      const set = Changes.enableChanges(new Set([1, 2]))
      assert.ok(getProxyState(set))
      assert.equal(set.has(1), true)
    })
  })

  describe("detectChanges", () => {
    it("should track and notify on changes", () => {
      const obj = Changes.enableChanges({ a: 1 })
      const calls: string[] = []

      Changes.detectChanges(
        () => {
          void obj.a
        },
        () => calls.push("onChange"),
      )

      obj.a = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should return ChangeDetecting with result and remove", () => {
      const obj = Changes.enableChanges({ a: 1 })
      const calls: string[] = []

      const detecting = Changes.detectChanges(
        () => obj.a * 10,
        () => calls.push("onChange"),
      )

      assert.equal(detecting.result, 10)

      detecting.remove()
      obj.a = 2
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("createCachedFunction", () => {
    it("should cache and invalidate", () => {
      const obj = Changes.enableChanges({ a: 1 })
      let callCount = 0

      const cached = Changes.createCachedFunction(() => {
        callCount++
        return obj.a * 2
      })

      assert.equal(cached(), 2)
      assert.equal(cached(), 2)
      assert.equal(callCount, 1)

      obj.a = 5
      assert.equal(cached(), 10)
      assert.equal(callCount, 2)
    })
  })

  describe("globalDomain", () => {
    it("should return the global ChangeDomain", () => {
      const domain = Changes.globalDomain
      assert.ok(domain)
      assert.equal(Changes.globalDomain, domain) // same instance
    })

    it("should be the domain used by shorthand methods", () => {
      const obj = Changes.enableChanges({ x: 1 })
      const state = getProxyState(obj)
      assert.equal(state?.changeDomain, Changes.globalDomain)
    })
  })

  describe("createDomain", () => {
    it("should return independent domains", () => {
      const domain1 = Changes.createDomain()
      const domain2 = Changes.createDomain()

      assert.notEqual(domain1, domain2)
      assert.notEqual(domain1, Changes.globalDomain)
    })

    it("should support independent change tracking", () => {
      const domain = Changes.createDomain()
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
  })

  describe("cross-domain interactions", () => {
    it("should error when wrapping an object from a different domain", () => {
      const domain1 = Changes.createDomain()
      const domain2 = Changes.createDomain()

      const obj = domain1.enableChanges({ a: 1 })

      assert.throws(() => {
        domain2.enableChanges(obj)
      }, /different ChangeDomain/)
    })
  })

  describe("end-to-end scenarios", () => {
    it("should track nested objects through the public API", () => {
      const state = Changes.enableChanges({
        user: { name: "Alice", age: 30 },
        items: [1, 2, 3],
      })
      const calls: string[] = []

      Changes.detectChanges(
        () => {
          void state.user.name
        },
        () => calls.push("name-changed"),
      )

      state.user.name = "Bob"
      assert.deepStrictEqual(calls, ["name-changed"])
    })

    it("should work with collections end-to-end", () => {
      const state = Changes.enableChanges({
        tags: new Set(["a", "b"]),
        metadata: new Map([["key", "value"]]),
      })
      const calls: string[] = []

      Changes.detectChanges(
        () => {
          void state.tags.size
        },
        () => calls.push("tags-changed"),
      )

      Changes.detectChanges(
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
      const state = Changes.enableChanges({ items: [1, 2, 3, 4, 5] })
      const calls: string[] = []

      const total = Changes.createCachedFunction(() =>
        state.items.reduce((sum: number, n: number) => sum + n, 0),
      )

      Changes.detectChanges(
        () => {
          total()
        },
        () => calls.push("total-changed"),
      )

      assert.equal(total(), 15)

      state.items.push(10)
      assert.deepStrictEqual(calls, ["total-changed"])
      assert.equal(total(), 25)
    })

    it("should work with before/after callbacks end-to-end", () => {
      const state = Changes.enableChanges({ count: 0 })
      const order: string[] = []

      Changes.detectChanges(
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

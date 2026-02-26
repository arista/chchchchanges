import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { getProxyState } from "../src/change-proxy.js"

describe("Map ChangeProxy", () => {
  describe("map.get(key)", () => {
    it("should return values", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))

      assert.equal(map.get("a"), 1)
      assert.equal(map.get("b"), undefined)
    })

    it("should subscribe to MapKey and MapClear sources", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
        },
        () => calls.push("onChange"),
      )

      map.set("a", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should fire onChange when clear is called after subscribing via get", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
        },
        () => calls.push("onChange"),
      )

      map.clear()
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should auto-wrap returned values", () => {
      const domain = new ChangeDomain()
      const inner = { x: 42 }
      const map = domain.enableChanges(new Map<string, object>([["obj", inner]]))

      const result = map.get("obj")
      assert.ok(result)
      assert.ok(getProxyState(result))
      assert.equal((result as { x: number }).x, 42)
    })
  })

  describe("map.has(key)", () => {
    it("should return correct boolean", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))

      assert.equal(map.has("a"), true)
      assert.equal(map.has("b"), false)
    })

    it("should subscribe to MapHasKey and MapClear sources", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.has("a")
        },
        () => calls.push("onChange"),
      )

      map.set("a", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should fire onChange when clear is called after subscribing via has", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.has("a")
        },
        () => calls.push("onChange"),
      )

      map.clear()
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("map.size", () => {
    it("should return the correct size", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )

      assert.equal(map.size, 2)
    })

    it("should subscribe to MapSize source", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void map.size
        },
        () => calls.push("onChange"),
      )

      map.set("b", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("map.set(key, val)", () => {
    it("should notify MapKey, MapHasKey, MapSize, and MapKeys sources", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map<string, number>())
      const keyCalls: string[] = []
      const hasCalls: string[] = []
      const sizeCalls: string[] = []
      const keysCalls: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
        },
        () => keyCalls.push("key"),
      )
      domain.detectChanges(
        () => {
          map.has("a")
        },
        () => hasCalls.push("has"),
      )
      domain.detectChanges(
        () => {
          void map.size
        },
        () => sizeCalls.push("size"),
      )
      domain.detectChanges(
        () => {
          map.keys()
        },
        () => keysCalls.push("keys"),
      )

      map.set("a", 1)

      assert.deepStrictEqual(keyCalls, ["key"])
      assert.deepStrictEqual(hasCalls, ["has"])
      assert.deepStrictEqual(sizeCalls, ["size"])
      assert.deepStrictEqual(keysCalls, ["keys"])
    })

    it("should return the proxy (for chaining)", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map<string, number>())

      const result = map.set("a", 1)
      assert.equal(result, map)
    })

    it("should wrap the assigned value", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map<string, object>())
      const inner = { x: 42 }

      map.set("a", inner)
      const result = map.get("a")
      assert.ok(result)
      assert.ok(getProxyState(result))
    })

    it("should skip notifications inside detectChanges", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
          map.set("a", 99)
        },
        () => calls.push("onChange"),
      )

      assert.equal(map.get("a"), 99)
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("map.delete(key)", () => {
    it("should notify MapKey, MapHasKey, MapSize, and MapKeys sources", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )
      const keyCalls: string[] = []
      const hasCalls: string[] = []
      const sizeCalls: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
        },
        () => keyCalls.push("key"),
      )
      domain.detectChanges(
        () => {
          map.has("a")
        },
        () => hasCalls.push("has"),
      )
      domain.detectChanges(
        () => {
          void map.size
        },
        () => sizeCalls.push("size"),
      )

      map.delete("a")

      assert.deepStrictEqual(keyCalls, ["key"])
      assert.deepStrictEqual(hasCalls, ["has"])
      assert.deepStrictEqual(sizeCalls, ["size"])
    })

    it("should return true when key existed", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))

      assert.equal(map.delete("a"), true)
      assert.equal(map.delete("a"), false)
    })
  })

  describe("map.clear()", () => {
    it("should notify MapSize, MapKeys, and MapClear sources", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )
      const sizeCalls: string[] = []
      const keysCalls: string[] = []
      const clearCalls: string[] = []

      domain.detectChanges(
        () => {
          void map.size
        },
        () => sizeCalls.push("size"),
      )
      domain.detectChanges(
        () => {
          map.keys()
        },
        () => keysCalls.push("keys"),
      )
      domain.detectChanges(
        () => {
          // Subscribe via get to pick up MapClear
          map.get("a")
        },
        () => clearCalls.push("clear"),
      )

      map.clear()

      assert.deepStrictEqual(sizeCalls, ["size"])
      assert.deepStrictEqual(keysCalls, ["keys"])
      assert.deepStrictEqual(clearCalls, ["clear"])
    })

    it("should empty the map", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )

      map.clear()
      assert.equal(map.size, 0)
    })
  })

  describe("iteration", () => {
    it("should subscribe to MapKeys when iterating with for-of", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(
        new Map([
          ["a", 1],
          ["b", 2],
        ]),
      )
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const [k, v] of map) {
            void k
            void v
          }
        },
        () => calls.push("onChange"),
      )

      map.set("c", 3)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to MapKeys via keys()", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of map.keys()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      map.set("b", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to MapKeys via values()", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of map.values()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      map.set("b", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to MapKeys via entries()", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of map.entries()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      map.set("b", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to MapKeys via forEach", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          map.forEach(() => {})
        },
        () => calls.push("onChange"),
      )

      map.set("b", 2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should auto-wrap values from values()", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", { x: 1 }]]))

      for (const val of map.values()) {
        assert.ok(getProxyState(val as object))
      }
    })

    it("should auto-wrap values from entries()", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", { x: 1 }]]))

      for (const [, val] of map.entries()) {
        assert.ok(getProxyState(val as object))
      }
    })

    it("should auto-wrap values in forEach callback", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", { x: 1 }]]))

      map.forEach((val) => {
        assert.ok(getProxyState(val as object))
      })
    })
  })

  describe("end-to-end", () => {
    it("should track nested object changes through map values", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["obj", { value: 1 }]]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          const obj = map.get("obj")
          void (obj as { value: number }).value
        },
        () => calls.push("onChange"),
      )

      const obj = map.get("obj") as { value: number }
      obj.value = 42
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should support before/after callbacks", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const order: string[] = []

      domain.detectChanges(
        () => {
          map.get("a")
        },
        {
          before: () => {
            order.push(`before:${map.get("a")}`)
            return () => {
              order.push(`after:${map.get("a")}`)
            }
          },
        },
      )

      map.set("a", 99)
      assert.deepStrictEqual(order, ["before:1", "after:99"])
    })

    it("should not notify after remove() is called", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map([["a", 1]]))
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => {
          map.get("a")
        },
        () => calls.push("onChange"),
      )

      detecting.remove()
      map.set("a", 2)

      assert.deepStrictEqual(calls, [])
    })

    it("should correctly identify Maps vs plain objects", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map())
      const obj = domain.enableChanges({})

      assert.ok(map instanceof Map)
      assert.ok(!(obj instanceof Map))
    })

    it("should support method chaining with set", () => {
      const domain = new ChangeDomain()
      const map = domain.enableChanges(new Map<string, number>())

      map.set("a", 1).set("b", 2).set("c", 3)

      assert.equal(map.size, 3)
      assert.equal(map.get("a"), 1)
      assert.equal(map.get("b"), 2)
      assert.equal(map.get("c"), 3)
    })
  })
})

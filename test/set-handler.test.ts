import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"

describe("Set ChangeProxy", () => {
  describe("set.has(key)", () => {
    it("should return correct boolean", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))

      assert.equal(set.has(1), true)
      assert.equal(set.has(99), false)
    })

    it("should subscribe to SetHas and SetClear sources", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          set.has(1)
        },
        () => calls.push("onChange"),
      )

      set.add(1) // re-add existing — still notifies
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should fire onChange when clear is called after subscribing via has", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          set.has(1)
        },
        () => calls.push("onChange"),
      )

      set.clear()
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("set.size", () => {
    it("should return the correct size", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))

      assert.equal(set.size, 3)
    })

    it("should subscribe to SetSize source", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void set.size
        },
        () => calls.push("onChange"),
      )

      set.add(2)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("set.add(key)", () => {
    it("should notify SetHas, SetSize, and SetKeys sources", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set<number>())
      const hasCalls: string[] = []
      const sizeCalls: string[] = []
      const keysCalls: string[] = []

      domain.detectChanges(
        () => {
          set.has(1)
        },
        () => hasCalls.push("has"),
      )
      domain.detectChanges(
        () => {
          void set.size
        },
        () => sizeCalls.push("size"),
      )
      domain.detectChanges(
        () => {
          set.keys()
        },
        () => keysCalls.push("keys"),
      )

      set.add(1)

      assert.deepStrictEqual(hasCalls, ["has"])
      assert.deepStrictEqual(sizeCalls, ["size"])
      assert.deepStrictEqual(keysCalls, ["keys"])
    })

    it("should return the proxy (for chaining)", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set<number>())

      const result = set.add(1)
      assert.equal(result, set)
    })

    it("should skip notifications inside detectChanges", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          set.has(1)
          set.add(2)
        },
        () => calls.push("onChange"),
      )

      assert.equal(set.has(2), true)
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("set.delete(key)", () => {
    it("should notify SetHas, SetSize, and SetKeys sources", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))
      const hasCalls: string[] = []
      const sizeCalls: string[] = []
      const keysCalls: string[] = []

      domain.detectChanges(
        () => {
          set.has(1)
        },
        () => hasCalls.push("has"),
      )
      domain.detectChanges(
        () => {
          void set.size
        },
        () => sizeCalls.push("size"),
      )
      domain.detectChanges(
        () => {
          set.keys()
        },
        () => keysCalls.push("keys"),
      )

      set.delete(1)

      assert.deepStrictEqual(hasCalls, ["has"])
      assert.deepStrictEqual(sizeCalls, ["size"])
      assert.deepStrictEqual(keysCalls, ["keys"])
    })

    it("should return true when key existed", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2]))

      assert.equal(set.delete(1), true)
      assert.equal(set.delete(1), false)
    })
  })

  describe("set.clear()", () => {
    it("should notify SetSize, SetKeys, and SetClear sources", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))
      const sizeCalls: string[] = []
      const keysCalls: string[] = []
      const clearCalls: string[] = []

      domain.detectChanges(
        () => {
          void set.size
        },
        () => sizeCalls.push("size"),
      )
      domain.detectChanges(
        () => {
          set.keys()
        },
        () => keysCalls.push("keys"),
      )
      domain.detectChanges(
        () => {
          // Subscribe via has to pick up SetClear
          set.has(1)
        },
        () => clearCalls.push("clear"),
      )

      set.clear()

      assert.deepStrictEqual(sizeCalls, ["size"])
      assert.deepStrictEqual(keysCalls, ["keys"])
      assert.deepStrictEqual(clearCalls, ["clear"])
    })

    it("should empty the set", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))

      set.clear()
      assert.equal(set.size, 0)
    })
  })

  describe("iteration", () => {
    it("should subscribe to SetKeys when iterating with for-of", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2, 3]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of set) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      set.add(4)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to SetKeys via values()", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of set.values()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      set.add(2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to SetKeys via entries()", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of set.entries()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      set.add(2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to SetKeys via keys()", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of set.keys()) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      set.add(2)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe to SetKeys via forEach", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      domain.detectChanges(
        () => {
          set.forEach(() => {})
        },
        () => calls.push("onChange"),
      )

      set.add(2)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("end-to-end", () => {
    it("should support before/after callbacks", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1, 2]))
      const order: string[] = []

      domain.detectChanges(
        () => {
          void set.size
        },
        {
          before: () => {
            order.push(`before:${set.size}`)
            return () => {
              order.push(`after:${set.size}`)
            }
          },
        },
      )

      set.add(3)
      assert.deepStrictEqual(order, ["before:2", "after:3"])
    })

    it("should not notify after remove() is called", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set([1]))
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => {
          set.has(1)
        },
        () => calls.push("onChange"),
      )

      detecting.remove()
      set.add(1)

      assert.deepStrictEqual(calls, [])
    })

    it("should correctly identify Sets vs plain objects", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set())
      const obj = domain.enableChanges({})

      assert.ok(set instanceof Set)
      assert.ok(!(obj instanceof Set))
    })

    it("should support method chaining with add", () => {
      const domain = new ChangeDomain()
      const set = domain.enableChanges(new Set<number>())

      set.add(1).add(2).add(3)

      assert.equal(set.size, 3)
      assert.ok(set.has(1))
      assert.ok(set.has(2))
      assert.ok(set.has(3))
    })
  })
})

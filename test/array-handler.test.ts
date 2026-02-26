import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { getProxyState } from "../src/change-proxy.js"

describe("Array ChangeProxy", () => {
  describe("get trap", () => {
    it("should return array element values", () => {
      const domain = new ChangeDomain()
      const proxy = domain.enableChanges([10, 20, 30])

      assert.equal(proxy[0], 10)
      assert.equal(proxy[1], 20)
      assert.equal(proxy[2], 30)
    })

    it("should subscribe to array source and fire onChange on set", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[0]
        },
        () => calls.push("onChange"),
      )

      arr[0] = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should auto-wrap returned objects", () => {
      const domain = new ChangeDomain()
      const inner = { x: 1 }
      const proxy = domain.enableChanges([inner])

      const result = proxy[0]
      assert.notEqual(result, inner)
      assert.equal(result.x, 1)
      assert.ok(getProxyState(result))
    })

    it("should return length property", () => {
      const domain = new ChangeDomain()
      const proxy = domain.enableChanges([1, 2, 3])

      assert.equal(proxy.length, 3)
    })
  })

  describe("set trap (index assignment)", () => {
    it("should notify array source on index assignment", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[0]
        },
        () => calls.push("onChange"),
      )

      arr[1] = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should wrap assigned objects", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges<unknown[]>([1, 2])
      const inner = { x: 42 }

      arr[0] = inner

      assert.ok(getProxyState(arr[0] as object))
      assert.equal((arr[0] as { x: number }).x, 42)
    })

    it("should skip notifications inside detectChanges", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[0]
          arr[0] = 99
        },
        () => calls.push("onChange"),
      )

      assert.equal(arr[0], 99)
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("push/pop/splice", () => {
    it("should trigger onChange on push", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr.length
        },
        () => calls.push("onChange"),
      )

      arr.push(3)
      assert.deepStrictEqual(calls, ["onChange"])
      assert.equal(arr.length, 3)
      assert.equal(arr[2], 3)
    })

    it("should trigger onChange on pop", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr.length
        },
        () => calls.push("onChange"),
      )

      const popped = arr.pop()
      assert.equal(popped, 3)
      assert.deepStrictEqual(calls, ["onChange"])
      assert.equal(arr.length, 2)
    })

    it("should trigger onChange on splice", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3, 4])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr.length
        },
        () => calls.push("onChange"),
      )

      arr.splice(1, 2, 10, 20, 30)
      assert.deepStrictEqual(calls, ["onChange"])
      assert.deepStrictEqual([...arr], [1, 10, 20, 30, 4])
    })
  })

  describe("iteration", () => {
    it("should subscribe when iterating with for-of", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          for (const _ of arr) {
            void _
          }
        },
        () => calls.push("onChange"),
      )

      arr.push(4)
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe when using forEach", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          arr.forEach(() => {})
        },
        () => calls.push("onChange"),
      )

      arr[0] = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should subscribe when using map", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          arr.map((x) => x * 2)
        },
        () => calls.push("onChange"),
      )

      arr.push(4)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("sort", () => {
    it("should trigger onChange on sort", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([3, 1, 2])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[0]
        },
        () => calls.push("onChange"),
      )

      arr.sort()
      assert.deepStrictEqual(calls, ["onChange"])
      assert.deepStrictEqual([...arr], [1, 2, 3])
    })
  })

  describe("has trap", () => {
    it("should subscribe to array source", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void (0 in arr)
        },
        () => calls.push("onChange"),
      )

      arr[0] = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("ownKeys trap", () => {
    it("should subscribe to array source", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.keys(arr)
        },
        () => calls.push("onChange"),
      )

      arr.push(3)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("deleteProperty trap", () => {
    it("should notify array source", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[1]
        },
        () => calls.push("onChange"),
      )

      delete arr[1]
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("end-to-end", () => {
    it("should track nested array of objects", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([{ value: 1 }, { value: 2 }])
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void arr[0].value
        },
        () => calls.push("onChange"),
      )

      arr[0].value = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should support before/after callbacks", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const order: string[] = []

      domain.detectChanges(
        () => {
          void arr[0]
        },
        {
          before: () => {
            order.push(`before:${arr[0]}`)
            return () => {
              order.push(`after:${arr[0]}`)
            }
          },
        },
      )

      arr[0] = 99
      assert.deepStrictEqual(order, ["before:1", "after:99"])
    })

    it("should not notify after remove() is called", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => {
          void arr[0]
        },
        () => calls.push("onChange"),
      )

      detecting.remove()
      arr[0] = 99

      assert.deepStrictEqual(calls, [])
    })

    it("should use single source for all accesses", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const calls: string[] = []

      // Subscribe by reading index 0
      domain.detectChanges(
        () => {
          void arr[0]
        },
        () => calls.push("onChange"),
      )

      // Mutate index 2 — should still fire because it's the same source
      arr[2] = 99
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should correctly identify arrays vs plain objects", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2])
      const obj = domain.enableChanges({ a: 1 })

      // Array should use array handler (single source)
      assert.ok(Array.isArray(arr))
      // Object should not be array
      assert.ok(!Array.isArray(obj))
    })
  })
})

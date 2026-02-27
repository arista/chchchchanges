import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { Changes } from "../src/changes.js"
import type { Change } from "../src/change-types.js"

describe("Subscriptions", () => {
  describe("Object subscriptions", () => {
    it("should notify on property set", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const changes: Change[] = []

      domain.subscribe(obj, (change) => {
        changes.push(change)
      })

      const proxy = domain.enableChanges(obj)
      proxy.a = 2

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectSet")
      if (changes[0]!.type === "ObjectSet") {
        assert.equal(changes[0]!.prop, "a")
        assert.equal(changes[0]!.value, 2)
      }
    })

    it("should notify on property delete", () => {
      const domain = new ChangeDomain()
      const obj: { a?: number } = { a: 1 }
      const changes: Change[] = []

      const proxy = domain.subscribe(obj, (change) => {
        changes.push(change)
      })

      delete proxy.a

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectDeleteProperty")
      if (changes[0]!.type === "ObjectDeleteProperty") {
        assert.equal(changes[0]!.prop, "a")
      }
    })

    it("should notify on defineProperty", () => {
      const domain = new ChangeDomain()
      const obj = {}
      const changes: Change[] = []

      const proxy = domain.subscribe(obj, (change) => {
        changes.push(change)
      })

      Object.defineProperty(proxy, "x", { value: 42, writable: true })

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectDefineProperty")
      if (changes[0]!.type === "ObjectDefineProperty") {
        assert.equal(changes[0]!.key, "x")
      }
    })

    it("should notify on setPrototypeOf", () => {
      const domain = new ChangeDomain()
      const obj = {}
      const changes: Change[] = []

      const proxy = domain.subscribe(obj, (change) => {
        changes.push(change)
      })

      Object.setPrototypeOf(proxy, { foo: "bar" })

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectSetPrototypeOf")
    })

    it("should notify on preventExtensions", () => {
      const domain = new ChangeDomain()
      const obj = {}
      const changes: Change[] = []

      const proxy = domain.subscribe(obj, (change) => {
        changes.push(change)
      })

      Object.preventExtensions(proxy)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectPreventExtensions")
    })

    it("should support before callbacks", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const sequence: string[] = []

      const proxy = domain.subscribe(obj, {
        before: (change) => {
          sequence.push("before")
          assert.equal(change.type, "ObjectSet")
          return () => {
            sequence.push("after")
          }
        },
      })

      proxy.a = 2
      assert.deepStrictEqual(sequence, ["before", "after"])
    })

    it("should support explicit after callbacks", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const changes: Change[] = []

      const proxy = domain.subscribe(obj, {
        after: (change) => {
          changes.push(change)
        },
      })

      proxy.a = 2
      assert.equal(changes.length, 1)
    })
  })

  describe("Array subscriptions", () => {
    it("should notify on push", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.push(4, 5)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayPush")
      if (changes[0]!.type === "ArrayPush") {
        assert.deepStrictEqual(changes[0]!.elements, [4, 5])
      }
    })

    it("should notify on pop", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.pop()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayPop")
    })

    it("should notify on shift", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.shift()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayShift")
    })

    it("should notify on unshift", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.unshift(0)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayUnshift")
      if (changes[0]!.type === "ArrayUnshift") {
        assert.deepStrictEqual(changes[0]!.elements, [0])
      }
    })

    it("should notify on splice", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3, 4, 5]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.splice(1, 2, 10, 20, 30)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArraySplice")
      if (changes[0]!.type === "ArraySplice") {
        assert.equal(changes[0]!.start, 1)
        assert.equal(changes[0]!.deleteCount, 2)
        assert.deepStrictEqual(changes[0]!.items, [10, 20, 30])
      }
    })

    it("should notify on reverse", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.reverse()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayReverse")
    })

    it("should notify on sort", () => {
      const domain = new ChangeDomain()
      const arr = [3, 1, 2]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.sort()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArraySort")
    })

    it("should notify on fill", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3, 4, 5]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.fill(0, 1, 3)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayFill")
      if (changes[0]!.type === "ArrayFill") {
        assert.equal(changes[0]!.value, 0)
        assert.equal(changes[0]!.start, 1)
        assert.equal(changes[0]!.end, 3)
      }
    })

    it("should notify on copyWithin", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3, 4, 5]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      proxy.copyWithin(0, 3)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayCopyWithin")
      if (changes[0]!.type === "ArrayCopyWithin") {
        assert.equal(changes[0]!.dest, 0)
        assert.equal(changes[0]!.start, 3)
      }
    })

    it("should suppress object-level changes during array methods", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const changes: Change[] = []

      const proxy = domain.subscribe(arr, (change) => {
        changes.push(change)
      })

      // push modifies length and adds elements, but should only report ArrayPush
      proxy.push(4)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ArrayPush")
    })
  })

  describe("Map subscriptions", () => {
    it("should notify on set", () => {
      const domain = new ChangeDomain()
      const map = new Map<string, number>()
      const changes: Change[] = []

      const proxy = domain.subscribe(map, (change) => {
        changes.push(change)
      })

      proxy.set("a", 1)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "MapSet")
      if (changes[0]!.type === "MapSet") {
        assert.equal(changes[0]!.key, "a")
        assert.equal(changes[0]!.value, 1)
      }
    })

    it("should notify on delete", () => {
      const domain = new ChangeDomain()
      const map = new Map<string, number>([["a", 1]])
      const changes: Change[] = []

      const proxy = domain.subscribe(map, (change) => {
        changes.push(change)
      })

      proxy.delete("a")

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "MapDelete")
      if (changes[0]!.type === "MapDelete") {
        assert.equal(changes[0]!.key, "a")
      }
    })

    it("should notify on clear", () => {
      const domain = new ChangeDomain()
      const map = new Map<string, number>([
        ["a", 1],
        ["b", 2],
      ])
      const changes: Change[] = []

      const proxy = domain.subscribe(map, (change) => {
        changes.push(change)
      })

      proxy.clear()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "MapClear")
    })
  })

  describe("Set subscriptions", () => {
    it("should notify on add", () => {
      const domain = new ChangeDomain()
      const set = new Set<number>()
      const changes: Change[] = []

      const proxy = domain.subscribe(set, (change) => {
        changes.push(change)
      })

      proxy.add(1)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "SetAdd")
      if (changes[0]!.type === "SetAdd") {
        assert.equal(changes[0]!.value, 1)
      }
    })

    it("should notify on delete", () => {
      const domain = new ChangeDomain()
      const set = new Set<number>([1, 2, 3])
      const changes: Change[] = []

      const proxy = domain.subscribe(set, (change) => {
        changes.push(change)
      })

      proxy.delete(2)

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "SetDelete")
      if (changes[0]!.type === "SetDelete") {
        assert.equal(changes[0]!.value, 2)
      }
    })

    it("should notify on clear", () => {
      const domain = new ChangeDomain()
      const set = new Set<number>([1, 2, 3])
      const changes: Change[] = []

      const proxy = domain.subscribe(set, (change) => {
        changes.push(change)
      })

      proxy.clear()

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "SetClear")
    })
  })

  describe("unsubscribe", () => {
    it("should stop receiving notifications after unsubscribe", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const changes: Change[] = []

      const listener = (change: Change) => {
        changes.push(change)
      }

      const proxy = domain.subscribe(obj, listener)
      proxy.a = 2
      assert.equal(changes.length, 1)

      domain.unsubscribe(proxy, listener)
      proxy.a = 3
      assert.equal(changes.length, 1) // No new notifications
    })

    it("should handle unsubscribe of non-subscribed listener", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy = domain.enableChanges(obj)

      // Should not throw
      domain.unsubscribe(proxy, () => {})
    })
  })

  describe("Changes global API", () => {
    it("should expose subscribe on Changes object", () => {
      const obj = { a: 1 }
      const changes: Change[] = []

      const proxy = Changes.subscribe(obj, (change) => {
        changes.push(change)
      })

      proxy.a = 2

      assert.equal(changes.length, 1)
      assert.equal(changes[0]!.type, "ObjectSet")
    })

    it("should expose unsubscribe on Changes object", () => {
      const obj = { a: 1 }
      const changes: Change[] = []

      const listener = (change: Change) => {
        changes.push(change)
      }

      const proxy = Changes.subscribe(obj, listener)
      proxy.a = 2
      assert.equal(changes.length, 1)

      Changes.unsubscribe(proxy, listener)
      proxy.a = 3
      assert.equal(changes.length, 1)
    })
  })

  describe("multiple subscriptions", () => {
    it("should notify multiple listeners", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const changes1: Change[] = []
      const changes2: Change[] = []

      const proxy = domain.subscribe(obj, (change) => {
        changes1.push(change)
      })

      domain.subscribe(proxy, (change) => {
        changes2.push(change)
      })

      proxy.a = 2

      assert.equal(changes1.length, 1)
      assert.equal(changes2.length, 1)
    })
  })

  describe("interaction with detectChanges", () => {
    it("should not fire subscription notifications inside detectChanges", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const subscriptionChanges: Change[] = []
      const detectCalls: string[] = []

      const proxy = domain.subscribe(obj, (change) => {
        subscriptionChanges.push(change)
      })

      domain.detectChanges(
        () => {
          void proxy.a
        },
        () => {
          detectCalls.push("onChange")
        },
      )

      // Mutation inside detectChanges should not fire subscription
      domain.detectChanges(
        () => {
          proxy.a = 2
        },
        () => {},
      )

      // No subscription notifications for mutations inside detectChanges
      assert.equal(subscriptionChanges.length, 0)

      // But outside detectChanges, it should fire
      proxy.a = 3
      assert.equal(subscriptionChanges.length, 1)
    })
  })
})

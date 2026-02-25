import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { getProxyState } from "../src/change-proxy.js"

describe("Object ChangeProxy", () => {
  describe("get trap", () => {
    it("should return property values", () => {
      const domain = new ChangeDomain()
      const proxy = domain.enableChanges({ a: 1, b: "hello" })

      assert.equal(proxy.a, 1)
      assert.equal(proxy.b, "hello")
    })

    it("should subscribe to property source and fire onChange on set", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => {
          calls.push("onChange")
        },
      )

      obj.a = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should auto-wrap returned objects", () => {
      const domain = new ChangeDomain()
      const inner = { x: 1 }
      const proxy = domain.enableChanges({ nested: inner })

      const result = proxy.nested
      assert.notEqual(result, inner)
      assert.equal(result.x, 1)
      // Verify it's a proxy
      assert.ok(getProxyState(result))
    })

    it("should not subscribe when outside detectChanges", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })

      // Access without detectChanges - should not throw or error
      assert.equal(obj.a, 1)
    })
  })

  describe("set trap", () => {
    it("should notify property, hasProperty, and ownKeys sources", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const propertyCalls: string[] = []
      const hasCalls: string[] = []
      const ownKeysCalls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => propertyCalls.push("property"),
      )
      domain.detectChanges(
        () => {
          void ("a" in obj)
        },
        () => hasCalls.push("has"),
      )
      domain.detectChanges(
        () => {
          Object.keys(obj)
        },
        () => ownKeysCalls.push("ownKeys"),
      )

      obj.a = 2

      assert.deepStrictEqual(propertyCalls, ["property"])
      assert.deepStrictEqual(hasCalls, ["has"])
      assert.deepStrictEqual(ownKeysCalls, ["ownKeys"])
    })

    it("should wrap the assigned value", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges<Record<string, unknown>>({ a: 1 })
      const inner = { x: 42 }

      obj.a = inner

      // The stored value should be a proxy
      assert.ok(getProxyState(obj.a as object))
      assert.equal((obj.a as { x: number }).x, 42)
    })

    it("should skip notifications inside detectChanges", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
          // Mutation inside detectChanges should not notify
          obj.a = 99
        },
        () => calls.push("onChange"),
      )

      // The value was set
      assert.equal(obj.a, 99)
      // But no notification fired
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("has trap", () => {
    it("should subscribe to hasProperty source", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges<Record<string, number>>({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void ("a" in obj)
        },
        () => calls.push("onChange"),
      )

      obj.a = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("deleteProperty trap", () => {
    it("should notify property, hasProperty, and ownKeys sources", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges<Record<string, number>>({ a: 1 })
      const propertyCalls: string[] = []
      const hasCalls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => propertyCalls.push("property"),
      )
      domain.detectChanges(
        () => {
          void ("a" in obj)
        },
        () => hasCalls.push("has"),
      )

      delete obj.a

      assert.deepStrictEqual(propertyCalls, ["property"])
      assert.deepStrictEqual(hasCalls, ["has"])
    })
  })

  describe("defineProperty trap", () => {
    it("should notify property, hasProperty, ownKeys, and ownPropertyDescriptor sources", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges<Record<string, number>>({ a: 1 })
      const propertyCalls: string[] = []
      const descriptorCalls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => propertyCalls.push("property"),
      )
      domain.detectChanges(
        () => {
          Object.getOwnPropertyDescriptor(obj, "a")
        },
        () => descriptorCalls.push("descriptor"),
      )

      Object.defineProperty(obj, "a", { value: 2 })

      assert.deepStrictEqual(propertyCalls, ["property"])
      assert.deepStrictEqual(descriptorCalls, ["descriptor"])
    })
  })

  describe("getOwnPropertyDescriptor trap", () => {
    it("should subscribe to ownPropertyDescriptor source", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.getOwnPropertyDescriptor(obj, "a")
        },
        () => calls.push("onChange"),
      )

      Object.defineProperty(obj, "a", { value: 2 })
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should auto-wrap descriptor value", () => {
      const domain = new ChangeDomain()
      const inner = { x: 1 }
      const obj = domain.enableChanges({ nested: inner })

      const desc = Object.getOwnPropertyDescriptor(obj, "nested")
      assert.ok(desc)
      assert.ok(getProxyState(desc.value as object))
    })
  })

  describe("ownKeys trap", () => {
    it("should subscribe to ownKeys source", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges<Record<string, number>>({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.keys(obj)
        },
        () => calls.push("onChange"),
      )

      obj.b = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("getPrototypeOf trap", () => {
    it("should subscribe to prototypeOf source", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({})
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.getPrototypeOf(obj)
        },
        () => calls.push("onChange"),
      )

      Object.setPrototypeOf(obj, { custom: true })
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("setPrototypeOf trap", () => {
    it("should notify prototypeOf source", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({})
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.getPrototypeOf(obj)
        },
        () => calls.push("onChange"),
      )

      Object.setPrototypeOf(obj, null)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("isExtensible / preventExtensions traps", () => {
    it("should subscribe to isExtensible and notify on preventExtensions", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          Object.isExtensible(obj)
        },
        () => calls.push("onChange"),
      )

      Object.preventExtensions(obj)
      assert.deepStrictEqual(calls, ["onChange"])
    })
  })

  describe("apply / construct traps", () => {
    it("should pass through function calls", () => {
      const domain = new ChangeDomain()
      const fn = domain.enableChanges((x: number) => x * 2)

      assert.equal(fn(21), 42)
    })

    it("should pass through constructor calls", () => {
      const domain = new ChangeDomain()

      class Foo {
        value: number
        constructor(v: number) {
          this.value = v
        }
      }

      const ProxiedFoo = domain.enableChanges(Foo)
      const instance = new ProxiedFoo(42)

      assert.equal(instance.value, 42)
    })
  })

  describe("end-to-end", () => {
    it("should track nested object changes", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ nested: { value: 1 } })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void obj.nested.value
        },
        () => calls.push("onChange"),
      )

      obj.nested.value = 2
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should support before/after callbacks", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const order: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        {
          before: () => {
            order.push(`before:${obj.a}`)
            return () => {
              order.push(`after:${obj.a}`)
            }
          },
        },
      )

      obj.a = 2

      assert.deepStrictEqual(order, ["before:1", "after:2"])
    })

    it("should track changes across multiple properties", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1, b: 2 })
      const aCalls: string[] = []
      const bCalls: string[] = []

      domain.detectChanges(
        () => {
          void obj.a
        },
        () => aCalls.push("a-changed"),
      )
      domain.detectChanges(
        () => {
          void obj.b
        },
        () => bCalls.push("b-changed"),
      )

      obj.a = 10
      assert.deepStrictEqual(aCalls, ["a-changed"])
      assert.deepStrictEqual(bCalls, [])

      obj.b = 20
      assert.deepStrictEqual(bCalls, ["b-changed"])
    })

    it("should not notify after remove() is called", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      const detecting = domain.detectChanges(
        () => {
          void obj.a
        },
        () => calls.push("onChange"),
      )

      detecting.remove()
      obj.a = 2

      assert.deepStrictEqual(calls, [])
    })
  })
})

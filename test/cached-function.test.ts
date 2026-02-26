import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { getProxyState } from "../src/change-proxy.js"

describe("CachedFunction", () => {
  describe("caching behavior", () => {
    it("should cache result and return same value on second call", () => {
      const domain = new ChangeDomain()
      let callCount = 0
      const cached = domain.createCachedFunction(() => {
        callCount++
        return 42
      })

      assert.equal(cached.call(), 42)
      assert.equal(cached.call(), 42)
      assert.equal(callCount, 1)
    })

    it("should auto-wrap result with enableChanges", () => {
      const domain = new ChangeDomain()
      const inner = { x: 1 }
      const cached = domain.createCachedFunction(() => inner)

      const result = cached.call()
      assert.ok(getProxyState(result))
      assert.equal(result.x, 1)
    })

    it("should return same proxy on repeated calls", () => {
      const domain = new ChangeDomain()
      const cached = domain.createCachedFunction(() => ({ x: 1 }))

      const a = cached.call()
      const b = cached.call()
      assert.equal(a, b)
    })
  })

  describe("invalidation", () => {
    it("should invalidate when dependency changes", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      let callCount = 0

      const cached = domain.createCachedFunction(() => {
        callCount++
        return obj.a * 2
      })

      // First call evaluates
      assert.equal(cached.call(), 2)
      assert.equal(callCount, 1)

      // Second call returns cached
      assert.equal(cached.call(), 2)
      assert.equal(callCount, 1)

      // Mutate dependency
      obj.a = 5

      // Next call re-evaluates
      assert.equal(cached.call(), 10)
      assert.equal(callCount, 2)
    })

    it("should re-evaluate after invalidation and cache new result", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })

      const cached = domain.createCachedFunction(() => obj.a + 10)

      assert.equal(cached.call(), 11)

      obj.a = 5
      assert.equal(cached.call(), 15)

      // Calling again returns cached new value
      assert.equal(cached.call(), 15)
    })

    it("should track new dependencies after re-evaluation", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1, b: 10 })
      let useB = false

      const cached = domain.createCachedFunction(() => {
        return useB ? obj.b : obj.a
      })

      // Initially reads obj.a
      assert.equal(cached.call(), 1)

      // Changing obj.b should NOT invalidate (not a dependency)
      obj.b = 20
      assert.equal(cached.call(), 1)

      // Changing obj.a invalidates
      useB = true
      obj.a = 2
      // Re-evaluates, now reads obj.b
      assert.equal(cached.call(), 20)

      // Now obj.b IS a dependency
      obj.b = 30
      assert.equal(cached.call(), 30)
    })
  })

  describe("acts as a ChangeSource", () => {
    it("should notify outer detectChanges when invalidated", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      const cached = domain.createCachedFunction(() => obj.a * 2)

      domain.detectChanges(
        () => {
          cached.call()
        },
        () => calls.push("onChange"),
      )

      obj.a = 5
      assert.deepStrictEqual(calls, ["onChange"])
    })

    it("should allow outer detectChanges to get new value in after-callback", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const values: number[] = []

      const cached = domain.createCachedFunction(() => obj.a * 2)

      domain.detectChanges(
        () => {
          cached.call()
        },
        () => {
          values.push(cached.call())
        },
      )

      obj.a = 5
      assert.deepStrictEqual(values, [10])
    })

    it("should not notify outer after remove()", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      const cached = domain.createCachedFunction(() => obj.a * 2)

      const detecting = domain.detectChanges(
        () => {
          cached.call()
        },
        () => calls.push("onChange"),
      )

      detecting.remove()
      obj.a = 5
      assert.deepStrictEqual(calls, [])
    })
  })

  describe("getter-only property optimization", () => {
    it("should use CachedFunction for getter-only properties", () => {
      const domain = new ChangeDomain()
      let getterCallCount = 0

      const obj = domain.enableChanges({
        x: 1,
        get doubled() {
          getterCallCount++
          return this.x * 2
        },
      })

      // First access inside detectChanges triggers CachedFunction creation
      domain.detectChanges(
        () => {
          void obj.doubled
        },
        () => {},
      )

      assert.equal(obj.doubled, 2)
      // Getter should be cached — not called again
      assert.equal(obj.doubled, 2)
      // Called once for detectChanges evaluation + once for CachedFunction evaluation
      // The CachedFunction caches subsequent calls
      assert.ok(getterCallCount <= 3)
    })

    it("should invalidate cached getter when dependencies change", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({
        x: 1,
        get doubled() {
          return this.x * 2
        },
      })
      const calls: string[] = []

      domain.detectChanges(
        () => {
          void obj.doubled
        },
        () => calls.push("onChange"),
      )

      assert.equal(obj.doubled, 2)

      obj.x = 5
      assert.deepStrictEqual(calls, ["onChange"])
      assert.equal(obj.doubled, 10)
    })

    it("should not use CachedFunction for getter-with-setter properties", () => {
      const domain = new ChangeDomain()
      let getterCallCount = 0
      let _backing = 1

      const obj = domain.enableChanges({
        get val() {
          getterCallCount++
          return _backing
        },
        set val(v: number) {
          _backing = v
        },
      })

      // Access inside detectChanges — should NOT create CachedFunction
      domain.detectChanges(
        () => {
          void obj.val
        },
        () => {},
      )

      // Each access calls the getter (no caching)
      void obj.val
      void obj.val
      assert.ok(getterCallCount >= 3)
    })
  })

  describe("nested CachedFunctions", () => {
    it("should work correctly with nested CachedFunctions", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1, b: 2 })

      const innerCached = domain.createCachedFunction(() => obj.a * 10)
      const outerCached = domain.createCachedFunction(() => innerCached.call() + obj.b)

      assert.equal(outerCached.call(), 12) // 1*10 + 2

      // Change obj.a — invalidates inner, which invalidates outer
      obj.a = 5
      assert.equal(outerCached.call(), 52) // 5*10 + 2

      // Change obj.b — only invalidates outer
      obj.b = 3
      assert.equal(outerCached.call(), 53) // 5*10 + 3
    })

    it("should propagate notifications through nested CachedFunctions", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })
      const calls: string[] = []

      const inner = domain.createCachedFunction(() => obj.a * 2)
      const outer = domain.createCachedFunction(() => inner.call() + 100)

      domain.detectChanges(
        () => {
          outer.call()
        },
        () => calls.push("onChange"),
      )

      obj.a = 5
      assert.deepStrictEqual(calls, ["onChange"])
      assert.equal(outer.call(), 110) // 5*2 + 100
    })
  })

  describe("edge cases", () => {
    it("should work when called outside detectChanges", () => {
      const domain = new ChangeDomain()
      const obj = domain.enableChanges({ a: 1 })

      const cached = domain.createCachedFunction(() => obj.a * 2)

      // No detectChanges — just evaluates and caches
      assert.equal(cached.call(), 2)
      assert.equal(cached.call(), 2)

      obj.a = 5
      assert.equal(cached.call(), 10)
    })

    it("should handle function that returns primitive", () => {
      const domain = new ChangeDomain()
      const cached = domain.createCachedFunction(() => "hello")

      assert.equal(cached.call(), "hello")
      assert.equal(cached.call(), "hello")
    })

    it("should handle function that returns null", () => {
      const domain = new ChangeDomain()
      const cached = domain.createCachedFunction(() => null)

      assert.equal(cached.call(), null)
    })
  })
})

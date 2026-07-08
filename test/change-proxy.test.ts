import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { CHANGE_PROXY_STATE, getProxyState } from "../src/change-proxy.js"
import type { ChangeProxyState } from "../src/change-proxy.js"

describe("enableChanges", () => {
  describe("primitives pass through unchanged", () => {
    it("should pass through null", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges(null), null)
    })

    it("should pass through undefined", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges(undefined), undefined)
    })

    it("should pass through numbers", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges(42), 42)
      assert.equal(domain.enableChanges(0), 0)
      assert.equal(domain.enableChanges(NaN), NaN)
    })

    it("should pass through strings", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges("hello"), "hello")
      assert.equal(domain.enableChanges(""), "")
    })

    it("should pass through booleans", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges(true), true)
      assert.equal(domain.enableChanges(false), false)
    })

    it("should pass through symbols", () => {
      const domain = new ChangeDomain()
      const sym = Symbol("test")
      assert.equal(domain.enableChanges(sym), sym)
    })

    it("should pass through bigints", () => {
      const domain = new ChangeDomain()
      assert.equal(domain.enableChanges(42n), 42n)
    })
  })

  describe("object wrapping", () => {
    it("should return a proxy for a plain object", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy = domain.enableChanges(obj)

      assert.notEqual(proxy, obj)
      assert.equal(proxy.a, 1)
    })

    it("should return a proxy for an array", () => {
      const domain = new ChangeDomain()
      const arr = [1, 2, 3]
      const proxy = domain.enableChanges(arr)

      assert.notEqual(proxy, arr)
      assert.equal(proxy[0], 1)
      assert.equal(proxy.length, 3)
    })

    it("should return a proxy for a function", () => {
      const domain = new ChangeDomain()
      const fn = () => 42
      const proxy = domain.enableChanges(fn)

      assert.notEqual(proxy, fn)
    })
  })

  describe("idempotency", () => {
    it("should return same proxy for same object", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy1 = domain.enableChanges(obj)
      const proxy2 = domain.enableChanges(obj)

      assert.equal(proxy1, proxy2)
    })

    it("should return proxy as-is when passed a proxy", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy = domain.enableChanges(obj)
      const again = domain.enableChanges(proxy)

      assert.equal(proxy, again)
    })
  })

  describe("Symbol navigation", () => {
    it("should expose ChangeProxyState via CHANGE_PROXY_STATE symbol", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy = domain.enableChanges(obj)

      const state = (proxy as Record<symbol, unknown>)[CHANGE_PROXY_STATE] as ChangeProxyState
      assert.ok(state)
      assert.equal(state.target, obj)
      assert.equal(state.proxy, proxy)
      assert.equal(state.changeDomain, domain)
      assert.equal(state.changeSources, null)
    })

    it("should return undefined for CHANGE_PROXY_STATE on a plain object", () => {
      const obj = { a: 1 }
      const state = (obj as Record<symbol, unknown>)[CHANGE_PROXY_STATE]
      assert.equal(state, undefined)
    })
  })

  describe("getProxyState helper", () => {
    it("should return state for a proxy", () => {
      const domain = new ChangeDomain()
      const obj = { a: 1 }
      const proxy = domain.enableChanges(obj)

      const state = getProxyState(proxy)
      assert.ok(state)
      assert.equal(state.target, obj)
    })

    it("should return undefined for a plain object", () => {
      assert.equal(getProxyState({ a: 1 }), undefined)
    })

    it("should return undefined for primitives", () => {
      assert.equal(getProxyState(42), undefined)
      assert.equal(getProxyState("hello"), undefined)
      assert.equal(getProxyState(null), undefined)
      assert.equal(getProxyState(undefined), undefined)
    })
  })

  describe("cross-domain", () => {
    it("should throw when wrapping an object from a different domain", () => {
      const domain1 = new ChangeDomain()
      const domain2 = new ChangeDomain()
      const obj = { a: 1 }

      domain1.enableChanges(obj)

      assert.throws(
        () => domain2.enableChanges(obj),
        /already associated with a different ChangeDomain/,
      )
    })

    it("should throw when passing a proxy from a different domain", () => {
      const domain1 = new ChangeDomain()
      const domain2 = new ChangeDomain()
      const obj = { a: 1 }

      const proxy = domain1.enableChanges(obj)

      assert.throws(
        () => domain2.enableChanges(proxy),
        /already associated with a different ChangeDomain/,
      )
    })
  })

  describe("re-wrapping an enabled collection", () => {
    // Regression: reading a change-enabled array/map/set off a change-enabled
    // object must NOT subscribe the current context to the collection's
    // structure. enableChanges probes `.next` to pass iterators through; if that
    // probe runs on an already-enabled proxy it goes through the get trap and
    // subscribes to the whole collection. The already-a-proxy check must come
    // first so re-wrapping never touches `.next`.
    it("reading a nested reactive array does not depend on its structure", () => {
      const domain = new ChangeDomain()
      // Store an already-enabled array, as a derived reactive collection would be.
      const arr = domain.enableChanges([1, 2, 3])
      const obj = domain.enableChanges({ arr })

      let runs = 0
      domain.detectChanges(
        () => {
          void obj.arr // read the reference only, as a component passing it along would
        },
        () => {
          runs++
        },
      )

      arr.push(4) // structural change to the array
      assert.equal(runs, 0)
    })

    it("still re-runs when the property itself is reassigned", () => {
      const domain = new ChangeDomain()
      const arr = domain.enableChanges([1, 2, 3])
      const obj = domain.enableChanges<{ arr: number[] }>({ arr })

      let runs = 0
      domain.detectChanges(
        () => {
          void obj.arr
        },
        () => {
          runs++
        },
      )

      obj.arr = [9] // reassignment fires the property source
      assert.equal(runs, 1)
    })
  })
})

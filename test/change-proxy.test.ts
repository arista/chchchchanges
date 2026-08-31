import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { CHANGE_PROXY_STATE, getProxyState, markRaw } from "../src/change-proxy.js"
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

  describe("markRaw", () => {
    it("returns a marked object untouched from enableChanges", () => {
      const domain = new ChangeDomain()
      const raw = markRaw({ internal: { deep: 1 } })
      const proxy = domain.enableChanges(raw)
      assert.equal(proxy, raw)
      assert.equal(getProxyState(proxy), undefined)
    })

    it("leaves a marked object raw when nested in change-enabled state", () => {
      const domain = new ChangeDomain()
      const raw = markRaw({ n: 1 })
      const state = domain.enableChanges({ raw })
      // Reached through the proxy, but not itself proxied.
      assert.equal(state.raw, raw)
      assert.equal(getProxyState(state.raw), undefined)
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

describe("objects with internal slots pass through unproxied", () => {
  // A Proxy has no [[DateValue]], [[RegExpMatcher]], [[WeakMapData]] and so on,
  // so wrapping one of these does not degrade it - it breaks every method that
  // reads the slot. `instanceof` still passes, which is why this was silent.

  it("returns a Date unwrapped, with its methods intact", () => {
    const domain = new ChangeDomain()
    const date = new Date("2026-01-02T03:04:05Z")
    const enabled = domain.enableChanges(date)

    assert.equal(enabled, date)
    assert.equal(getProxyState(enabled), undefined)
    assert.equal(enabled.getTime(), date.getTime())
    assert.equal(enabled.toISOString(), "2026-01-02T03:04:05.000Z")
  })

  it("leaves a Date reached through a change-enabled object usable", () => {
    const domain = new ChangeDomain()
    const date = new Date("2026-01-02T03:04:05Z")
    const obj = domain.enableChanges({ createdAt: date })

    // Identity is what a snapshot diff compares on, so this is the assertion
    // that keeps an unchanged timestamp from reading as a change.
    assert.equal(obj.createdAt, date)
    assert.equal(obj.createdAt.getTime(), date.getTime())
    assert.equal(JSON.stringify({ d: obj.createdAt }), `{"d":"2026-01-02T03:04:05.000Z"}`)
    assert.equal(obj.createdAt < new Date("2027-01-01T00:00:00Z"), true)
  })

  it("returns a RegExp unwrapped, with its methods intact", () => {
    const domain = new ChangeDomain()
    const re = /^ab+c$/
    const enabled = domain.enableChanges(re)

    assert.equal(enabled, re)
    assert.equal(enabled.test("abbc"), true)
  })

  it("returns WeakMap and WeakSet unwrapped - neither has a handler", () => {
    const domain = new ChangeDomain()
    const key = {}
    const wm = new WeakMap<object, number>()
    const ws = new WeakSet<object>()

    const enabledWm = domain.enableChanges(wm)
    const enabledWs = domain.enableChanges(ws)

    assert.equal(enabledWm, wm)
    assert.equal(enabledWs, ws)
    enabledWm.set(key, 1)
    enabledWs.add(key)
    assert.equal(enabledWm.get(key), 1)
    assert.equal(enabledWs.has(key), true)
  })

  it("returns a typed array and a Promise unwrapped", () => {
    const domain = new ChangeDomain()
    const bytes = new Uint8Array([1, 2, 3])
    const promise = Promise.resolve(1)

    assert.equal(domain.enableChanges(bytes), bytes)
    assert.equal(domain.enableChanges(promise), promise)
  })

  it("still wraps the four shapes that do have handlers", () => {
    const domain = new ChangeDomain()
    const obj = {}
    const arr: number[] = []
    const map = new Map()
    const set = new Set()

    assert.notEqual(domain.enableChanges(obj), obj)
    assert.notEqual(domain.enableChanges(arr), arr)
    assert.notEqual(domain.enableChanges(map), map)
    assert.notEqual(domain.enableChanges(set), set)
  })

  it("still wraps class instances", () => {
    // Object.prototype.toString reports [object Object] for a class instance,
    // so the allow-list keeps them. Generated entity classes depend on this.
    class Entity {
      id = "a"
      createdAt = new Date("2026-01-02T03:04:05Z")
    }
    const domain = new ChangeDomain()
    const entity = new Entity()
    const enabled = domain.enableChanges(entity)

    assert.notEqual(enabled, entity)
    assert.notEqual(getProxyState(enabled), undefined)
    // ...and the Date it holds is still not wrapped
    assert.equal(enabled.createdAt, entity.createdAt)
    assert.equal(enabled.createdAt.getTime(), entity.createdAt.getTime())
  })

  it("does not wrap an object that sets Symbol.toStringTag - known and accepted", () => {
    // The one cost of using Object.prototype.toString as the test. Nothing in
    // these repos sets a toStringTag; recorded so the behavior is a decision
    // rather than a surprise.
    const domain = new ChangeDomain()
    const tagged = { [Symbol.toStringTag]: "Custom", a: 1 }

    assert.equal(domain.enableChanges(tagged), tagged)
  })

  it("still reports assignment of an unproxied value", () => {
    // The value passes through; the *property set* is still a change. This is
    // what a flush needs in order to see a timestamp column move.
    const domain = new ChangeDomain()
    const obj = domain.enableChanges<{ createdAt: Date }>({
      createdAt: new Date("2026-01-02T03:04:05Z"),
    })

    let runs = 0
    domain.detectChanges(
      () => {
        void obj.createdAt
      },
      () => {
        runs++
      },
    )

    obj.createdAt = new Date("2026-06-07T08:09:10Z")
    assert.equal(runs, 1)
    assert.equal(obj.createdAt.toISOString(), "2026-06-07T08:09:10.000Z")
  })
})

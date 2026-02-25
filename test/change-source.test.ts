import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeSource, ChangeListener } from "../src/change-source.js"

describe("ChangeSource", () => {
  it("should subscribe a listener", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)

    assert.ok(source.hasListeners)
  })

  it("should unsubscribe a listener", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)
    source.unsubscribe(listener)

    assert.ok(!source.hasListeners)
  })

  it("should ignore unsubscribe for non-subscriber", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.unsubscribe(listener)

    assert.ok(!source.hasListeners)
  })

  it("should be idempotent for duplicate subscribe", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)
    source.subscribe(listener)

    const listeners = source.listAndClearListeners()
    assert.equal(listeners.length, 1)
    assert.equal(listeners[0], listener)
  })

  it("should not create duplicate subscriptions on idempotent subscribe", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)
    source.subscribe(listener)

    assert.equal(listener.subscriptions.length, 1)
  })

  it("should return listeners and clear on listAndClearListeners", () => {
    const source = new ChangeSource(() => {})
    const listener1 = new ChangeListener(() => {})
    const listener2 = new ChangeListener(() => {})

    source.subscribe(listener1)
    source.subscribe(listener2)

    const listeners = source.listAndClearListeners()
    assert.equal(listeners.length, 2)
    assert.ok(listeners.includes(listener1))
    assert.ok(listeners.includes(listener2))
    assert.ok(!source.hasListeners)
  })

  it("should return empty array when no listeners", () => {
    const source = new ChangeSource(() => {})

    const listeners = source.listAndClearListeners()
    assert.equal(listeners.length, 0)
  })

  it("should hold a remove callback", () => {
    let removed = false
    const source = new ChangeSource(() => {
      removed = true
    })

    source.remove()
    assert.ok(removed)
  })
})

describe("ChangeListener", () => {
  it("should track subscriptions when subscribed to a source", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)

    assert.equal(listener.subscriptions.length, 1)
    assert.equal(listener.subscriptions[0]?.source, source)
    assert.equal(listener.subscriptions[0]?.listener, listener)
  })

  it("should subscribe to multiple sources", () => {
    const source1 = new ChangeSource(() => {})
    const source2 = new ChangeSource(() => {})
    const source3 = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source1.subscribe(listener)
    source2.subscribe(listener)
    source3.subscribe(listener)

    assert.equal(listener.subscriptions.length, 3)
    assert.ok(source1.hasListeners)
    assert.ok(source2.hasListeners)
    assert.ok(source3.hasListeners)
  })

  it("should unsubscribe from all sources", () => {
    const source1 = new ChangeSource(() => {})
    const source2 = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source1.subscribe(listener)
    source2.subscribe(listener)

    listener.unsubscribe()

    assert.equal(listener.subscriptions.length, 0)
    assert.ok(!source1.hasListeners)
    assert.ok(!source2.hasListeners)
  })

  it("should start with wasNotified as false", () => {
    const listener = new ChangeListener(() => {})

    assert.equal(listener.wasNotified, false)
  })

  it("should allow wasNotified to be set", () => {
    const listener = new ChangeListener(() => {})

    listener.wasNotified = true

    assert.equal(listener.wasNotified, true)
  })

  it("should hold the callback", () => {
    const cb = () => {}
    const listener = new ChangeListener(cb)

    assert.equal(listener.callback, cb)
  })

  it("should hold an object callback with before", () => {
    const before = () => {}
    const listener = new ChangeListener({ before })

    assert.deepStrictEqual(listener.callback, { before })
  })

  it("should hold an object callback with after", () => {
    const after = () => {}
    const listener = new ChangeListener({ after })

    assert.deepStrictEqual(listener.callback, { after })
  })
})

describe("ChangeSource and ChangeListener integration", () => {
  it("should handle multiple listeners on one source", () => {
    const source = new ChangeSource(() => {})
    const listener1 = new ChangeListener(() => {})
    const listener2 = new ChangeListener(() => {})

    source.subscribe(listener1)
    source.subscribe(listener2)

    assert.ok(source.hasListeners)

    const listeners = source.listAndClearListeners()
    assert.equal(listeners.length, 2)
    // Listeners still have subscription records (pointing to now-cleared source)
    assert.equal(listener1.subscriptions.length, 1)
    assert.equal(listener2.subscriptions.length, 1)
  })

  it("should handle listener unsubscribe after listAndClearListeners", () => {
    const source = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source.subscribe(listener)
    source.listAndClearListeners()

    // Listener still has subscription record; unsubscribe is a safe no-op on the source
    listener.unsubscribe()
    assert.equal(listener.subscriptions.length, 0)
    assert.ok(!source.hasListeners)
  })

  it("should handle one listener across multiple sources with partial unsubscribe via listAndClear", () => {
    const source1 = new ChangeSource(() => {})
    const source2 = new ChangeSource(() => {})
    const listener = new ChangeListener(() => {})

    source1.subscribe(listener)
    source2.subscribe(listener)

    // Clear source1's listeners (simulating a transaction notify on source1)
    source1.listAndClearListeners()

    // listener.unsubscribe removes from all sources
    listener.unsubscribe()
    assert.ok(!source1.hasListeners)
    assert.ok(!source2.hasListeners)
    assert.equal(listener.subscriptions.length, 0)
  })
})

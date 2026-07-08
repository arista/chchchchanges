import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import type { Change } from "../src/change-types.js"

type Item = { id: number }

// Model the intended usage: an owner keeps a plain backing array (fast reads),
// mutates it directly, then announces the delta on behalf of its view.
describe("emitArrayChangeOnBehalfOf", () => {
  it("drives a mapped output when the owner mutates + announces", () => {
    const domain = new ChangeDomain()
    const backing: Item[] = [{ id: 1 }, { id: 2 }]
    const view = domain.enableChanges(backing)
    const out = domain.createMappedArray(view, (i) => i.id)
    assert.deepEqual([...out], [1, 2])

    const three = { id: 3 }
    backing.push(three)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayPush", elements: [three] })
    assert.deepEqual([...out], [1, 2, 3])

    const zero = { id: 0 }
    backing.unshift(zero)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayUnshift", elements: [zero] })
    assert.deepEqual([...out], [0, 1, 2, 3])

    // remove index 1, insert two at index 2
    const twenty = { id: 20 }
    const twentyOne = { id: 21 }
    backing.splice(2, 1, twenty, twentyOne)
    domain.emitArrayChangeOnBehalfOf(view, {
      type: "ArraySplice",
      start: 2,
      deleteCount: 1,
      items: [twenty, twentyOne],
    })
    assert.deepEqual([...out], [0, 1, 20, 21, 3])

    backing.pop()
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayPop" })
    assert.deepEqual([...out], [0, 1, 20, 21])
  })

  it("re-emits derived deltas to a subscriber of the mapped output", () => {
    const domain = new ChangeDomain()
    const backing: Item[] = [{ id: 1 }]
    const view = domain.enableChanges(backing)
    const out = domain.createMappedArray(view, (i) => i.id)

    const deltas: Change[] = []
    domain.subscribe(out, (c) => deltas.push(c))

    const two = { id: 2 }
    backing.push(two)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayPush", elements: [two] })

    backing.splice(0, 1)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArraySplice", start: 0, deleteCount: 1 })

    assert.equal(deltas.length, 2)
    assert.equal(deltas[0]!.type, "ArrayPush")
    assert.equal(deltas[1]!.type, "ArraySplice")
  })

  it("invalidates a detectChanges that iterated the mapped output", () => {
    const domain = new ChangeDomain()
    const backing: Item[] = [{ id: 1 }]
    const view = domain.enableChanges(backing)
    const out = domain.createMappedArray(view, (i) => i.id)

    let runs = 0
    domain.detectChanges(
      () => [...out],
      () => {
        runs++
      },
    )

    const two = { id: 2 }
    backing.push(two)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayPush", elements: [two] })
    assert.equal(runs, 1)
  })

  it("is a no-op on a non-change-enabled array", () => {
    const domain = new ChangeDomain()
    const plain: Item[] = [{ id: 1 }]
    // Should not throw; nothing subscribes to a plain array.
    domain.emitArrayChangeOnBehalfOf(plain, { type: "ArrayPop" })
    assert.deepEqual(
      plain.map((i) => i.id),
      [1],
    )
  })
})

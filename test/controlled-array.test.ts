import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import type { Change } from "../src/change-types.js"

type Item = { id: number }

describe("createControlledArray", () => {
  it("seeds the array from the initial contents", () => {
    const domain = new ChangeDomain()
    const { array } = domain.createControlledArray<Item>([{ id: 1 }, { id: 2 }])
    assert.deepEqual(
      [...array].map((i) => i.id),
      [1, 2],
    )
  })

  it("drives a mapped output through emit (the emitter path)", () => {
    const domain = new ChangeDomain()
    const { array, emit } = domain.createControlledArray<Item>([{ id: 1 }, { id: 2 }])
    const out = domain.createMappedArray(array, (i) => i.id)
    assert.deepEqual([...out], [1, 2])

    emit({ type: "ArrayPush", elements: [{ id: 3 }] })
    assert.deepEqual([...out], [1, 2, 3])

    emit({ type: "ArrayUnshift", elements: [{ id: 0 }] })
    assert.deepEqual([...out], [0, 1, 2, 3])

    // remove id:1 and insert id:20, id:21 at index 2
    emit({ type: "ArraySplice", start: 2, deleteCount: 1, items: [{ id: 20 }, { id: 21 }] })
    assert.deepEqual([...out], [0, 1, 20, 21, 3])

    emit({ type: "ArrayPop" })
    assert.deepEqual([...out], [0, 1, 20, 21])

    emit({ type: "ArrayShift" })
    assert.deepEqual([...out], [1, 20, 21])

    emit({ type: "ArrayReverse" })
    assert.deepEqual([...out], [21, 20, 1])
  })

  it("re-emits derived deltas to a subscriber of the mapped output", () => {
    const domain = new ChangeDomain()
    const { array, emit } = domain.createControlledArray<Item>([{ id: 1 }])
    const out = domain.createMappedArray(array, (i) => i.id)

    const deltas: Change[] = []
    domain.subscribe(out, (c) => deltas.push(c))

    emit({ type: "ArrayPush", elements: [{ id: 2 }] })
    emit({ type: "ArraySplice", start: 0, deleteCount: 1 })

    assert.equal(deltas.length, 2)
    assert.equal(deltas[0]!.type, "ArrayPush")
    assert.equal(deltas[1]!.type, "ArraySplice")
    if (deltas[0]!.type === "ArrayPush") {
      assert.deepEqual(deltas[0]!.elements, [2])
    }
  })

  it("invalidates a detectChanges that iterated the mapped output", () => {
    const domain = new ChangeDomain()
    const { array, emit } = domain.createControlledArray<Item>([{ id: 1 }])
    const out = domain.createMappedArray(array, (i) => i.id)

    let runs = 0
    domain.detectChanges(
      () => [...out],
      () => {
        runs++
      },
    )

    emit({ type: "ArrayPush", elements: [{ id: 2 }] })
    assert.equal(runs, 1)
  })

  it("keeps its own contents in sync (a mapper created after edits sees them)", () => {
    const domain = new ChangeDomain()
    const { array, emit } = domain.createControlledArray<Item>([{ id: 1 }])
    emit({ type: "ArrayPush", elements: [{ id: 2 }] })

    const out = domain.createMappedArray(array, (i) => i.id)
    assert.deepEqual([...out], [1, 2])
  })
})

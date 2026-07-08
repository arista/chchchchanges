import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import type { Change } from "../src/change-types.js"

type Item = { id: number }

describe("createMappedArray", () => {
  it("projects the initial contents", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id * 10)
    assert.deepEqual([...out], [10, 20])
  })

  it("threads push", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)
    source.push({ id: 2 }, { id: 3 })
    assert.deepEqual([...out], [1, 2, 3])
  })

  it("threads pop / shift / unshift", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)
    source.unshift({ id: 0 })
    assert.deepEqual([...out], [0, 1, 2])
    source.pop()
    assert.deepEqual([...out], [0, 1])
    source.shift()
    assert.deepEqual([...out], [1])
  })

  it("threads a middle splice (insert + remove) at the right position", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)
    // remove id:2, insert id:20, id:21 at index 1
    source.splice(1, 1, { id: 20 }, { id: 21 })
    assert.deepEqual([...out], [1, 20, 21, 3])
  })

  it("threads element assignment", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)
    source[0] = { id: 99 }
    assert.deepEqual([...out], [99, 2])
  })

  it("reuses mapped values on reverse (does not re-run fn)", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }] as Item[])
    let calls = 0
    const out = domain.createMappedArray(source, (i) => {
      calls++
      return i.id
    })
    assert.equal(calls, 3) // initial projection
    source.reverse()
    assert.deepEqual([...out], [3, 2, 1])
    assert.equal(calls, 3) // no additional fn calls for a pure reorder
  })

  it("only runs fn for newly inserted elements", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }, { id: 2 }] as Item[])
    let calls = 0
    const out = domain.createMappedArray(source, (i) => {
      calls++
      return i.id
    })
    calls = 0
    source.push({ id: 3 })
    assert.equal(calls, 1)
    assert.deepEqual([...out], [1, 2, 3])
  })

  it("falls back to full re-derivation on sort", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 3 }, { id: 1 }, { id: 2 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)
    source.sort((a, b) => a.id - b.id)
    assert.deepEqual([...out], [1, 2, 3])
  })

  it("re-emits its own deltas for a subscriber (surgical path)", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)

    const deltas: Change[] = []
    domain.subscribe(out, (c) => deltas.push(c))

    source.push({ id: 2 })
    source.splice(0, 1)

    assert.equal(deltas.length, 2)
    assert.equal(deltas[0]!.type, "ArrayPush")
    assert.equal(deltas[1]!.type, "ArraySplice")
    if (deltas[0]!.type === "ArrayPush") {
      assert.deepEqual(deltas[0]!.elements, [2])
    }
  })

  it("invalidates a detectChanges that iterated the output", () => {
    const domain = new ChangeDomain()
    const source = domain.enableChanges([{ id: 1 }] as Item[])
    const out = domain.createMappedArray(source, (i) => i.id)

    let seen: number[] = []
    let runs = 0
    const detecting = domain.detectChanges(
      () => [...out],
      () => {
        runs++
      },
    )
    seen = detecting.result
    assert.deepEqual(seen, [1])

    source.push({ id: 2 })
    assert.equal(runs, 1) // iteration established a dependency; mutation fired it
  })
})

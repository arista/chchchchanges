import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { ChangeDomain } from "../src/change-domain.js"
import { applyArrayMove } from "../src/array-move.js"
import type { Change } from "../src/change-types.js"

type Item = { id: number }

const ids = (arr: Item[]) => arr.map((i) => i.id)

describe("applyArrayMove", () => {
  it("moves an element to the right (to = post-removal index)", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] as Item[])
    applyArrayMove(domain, arr, 0, 2)
    assert.deepEqual(ids([...arr]), [2, 3, 1, 4])
  })

  it("moves an element to the left", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] as Item[])
    applyArrayMove(domain, arr, 3, 1)
    assert.deepEqual(ids([...arr]), [1, 4, 2, 3])
  })

  it("emits exactly one ArrayMove delta", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }] as Item[])
    const deltas: Change[] = []
    domain.subscribe(arr, (c) => deltas.push(c))

    applyArrayMove(domain, arr, 2, 0)

    assert.equal(deltas.length, 1)
    assert.equal(deltas[0]!.type, "ArrayMove")
    if (deltas[0]!.type === "ArrayMove") {
      assert.equal(deltas[0]!.from, 2)
      assert.equal(deltas[0]!.to, 0)
    }
  })

  it("preserves element identity across the move", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }] as Item[])
    const first = arr[0]
    applyArrayMove(domain, arr, 0, 2)
    assert.equal(arr[2], first) // same reference relocated, not a copy
  })

  it("is a no-op when from === to (no delta)", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }] as Item[])
    const deltas: Change[] = []
    domain.subscribe(arr, (c) => deltas.push(c))
    applyArrayMove(domain, arr, 1, 1)
    assert.equal(deltas.length, 0)
    assert.deepEqual(ids([...arr]), [1, 2])
  })

  it("invalidates a detectChanges that iterated the array", () => {
    const domain = new ChangeDomain()
    const arr = domain.enableChanges([{ id: 1 }, { id: 2 }, { id: 3 }] as Item[])
    let runs = 0
    domain.detectChanges(
      () => ids([...arr]),
      () => {
        runs++
      },
    )
    applyArrayMove(domain, arr, 0, 2)
    assert.equal(runs, 1)
  })

  it("falls back to a plain move on a non-change-enabled array", () => {
    const domain = new ChangeDomain()
    const arr: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }]
    applyArrayMove(domain, arr, 0, 2)
    assert.deepEqual(ids(arr), [2, 3, 1])
  })
})

describe("move through an owner-driven view + mapped array", () => {
  it("relays a move end to end as a single delta, without re-running fn", () => {
    const domain = new ChangeDomain()
    const backing: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const view = domain.enableChanges(backing)

    let calls = 0
    const out = domain.createMappedArray(view, (i) => {
      calls++
      return { label: `#${i.id}` }
    })
    assert.equal(calls, 4) // initial projection only
    const mappedFirst = out[0]

    const deltas: Change[] = []
    domain.subscribe(out, (c) => deltas.push(c))

    // Owner moves the item in its backing, then announces a single move.
    const [x] = backing.splice(0, 1)
    backing.splice(2, 0, x)
    domain.emitArrayChangeOnBehalfOf(view, { type: "ArrayMove", from: 0, to: 2 })

    // Output contents moved to match.
    assert.deepEqual(
      out.map((m) => m.label),
      ["#2", "#3", "#1", "#4"],
    )
    // fn was not re-run for the move...
    assert.equal(calls, 4)
    // ...and the mapped value kept its identity, relocated to the new index.
    assert.equal(out[2], mappedFirst)
    // Downstream saw a single ArrayMove, not remove+insert.
    assert.equal(deltas.length, 1)
    assert.equal(deltas[0]!.type, "ArrayMove")
    if (deltas[0]!.type === "ArrayMove") {
      assert.equal(deltas[0]!.from, 0)
      assert.equal(deltas[0]!.to, 2)
    }
  })
})

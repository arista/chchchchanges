import type { ChangeDomain } from "./change-domain.js"
import { getProxyState } from "./change-proxy.js"

/**
 * Move the element at `from` to `to` on a change-enabled array, delivering a
 * single ArrayMove delta to the array's subscribers.
 *
 * `to` is the index AFTER the element is removed from `from` (splice semantics).
 * The element keeps its identity — it is relocated, not recreated — which is
 * what lets downstream consumers (mapped arrays, renderers) preserve the
 * element's derived value and its DOM across the move.
 *
 * The relocation runs through the array's own splice traps so the backing
 * contents and any detectChanges dependents that iterated the array stay
 * correct; the two ArraySplice subscription deltas those splices would emit are
 * suppressed and replaced by one ArrayMove.
 */
export function applyArrayMove(
  domain: ChangeDomain,
  array: unknown[],
  from: number,
  to: number,
): void {
  if (from === to) return

  const state = getProxyState(array)
  if (!state) {
    // Not change-enabled: nothing to notify, just move the contents.
    const [x] = array.splice(from, 1)
    array.splice(to, 0, x)
    return
  }

  domain.withTransaction((t) => {
    t.withSuppressedObjectChanges(state, () => {
      const [x] = array.splice(from, 1)
      array.splice(to, 0, x)
    })
    t.notifySubscription(state, { type: "ArrayMove", target: array, from, to })
  })
}

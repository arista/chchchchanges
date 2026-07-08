import type { ChangeDomain } from "./change-domain.js"
import { getProxyState } from "./change-proxy.js"
import { emitArrayChangeOnBehalfOf } from "./emit-array-change.js"

/**
 * Move the element at `from` to `to` on a change-enabled array, delivering a
 * single ArrayMove delta to the array's subscribers.
 *
 * `to` is the index AFTER the element is removed from `from` (splice semantics).
 * The element keeps its identity — it is relocated, not recreated — which is
 * what lets downstream consumers (mapped arrays, renderers) preserve the
 * element's derived value and its DOM across the move.
 *
 * The relocation is applied to the array's backing directly (reusing the
 * existing element, so no new wrapping), then announced as one ArrayMove via
 * emitArrayChangeOnBehalfOf — which also invalidates detectChanges dependents.
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

  const backing = state.target as unknown[]
  const [x] = backing.splice(from, 1)
  backing.splice(to, 0, x)
  emitArrayChangeOnBehalfOf(domain, array, { type: "ArrayMove", from, to })
}

import type { ChangeDomain } from "./change-domain.js"
import { getProxyState } from "./change-proxy.js"
import type { ArrayChangeSources } from "./array-handler.js"
import type {
  ArrayPush,
  ArrayPop,
  ArrayShift,
  ArrayUnshift,
  ArraySplice,
  ArrayReverse,
  ArrayMove,
  Change,
} from "./change-types.js"

/**
 * A structural array change without its `target` — the emitting function
 * supplies the array's identity.
 */
type WithoutTarget<C> = C extends unknown ? Omit<C, "target"> : never

export type ArrayEdit = WithoutTarget<
  ArrayPush | ArrayPop | ArrayShift | ArrayUnshift | ArraySplice | ArrayReverse | ArrayMove
>

/**
 * Emit a change event on behalf of `array`. The array did NOT change itself —
 * the caller has already applied `edit` to the array's backing directly (e.g.
 * an owner that keeps a plain array for fast reads and mutates it in place).
 * This only announces what happened: it fires the array's change source (so
 * detectChanges/iteration dependents invalidate) and delivers the delta to the
 * array's subscribers. It performs no mutation.
 *
 * `array` must be the change-enabled view of the backing (from enableChanges);
 * a non-change-enabled array has no subscribers and is a no-op.
 */
export function emitArrayChangeOnBehalfOf(
  domain: ChangeDomain,
  array: readonly unknown[],
  edit: ArrayEdit,
): void {
  const state = getProxyState(array)
  if (!state) return

  const change = { ...edit, target: array as unknown[] } as Change
  domain.withTransaction((t) => {
    const cs = state.changeSources as ArrayChangeSources | null
    t.notify(cs?.array ?? null)
    t.notifySubscription(state, change)
  })
}

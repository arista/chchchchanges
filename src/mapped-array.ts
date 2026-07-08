import type { ChangeDomain } from "./change-domain.js"
import type { Change, SubscriptionListener } from "./change-types.js"

/**
 * Create a derived array that stays in sync with `source` by applying `fn` to
 * each element. The result is a change-enabled array: structural mutations of
 * `source` (push/splice/etc.) are threaded through `fn` and replayed onto the
 * output in place, so the output re-emits its own fine-grained deltas to any
 * subscriber (e.g. a renderer doing surgical list updates).
 *
 * `fn` is only re-run for elements that are newly inserted or replaced. It is
 * NOT re-run when an existing element's own fields change — that reactivity is
 * expected to flow through the mapped value itself (map to an object that reads
 * the source item live, rather than to a snapshot). Because of this, `fn`
 * should be a structural/wrapping projection, not a deep copy.
 *
 * Value-dependent bulk operations that carry no positional information
 * (`sort`, `fill`, `copyWithin`) fall back to a full re-derivation.
 *
 * The output stays subscribed to `source` for its lifetime; scope it to the
 * lifetime of whatever owns it. (Ref-counted teardown is a future addition.)
 */
export function createMappedArray<T, U>(
  domain: ChangeDomain,
  source: T[],
  fn: (item: T) => U,
): U[] {
  const out = domain.enableChanges(source.map(fn))

  const mapItems = (items: readonly unknown[]): U[] => items.map((x) => fn(x as T))

  // Replace the entire contents in a single splice (one delta downstream).
  const rederive = (): void => {
    out.splice(0, out.length, ...source.map(fn))
  }

  // Applied in the subscription `before` phase (which runs synchronously inside
  // the source's transaction body) rather than as a plain after-callback. This
  // matters: mutating `out` enqueues `out`'s own notifications for downstream
  // detectChanges listeners. After-callbacks run in a later drain loop of
  // `complete()`, so notifications they enqueue would be stranded; running in
  // `before` keeps them inside the transaction's normal drain window.
  const apply = (change: Change): void => {
    switch (change.type) {
      case "ArrayPush":
        out.push(...mapItems(change.elements))
        break

      case "ArrayPop":
        out.pop()
        break

      case "ArrayShift":
        out.shift()
        break

      case "ArrayUnshift":
        out.unshift(...mapItems(change.elements))
        break

      case "ArraySplice":
        out.splice(change.start, change.deleteCount, ...mapItems(change.items ?? []))
        break

      case "ArrayReverse":
        // Reordering only — reuse the already-mapped values, don't re-run fn.
        out.reverse()
        break

      case "ObjectSet": {
        // Element assignment `source[i] = x`. Ignore non-index props (e.g. the
        // `length` set emitted by a manual truncation — handled via rederive on
        // the fallback path if it ever matters).
        const idx = typeof change.prop === "number" ? change.prop : Number(change.prop)
        if (Number.isInteger(idx) && idx >= 0) {
          out[idx] = fn(change.value as T)
        }
        break
      }

      // No positional mapping possible from the delta alone.
      case "ArraySort":
      case "ArrayFill":
      case "ArrayCopyWithin":
      default:
        rederive()
        break
    }
  }

  const listener: SubscriptionListener = { before: apply }
  domain.subscribe(source, listener)

  return out
}

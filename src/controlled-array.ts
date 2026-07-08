import type { ChangeDomain } from "./change-domain.js"
import type {
  ArrayPush,
  ArrayPop,
  ArrayShift,
  ArrayUnshift,
  ArraySplice,
  ArrayReverse,
} from "./change-types.js"

/**
 * An edit driven onto a controlled array by its owner. Mirrors the array
 * `Change` vocabulary but without the `target` field — the controlled array
 * supplies its own identity when it emits.
 */
type WithoutTarget<C> = C extends unknown ? Omit<C, "target"> : never

export type ControlledArrayEdit = WithoutTarget<
  ArrayPush | ArrayPop | ArrayShift | ArrayUnshift | ArraySplice | ArrayReverse
>

export interface ControlledArray<T> {
  /**
   * The change-enabled array. Hand this to a consumer (e.g. createMappedArray
   * or a renderer): it behaves like any other subscribable change-enabled
   * array. Do not mutate it directly — drive all changes through `emit` so the
   * owner remains the single source of structural truth.
   */
  readonly array: T[]

  /**
   * Apply an edit to the array and deliver the corresponding delta to the
   * array's subscribers. The owner (which knows exactly what structural
   * operation occurred) calls this instead of relying on a proxy to infer the
   * change from raw mutations.
   */
  emit(edit: ControlledArrayEdit): void
}

/**
 * Create an array whose structural changes are driven explicitly by its owner
 * rather than inferred from JS array mutations. The owner holds `emit` and is
 * the authority on what operations take place; consumers just subscribe to
 * `array` as they would to any change-enabled array.
 *
 * Slice one supports the standard array operations by applying them to the
 * underlying change-enabled array, which already emits the matching deltas. Its
 * value over a plain change-enabled array arrives with operations a proxy
 * cannot infer from raw mutations (e.g. a semantic move), which a later slice
 * adds here.
 */
export function createControlledArray<T>(
  domain: ChangeDomain,
  initial: readonly T[] = [],
): ControlledArray<T> {
  const array = domain.enableChanges([...initial])

  const emit = (edit: ControlledArrayEdit): void => {
    switch (edit.type) {
      case "ArrayPush":
        array.push(...(edit.elements as T[]))
        break
      case "ArrayPop":
        array.pop()
        break
      case "ArrayShift":
        array.shift()
        break
      case "ArrayUnshift":
        array.unshift(...(edit.elements as T[]))
        break
      case "ArraySplice":
        array.splice(edit.start, edit.deleteCount, ...((edit.items ?? []) as T[]))
        break
      case "ArrayReverse":
        array.reverse()
        break
    }
  }

  return { array, emit }
}

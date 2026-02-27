// Object changes
export interface ObjectSetPrototypeOf {
  type: "ObjectSetPrototypeOf"
  target: object
  prototype: object | null
}

export interface ObjectPreventExtensions {
  type: "ObjectPreventExtensions"
  target: object
}

export interface ObjectDefineProperty {
  type: "ObjectDefineProperty"
  target: object
  key: PropertyKey
  descriptor: PropertyDescriptor
}

export interface ObjectDeleteProperty {
  type: "ObjectDeleteProperty"
  target: object
  prop: PropertyKey
}

export interface ObjectSet {
  type: "ObjectSet"
  target: object
  prop: PropertyKey
  value: unknown
}

// Array changes
export interface ArrayFill {
  type: "ArrayFill"
  target: unknown[]
  value: unknown
  start: number
  end: number
}

export interface ArrayCopyWithin {
  type: "ArrayCopyWithin"
  target: unknown[]
  dest: number
  start: number
  end: number
}

export interface ArrayPop {
  type: "ArrayPop"
  target: unknown[]
}

export interface ArrayPush {
  type: "ArrayPush"
  target: unknown[]
  elements: unknown[]
}

export interface ArrayReverse {
  type: "ArrayReverse"
  target: unknown[]
}

export interface ArraySort {
  type: "ArraySort"
  target: unknown[]
}

export interface ArrayShift {
  type: "ArrayShift"
  target: unknown[]
}

export interface ArraySplice {
  type: "ArraySplice"
  target: unknown[]
  start: number
  deleteCount: number
  items?: unknown[]
}

export interface ArrayUnshift {
  type: "ArrayUnshift"
  target: unknown[]
  elements: unknown[]
}

// Map changes
export interface MapClear {
  type: "MapClear"
  target: Map<unknown, unknown>
}

export interface MapDelete {
  type: "MapDelete"
  target: Map<unknown, unknown>
  key: unknown
}

export interface MapSet {
  type: "MapSet"
  target: Map<unknown, unknown>
  key: unknown
  value: unknown
}

// Set changes
export interface SetClear {
  type: "SetClear"
  target: Set<unknown>
}

export interface SetDelete {
  type: "SetDelete"
  target: Set<unknown>
  value: unknown
}

export interface SetAdd {
  type: "SetAdd"
  target: Set<unknown>
  value: unknown
}

// Union of all change types
export type Change =
  | ObjectSetPrototypeOf
  | ObjectPreventExtensions
  | ObjectDefineProperty
  | ObjectDeleteProperty
  | ObjectSet
  | ArrayFill
  | ArrayCopyWithin
  | ArrayPop
  | ArrayPush
  | ArrayReverse
  | ArraySort
  | ArrayShift
  | ArraySplice
  | ArrayUnshift
  | MapClear
  | MapDelete
  | MapSet
  | SetClear
  | SetDelete
  | SetAdd

// Subscription listener types
export type AfterSubscriptionCallback = (change: Change) => void
export type BeforeSubscriptionCallback = (change: Change) => void | AfterSubscriptionCallback

export type SubscriptionListener =
  | AfterSubscriptionCallback
  | { before: BeforeSubscriptionCallback }
  | { after: AfterSubscriptionCallback }

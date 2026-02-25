export type AfterChangeCallback = () => void
export type BeforeChangeCallback = () => AfterChangeCallback | void
export type ChangeCallback =
  | AfterChangeCallback
  | { before: BeforeChangeCallback }
  | { after: AfterChangeCallback }

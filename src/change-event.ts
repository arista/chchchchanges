// Configuration for creating a ChangeDomain
export interface ChangesConfig {
  name?: string
  logger?: ChangeEventLogger
}

// Logger function type
export type ChangeEventLogger = (event: ChangeEvent) => void

// All debug event types
export type ChangeEvent =
  | TransactionStarted
  | TransactionEnded
  | ChangeNotified
  | DetectChangesEntered
  | DetectChangesExited
  | DetectChangesSuspended
  | DetectChangesResumed
  | ChangeSourceReferenced

export interface TransactionStarted {
  type: "TransactionStarted"
  domain: string
  transaction: number
}

export interface TransactionEnded {
  type: "TransactionEnded"
  domain: string
  transaction: number
}

export interface ChangeNotified {
  type: "ChangeNotified"
  domain: string
  transaction: number
  source: string
  phase: "before" | "after"
  detectChanges: string
}

export interface DetectChangesEntered {
  type: "DetectChangesEntered"
  domain: string
  detectChanges: string
}

export interface DetectChangesExited {
  type: "DetectChangesExited"
  domain: string
  detectChanges: string
}

export interface DetectChangesSuspended {
  type: "DetectChangesSuspended"
  domain: string
  detectChanges: string
}

export interface DetectChangesResumed {
  type: "DetectChangesResumed"
  domain: string
  detectChanges: string
}

export interface ChangeSourceReferenced {
  type: "ChangeSourceReferenced"
  domain: string
  source: string
  detectChanges: string
}

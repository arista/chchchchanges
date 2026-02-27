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
  | BeforeChangeNotified
  | AfterChangeNotified
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

export interface BeforeChangeNotified {
  type: "BeforeChangeNotified"
  domain: string
  transaction: number
  source: string
  detectChanges: string
}

export interface AfterChangeNotified {
  type: "AfterChangeNotified"
  domain: string
  transaction: number
  source: string
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

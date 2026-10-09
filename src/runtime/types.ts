export type RuntimeEventLevel = 'INFO' | 'WARN' | 'ERROR'
export type RuntimeEventCategory = 'SYSTEM' | 'QUEUE' | 'SCHEDULER' | 'REVIEW' | 'ADAPTER'

export interface RuntimeEvent {
  id: string
  level: RuntimeEventLevel
  category: RuntimeEventCategory
  message: string
  detail?: string
  createdAt: number
}

export interface RuntimeEventCursor {
  createdAt: number
  id: string
}

export interface RuntimeLock {
  key: string
  owner: string
  expiresAt: number
  updatedAt: number
}

export interface BoundAccountContext {
  key: string
  label: string
  profileUrl?: string
}

export interface ReviewSchedule {
  id: string
  name: string
  enabled: boolean
  intervalMinutes: number
  maxPosts: number
  startHour: number
  endHour: number
  accountBinding?: BoundAccountContext
  nextRunAt: number
  lastRunAt?: number
  createdAt: number
  definitionRevision: number
  definitionUpdatedAt: number
  runtimeUpdatedAt: number
  updatedAt: number
}

export interface ReviewScheduleInput {
  id?: string
  name: string
  enabled: boolean
  intervalMinutes: number
  maxPosts: number
  startHour: number
  endHour: number
  accountBinding?: BoundAccountContext
}

export interface ScheduleTombstone {
  id: string
  baseRevision: number
  deletedAt: number
}

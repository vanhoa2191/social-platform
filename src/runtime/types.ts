export type RuntimeEventLevel = 'INFO' | 'WARN' | 'ERROR'
export type RuntimeEventCategory = 'SYSTEM' | 'QUEUE' | 'SCHEDULER' | 'REVIEW'

export interface RuntimeEvent {
  id: string
  level: RuntimeEventLevel
  category: RuntimeEventCategory
  message: string
  detail?: string
  createdAt: number
}

export interface RuntimeLock {
  key: string
  owner: string
  expiresAt: number
  updatedAt: number
}

export interface ReviewSchedule {
  id: string
  name: string
  enabled: boolean
  intervalMinutes: number
  maxPosts: number
  startHour: number
  endHour: number
  nextRunAt: number
  lastRunAt?: number
  createdAt: number
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
}

import type { User } from '@/types/user'
import type { Status } from '@/types/status'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export const DEFAULT_LOCAL_LABELS = [
  'bug',
  'enhancement',
  'feature',
  'design',
  'chore'
] as const

export type LocalTaskLabel = (typeof DEFAULT_LOCAL_LABELS)[number]

export interface Task {
  id: string
  created?: string
  updated?: string
  number?: number
  title: string
  slug?: string
  description?: string
  priority?: TaskPriority | null
  status?: string | null
  project: string
  user: string
  assigned?: string | null
  url?: string | null
  labels?: string[]
  expand?: {
    assigned?: User
    user?: User
    status?: Status
  }
}

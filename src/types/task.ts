import type { User } from '@/types/user'
import type { Status } from '@/types/status'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  created?: string
  updated?: string
  number?: number
  title: string
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

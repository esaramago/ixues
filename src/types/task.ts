import type { User } from '@/types/user'
import type { Status } from '@/types/status'
import { getDeterministicColor } from '@/lib/colors'

export const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export type PriorityVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface PriorityOption {
  value: TaskPriority
  label: string
  icon: string
  variant: PriorityVariant
}

export const PRIORITY_OPTIONS: readonly PriorityOption[] = [
  { value: 'lowest', label: 'Lowest', icon: 'angles-down', variant: 'neutral' },
  { value: 'low', label: 'Low', icon: 'angle-down', variant: 'success' },
  { value: 'medium', label: 'Medium', icon: 'equals', variant: 'brand' },
  { value: 'high', label: 'High', icon: 'angle-up', variant: 'warning' },
  { value: 'urgent', label: 'Urgent', icon: 'angles-up', variant: 'danger' }
] as const

export function getPriorityIcon(priority?: TaskPriority | string | null): string | undefined {
  switch (priority) {
    case 'urgent':
      return 'angles-up'
    case 'high':
      return 'angle-up'
    case 'medium':
      return 'equals'
    case 'low':
      return 'angle-down'
    case 'lowest':
      return 'angles-down'
    default:
      return undefined
  }
}

export function getPriorityVariant(
  priority?: TaskPriority | string | null
): PriorityVariant {
  switch (priority) {
    case 'urgent':
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
    case 'lowest':
      return 'success'
    default:
      return 'neutral'
  }
}

export const DEFAULT_LOCAL_LABELS = [
  'bug',
  'enhancement',
  'feature',
  'design',
  'chore'
] as const

export type LocalTaskLabel = (typeof DEFAULT_LOCAL_LABELS)[number]

export interface TaskLabel {
  name: string
  color?: string
}

export type TaskLabelItem = string | TaskLabel

export function getLabelInfo(label: TaskLabelItem): TaskLabel {
  if (typeof label === 'string') {
    return {
      name: label,
      color: getDeterministicColor(label)
    }
  }
  return {
    name: label.name,
    color: label.color || getDeterministicColor(label.name)
  }
}

export type RelationshipType = 'relates_to' | 'blocked_by' | 'blocks' | 'duplicate_of'

export interface TaskRelationship {
  type: RelationshipType
  taskId: string
  taskNumber?: number
  taskTitle?: string
}

export interface TaskBranch {
  name: string
  url?: string
}

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'relates_to', label: 'Relates to' },
  { value: 'blocked_by', label: 'Blocked by' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'duplicate_of', label: 'Duplicate of' }
]

export function getRelationshipLabel(type: RelationshipType): string {
  switch (type) {
    case 'relates_to':
      return 'Relates to'
    case 'blocked_by':
      return 'Blocked by'
    case 'blocks':
      return 'Blocks'
    case 'duplicate_of':
      return 'Duplicate of'
    default:
      return type
  }
}

export function isTaskAssignedToUser(task: Task, user?: User | null): boolean {
  if (!user) return false

  const targetId = user.id?.toLowerCase()
  const targetEmail = user.email?.toLowerCase()
  const targetName = user.name?.toLowerCase()
  const targetUsername = user.username?.toLowerCase()

  if (task.assigned) {
    const assigned = task.assigned.toLowerCase()
    if (
      assigned === targetId ||
      (targetEmail && assigned === targetEmail) ||
      (targetName && assigned === targetName) ||
      (targetUsername && assigned === targetUsername)
    ) {
      return true
    }
  }

  if (task.expand?.assigned) {
    const a = task.expand.assigned
    const aId = a.id?.toLowerCase()
    const aEmail = a.email?.toLowerCase()
    const aName = a.name?.toLowerCase()
    const aUsername = a.username?.toLowerCase()

    if (
      (targetId && aId === targetId) ||
      (targetEmail && aEmail === targetEmail) ||
      (targetName && aName === targetName) ||
      (targetUsername && (aUsername === targetUsername || aName === targetUsername)) ||
      (targetName && aUsername === targetName)
    ) {
      return true
    }
  }

  return false
}

export interface Task {
  id: string
  created?: string
  updated?: string
  order?: number
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
  labels?: TaskLabelItem[]
  relationships?: TaskRelationship[]
  branches?: TaskBranch[]
  expand?: {
    assigned?: User
    user?: User
    status?: Status
  }
}

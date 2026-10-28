import type { TaskPriority, TaskRelationship } from '@/types/task'

export interface ParsedTaskFormData {
  title: string
  description: string
  priority: TaskPriority
  status: string
  assigned: string
  labels: string[]
  relationships: TaskRelationship[]
}

const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export function parseTaskFormData(data: FormData): ParsedTaskFormData {
  const title = (data.get('title') as string)?.trim() || ''
  const description = (data.get('description') as string)?.trim() || ''
  const rawPriority = ((data.get('priority') as string)?.trim() || 'medium') as TaskPriority
  const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'medium'
  const status = (data.get('status') as string)?.trim() || ''
  const assigned = (data.get('assigned') as string)?.trim() || ''

  const rawLabels = data.getAll('labels')
  const labels = Array.from(
    new Set(
      rawLabels
        .flatMap((item) => {
          if (typeof item === 'string') {
            try {
              const parsed = JSON.parse(item)
              if (Array.isArray(parsed)) return parsed.map(String)
            } catch {}
            return [item]
          }
          return []
        })
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )

  const rawRelationships = data.get('relationships') as string
  let relationships: TaskRelationship[] = []
  if (rawRelationships) {
    try {
      const parsed = JSON.parse(rawRelationships)
      if (Array.isArray(parsed)) {
        relationships = parsed
          .map((item) => ({
            type: item.type || 'relates_to',
            taskId: String(item.taskId || item.id || '').trim(),
            taskNumber: item.taskNumber ? Number(item.taskNumber) : undefined,
            taskTitle: item.taskTitle ? String(item.taskTitle).trim() : undefined
          }))
          .filter((item) => item.taskId)
      }
    } catch (err) {
      console.error('Failed to parse relationships:', err)
    }
  }

  return {
    title,
    description,
    priority,
    status,
    assigned,
    labels,
    relationships
  }
}

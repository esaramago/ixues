export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
	id: string
	created?: string
	updated?: string
	title: string
	description?: string
	priority?: TaskPriority | null
	status?: string | null
	project: string
	user: string
}

export interface Project {
	id: string
	created?: string
	updated?: string
	name: string
	slug?: string
	type: 'local' | 'sync'
	provider?: string | null
	repo_url?: string | null
	token?: string | null
	has_token?: boolean
	user: string
}

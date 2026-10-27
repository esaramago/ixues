import { error, redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Project } from '@/types/project'

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login')
	}

	try {
		const project = await locals.pb.collection('projects').getOne(params.projectId)
		return {
			project: structuredClone(project) as unknown as Project
		}
	} catch {
		throw error(404, 'Project not found')
	}
}

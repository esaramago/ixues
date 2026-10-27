import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login')
	}
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(303, '/login')
		}

		const data = await request.formData()
		const name = (data.get('name') as string)?.trim()
		const type = ((data.get('type') as string)?.trim() || 'local') as 'local' | 'sync'
		const provider = (data.get('provider') as string)?.trim() || ''
		const repoUrl = (data.get('repoUrl') as string)?.trim() || ''

		if (!name) {
			return fail(400, {
				error: 'Project name is required.',
				name,
				type,
				provider,
				repoUrl
			})
		}

		if (type === 'sync') {
			if (!provider) {
				return fail(400, {
					error: 'Provider is required for synchronized projects.',
					name,
					type,
					provider,
					repoUrl
				})
			}

			if (!repoUrl) {
				return fail(400, {
					error: 'Repository URL is required for synchronized projects.',
					name,
					type,
					provider,
					repoUrl
				})
			}

			try {
				new URL(repoUrl)
			} catch {
				return fail(400, {
					error: 'Please enter a valid URL.',
					name,
					type,
					provider,
					repoUrl
				})
			}
		}

		try {
			await locals.pb.collection('projects').create({
				name,
				type,
				provider: type === 'sync' ? provider : null,
				repo_url: type === 'sync' ? repoUrl : null,
				user: locals.user.id
			})
		} catch (err: unknown) {
			const error = err as { status?: number; data?: { message?: string }; message?: string }
			return fail(error?.status || 500, {
				error: error?.data?.message || error?.message || 'Failed to create project.',
				name,
				type,
				provider,
				repoUrl
			})
		}

		throw redirect(303, '/')
	}
}

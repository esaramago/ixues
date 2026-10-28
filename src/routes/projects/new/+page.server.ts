import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { fetchProviderProjectDescription } from '@/lib/providers'
import { encryptToken } from '@/lib/server/crypto'
import { generateProjectSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login')
	}

	return {
		title: 'New project · Ixues'
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
		const token = (data.get('token') as string)?.trim() || ''
		const onlyMyTasks = data.get('onlyMyTasks') === 'true' || data.get('onlyMyTasks') === 'on'

		if (!name) {
			return fail(400, {
				error: 'Project name is required.',
				name,
				type,
				provider,
				repoUrl,
				token,
				onlyMyTasks
			})
		}

		if (type === 'sync') {
			if (!provider) {
				return fail(400, {
					error: 'Provider is required for synchronized projects.',
					name,
					type,
					provider,
					repoUrl,
					token,
					onlyMyTasks
				})
			}

			if (!repoUrl) {
				return fail(400, {
					error: 'Repository URL is required for synchronized projects.',
					name,
					type,
					provider,
					repoUrl,
					token,
					onlyMyTasks
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
					repoUrl,
					token,
					onlyMyTasks
				})
			}
		}

		try {
			let description: string | null = null
			if (type === 'sync') {
				try {
					description = await fetchProviderProjectDescription(
						{ name, type, provider, repo_url: repoUrl, user: locals.user.id } as Project,
						token,
						locals.user.email
					)
				} catch (descErr) {
					console.error('Failed to fetch project description:', descErr)
				}
			}

			const slug = await generateProjectSlug(locals.pb, name)
			await locals.pb.collection('projects').create({
				name,
				slug,
				description: description || '',
				type,
				provider: type === 'sync' ? provider : null,
				repo_url: type === 'sync' ? repoUrl : null,
				token: type === 'sync' && token ? encryptToken(token) : null,
				only_my_tasks: onlyMyTasks,
				user: locals.user.id
			})
		} catch (err: unknown) {
			const error = err as { status?: number; data?: { message?: string }; message?: string }
			return fail(error?.status || 500, {
				error: error?.data?.message || error?.message || 'Failed to create project.',
				name,
				type,
				provider,
				repoUrl,
				token,
				onlyMyTasks
			})
		}

		throw redirect(303, '/')
	}
}

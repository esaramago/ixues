import crypto from 'node:crypto'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { fetchProviderProjectDescription, validateProviderRepoUrl } from '@/lib/providers'
import { encryptToken } from '@/lib/server/crypto'
import { getDecryptedUserToken, getUserTokens, resolveProjectToken } from '@/lib/server/tokens'
import { generateProjectSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login')
	}

	const userTokens = await getUserTokens(locals.pb, locals.user.id)

	return {
		title: 'New project · Ixues',
		userTokens
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
		const tokenSource = (data.get('tokenSource') as string)?.trim() || 'custom'
		const userTokenId = (data.get('userTokenId') as string)?.trim() || null
		const onlyMyTasks = data.get('onlyMyTasks') === 'true' || data.get('onlyMyTasks') === 'on'
		const privacy: 'private' | 'public' = (data.get('privacy') as string)?.trim() === 'public' ? 'public' : 'private'

		if (!name) {
			return fail(400, {
				error: 'Project name is required.',
				name,
				type,
				provider,
				repoUrl,
				token,
				onlyMyTasks,
				privacy
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
					onlyMyTasks,
					privacy
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
					onlyMyTasks,
					privacy
				})
			}

			const repoUrlError = validateProviderRepoUrl(provider, repoUrl)
			if (repoUrlError) {
				return fail(400, {
					error: repoUrlError,
					name,
					type,
					provider,
					repoUrl,
					token,
					onlyMyTasks,
					privacy
				})
			}
		}

		try {
			let description: string | null = null
			if (type === 'sync') {
				try {
					let effectiveToken = ''
					if (tokenSource === 'custom' && token) {
						effectiveToken = token
					} else if (tokenSource === 'user' && userTokenId) {
						effectiveToken = await resolveProjectToken(locals.pb, {
							type: 'sync',
							provider,
							user_token: userTokenId,
							token: null,
							user: locals.user.id
						})
					} else {
						effectiveToken =
							token || (await getDecryptedUserToken(locals.pb, locals.user.id, provider))
					}

					description = await fetchProviderProjectDescription(
						{ name, type, provider, repo_url: repoUrl, user: locals.user.id } as Project,
						effectiveToken,
						locals.user.email
					)
				} catch (descErr) {
					console.error('Failed to fetch project description:', descErr)
				}
			}

			const slug = await generateProjectSlug(locals.pb, name)
			const shareToken = privacy === 'public' ? crypto.randomBytes(16).toString('hex') : null

			await locals.pb.collection('projects').create({
				name,
				slug,
				description: description || '',
				type,
				provider: type === 'sync' ? provider : null,
				repo_url: type === 'sync' ? repoUrl : null,
				token: type === 'sync' && tokenSource === 'custom' && token ? encryptToken(token) : null,
				user_token: type === 'sync' && tokenSource === 'user' ? userTokenId : null,
				only_my_tasks: onlyMyTasks,
				privacy,
				share_token: shareToken,
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
				onlyMyTasks,
				privacy
			})
		}

		throw redirect(303, '/')
	}
}

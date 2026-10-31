import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { ProviderType } from '@/types/token'
import { deleteUserToken, getUserTokens, saveUserToken } from '@/lib/server/tokens'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  const tokens = await getUserTokens(locals.pb, locals.user.id)

  return {
    tokens,
    title: 'Access Tokens - Ixues'
  }
}

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    const data = await request.formData()
    const provider = ((data.get('provider') as string)?.trim().toLowerCase() || '') as ProviderType
    const name = (data.get('name') as string)?.trim() || ''
    const token = (data.get('token') as string)?.trim() || ''

    if (!provider || (provider !== 'github' && provider !== 'jira')) {
      return fail(400, {
        error: 'Please select a valid provider (GitHub or Jira).',
        provider,
        name
      })
    }

    if (!token) {
      return fail(400, {
        error: 'Token value is required.',
        provider,
        name
      })
    }

    try {
      await saveUserToken(locals.pb, locals.user.id, provider, token, name)
      return { success: true }
    } catch (err: unknown) {
      const error = err as { message?: string }
      return fail(500, {
        error: error?.message || 'Failed to save access token.',
        provider,
        name
      })
    }
  },

  delete: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    const data = await request.formData()
    const tokenId = (data.get('tokenId') as string)?.trim()

    if (!tokenId) {
      return fail(400, { error: 'Token ID is required.' })
    }

    try {
      await deleteUserToken(locals.pb, tokenId, locals.user.id)
      return { success: true }
    } catch (err: unknown) {
      const error = err as { message?: string }
      return fail(500, {
        error: error?.message || 'Failed to delete access token.'
      })
    }
  }
}

import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { encryptToken, sanitizeProject } from '@/lib/server/crypto'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await locals.pb.collection('projects').getOne(params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (project.user !== locals.user.id) {
      throw error(403, 'Forbidden')
    }

    return {
      project: sanitizeProject(project)
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw error(404, 'Project not found')
  }
}

export const actions: Actions = {
  update: async ({ params, request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    let project: Project
    try {
      const projectRecord = await locals.pb.collection('projects').getOne(params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
      if (project.user !== locals.user.id) {
        throw error(403, 'Forbidden')
      }
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const name = (data.get('name') as string)?.trim()
    const type = ((data.get('type') as string)?.trim() || 'local') as 'local' | 'sync'
    const provider = (data.get('provider') as string)?.trim() || ''
    const repoUrl = (data.get('repoUrl') as string)?.trim() || ''
    const token = (data.get('token') as string)?.trim() || ''
    const removeToken = data.get('removeToken') === 'true'

    if (!name) {
      return fail(400, {
        error: 'Project name is required.',
        name,
        type,
        provider,
        repoUrl,
        token
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
          token
        })
      }

      if (!repoUrl) {
        return fail(400, {
          error: 'Repository URL is required for synchronized projects.',
          name,
          type,
          provider,
          repoUrl,
          token
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
          token
        })
      }
    }

    let finalToken: string | null = null
    if (type === 'sync') {
      if (token) {
        finalToken = encryptToken(token)
      } else if (removeToken) {
        finalToken = null
      } else {
        finalToken = project.token || null
      }
    }

    try {
      await locals.pb.collection('projects').update(params.projectId, {
        name,
        type,
        provider: type === 'sync' ? provider : null,
        repo_url: type === 'sync' ? repoUrl : null,
        token: finalToken
      })
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to update project.',
        name,
        type,
        provider,
        repoUrl,
        token
      })
    }

    throw redirect(303, `/projects/${params.projectId}`)
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    try {
      const projectRecord = await locals.pb.collection('projects').getOne(params.projectId)
      const project = structuredClone(projectRecord) as unknown as Project
      if (project.user !== locals.user.id) {
        throw error(403, 'Forbidden')
      }

      await locals.pb.collection('projects').delete(params.projectId)
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to delete project.'
      })
    }

    throw redirect(303, '/dashboard')
  }
}

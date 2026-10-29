import crypto from 'node:crypto'
import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { fetchProviderProjectDescription, validateProviderRepoUrl } from '@/lib/providers'
import { decryptToken, encryptToken, sanitizeProject } from '@/lib/server/crypto'
import { generateProjectSlug, getProjectByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (project.user !== locals.user.id) {
      throw error(403, 'Forbidden')
    }

    return {
      title: `Edit ${project.name} · Ixues`,
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
      const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
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
    const onlyMyTasks = data.get('onlyMyTasks') === 'true' || data.get('onlyMyTasks') === 'on'
    const privacy: 'private' | 'public' = (data.get('privacy') as string)?.trim() === 'public' ? 'public' : 'private'
    const regenerateShareToken = data.get('regenerateShareToken') === 'true'

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

    let targetSlug = project.slug
    try {
      let description = project.description || ''
      if (type === 'sync') {
        try {
          const rawToken = token || (removeToken ? '' : decryptToken(project.token))
          const fetchedDesc = await fetchProviderProjectDescription(
            { ...project, name, type, provider, repo_url: repoUrl },
            rawToken,
            locals.user.email
          )
          if (fetchedDesc !== null) {
            description = fetchedDesc
          }
        } catch (descErr) {
          console.error('Failed to update project description:', descErr)
        }
      }

      if (!targetSlug) {
        targetSlug = await generateProjectSlug(locals.pb, name, project.id)
      }

      let shareToken = project.share_token || null
      if (privacy === 'public') {
        if (regenerateShareToken || !shareToken) {
          shareToken = crypto.randomBytes(16).toString('hex')
        }
      } else {
        shareToken = null
      }

      await locals.pb.collection('projects').update(project.id, {
        name,
        slug: targetSlug,
        description,
        type,
        provider: type === 'sync' ? provider : null,
        repo_url: type === 'sync' ? repoUrl : null,
        token: finalToken,
        only_my_tasks: onlyMyTasks,
        privacy,
        share_token: shareToken
      })
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to update project.',
        name,
        type,
        provider,
        repoUrl,
        token,
        onlyMyTasks,
        privacy
      })
    }

    throw redirect(303, `/projects/${targetSlug || project.id}`)
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    try {
      const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
      const project = structuredClone(projectRecord) as unknown as Project
      if (project.user !== locals.user.id) {
        throw error(403, 'Forbidden')
      }

      await locals.pb.collection('projects').delete(project.id)
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to delete project.'
      })
    }

    throw redirect(303, '/')
  }
}

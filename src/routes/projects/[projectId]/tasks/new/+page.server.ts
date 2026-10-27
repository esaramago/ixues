import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import { DEFAULT_LOCAL_LABELS, type TaskPriority } from '@/types/task'
import type { User } from '@/types/user'
import {
  createGitHubIssue,
  fetchGitHubLabels,
  getGitHubStatuses
} from '@/lib/github'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { generateTaskSlug, getProjectByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (project.type === 'sync' && project.provider === 'github') {
      const statuses = getGitHubStatuses(project.id, locals.user.id)
      const statusParam = url.searchParams.get('status') || ''
      const defaultStatus = statuses.some((s) => s.id === statusParam)
        ? statusParam
        : 'open'

      let availableLabels: string[] = []
      if (project.repo_url) {
        try {
          const decryptedToken = decryptToken(project.token)
          availableLabels = await fetchGitHubLabels(project.repo_url, decryptedToken)
        } catch (err) {
          console.error('Failed to fetch GitHub labels:', err)
        }
      }

      return {
        project: sanitizeProject(project),
        statuses,
        defaultStatus,
        users: [],
        availableLabels
      }
    }

    let statuses: Status[] = []
    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${project.id}"`,
        sort: 'order',
      })
      statuses = structuredClone(statusRecords) as unknown as Status[]
    } catch {
      // Status collection may be empty or not yet configured for this project
      statuses = []
    }

    const statusParam = url.searchParams.get('status') || ''
    const defaultStatus = statuses.some((s) => s.id === statusParam)
      ? statusParam
      : statuses[0]?.id || ''

    let users: User[] = []
    try {
      const userRecords = await locals.pb.collection('users').getFullList({
        sort: 'name,email',
      })
      users = structuredClone(userRecords) as unknown as User[]
    } catch {
      users = []
    }

    return {
      project: sanitizeProject(project),
      statuses,
      defaultStatus,
      users,
      availableLabels: [...DEFAULT_LOCAL_LABELS]
    }
  } catch {
    throw error(404, 'Project not found')
  }
}

export const actions: Actions = {
  default: async ({ params, request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    let project: Project
    try {
      const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const title = (data.get('title') as string)?.trim()
    const description = (data.get('description') as string)?.trim() || ''
    const priority = ((data.get('priority') as string)?.trim() ||
      'medium') as TaskPriority
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

    if (!title) {
      return fail(400, {
        error: 'Task title is required.',
        title,
        description,
        priority,
        status,
        assigned,
        labels,
      })
    }

    const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
    const selectedPriority: TaskPriority = validPriorities.includes(priority)
      ? priority
      : 'medium'

    if (project.type === 'sync' && project.provider === 'github') {
      if (!project.repo_url) {
        return fail(400, {
          error: 'Project repository URL is missing.',
          title,
          description,
          priority: selectedPriority,
          status,
          assigned,
          labels,
        })
      }

      try {
        const decryptedToken = decryptToken(project.token)
        await createGitHubIssue(
          project.repo_url,
          {
            title,
            body: description,
            labels
          },
          project.id,
          locals.user.id,
          decryptedToken
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create issue on GitHub.'
        return fail(500, {
          error: message,
          title,
          description,
          priority: selectedPriority,
          status,
          assigned,
          labels,
        })
      }

      throw redirect(303, `/projects/${project.slug || project.id}`)
    }

    let nextNumber = 1
    try {
      const highestTask = await locals.pb
        .collection('tasks')
        .getFirstListItem(`project = "${project.id}"`, {
          sort: '-number',
        })
      if (
        highestTask &&
        typeof highestTask.number === 'number' &&
        highestTask.number >= 1
      ) {
        nextNumber = highestTask.number + 1
      } else {
        const countResult = await locals.pb.collection('tasks').getList(1, 1, {
          filter: `project = "${project.id}"`,
        })
        nextNumber = countResult.totalItems + 1
      }
    } catch {
      nextNumber = 1
    }

    try {
      const slug = await generateTaskSlug(locals.pb, project.id, title)
      await locals.pb.collection('tasks').create({
        number: nextNumber,
        title,
        slug,
        description: description || null,
        priority: selectedPriority,
        status: status || null,
        assigned: assigned || null,
        labels,
        project: project.id,
        user: locals.user.id,
      })
    } catch (err: unknown) {
      const pbError = err as {
        status?: number
        data?: { message?: string }
        message?: string
      }
      return fail(pbError?.status || 500, {
        error:
          pbError?.data?.message ||
          pbError?.message ||
          'Failed to create task.',
        title,
        description,
        priority: selectedPriority,
        status,
        assigned,
        labels,
      })
    }

    throw redirect(303, `/projects/${project.slug || project.id}`)
  },
}

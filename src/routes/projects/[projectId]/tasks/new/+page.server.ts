import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import {
  DEFAULT_LOCAL_LABELS,
  type Task
} from '@/types/task'
import type { User } from '@/types/user'
import {
  createProviderIssue,
  fetchProviderIssues,
  fetchProviderLabels,
  fetchProviderStatuses,
  isSyncProject
} from '@/lib/providers'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { parseTaskFormData } from '@/lib/server/task-form'
import { generateTaskSlug, getProjectByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (isSyncProject(project)) {
      const decryptedToken = decryptToken(project.token)
      const statuses = await fetchProviderStatuses(project, locals.user.id, decryptedToken, locals.user.email)
      const statusParam = url.searchParams.get('status') || ''
      const defaultStatus = statuses.some((s) => s.id === statusParam)
        ? statusParam
        : statuses[0]?.id || ''

      let availableLabels: string[] = []
      let availableTasks: Task[] = []
      if (project.repo_url) {
        try {
          const [labels, allIssues] = await Promise.all([
            fetchProviderLabels(project, decryptedToken, locals.user.email),
            fetchProviderIssues(project, locals.user.id, decryptedToken, locals.user.email)
          ])
          availableLabels = labels
          availableTasks = allIssues
        } catch (err) {
          console.error('Failed to fetch provider data:', err)
        }
      }

      return {
        project: sanitizeProject(project),
        statuses,
        defaultStatus,
        defaultAssigned: '',
        users: [],
        availableLabels,
        availableTasks
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

    let availableTasks: Task[] = []
    try {
      const records = await locals.pb.collection('tasks').getFullList({
        filter: `project = "${project.id}"`,
        sort: 'number'
      })
      availableTasks = structuredClone(records) as unknown as Task[]
    } catch {
      availableTasks = []
    }

    const defaultAssigned = users.length === 1 ? users[0].id : ''

    return {
      project: sanitizeProject(project),
      statuses,
      defaultStatus,
      defaultAssigned,
      users,
      availableLabels: [...DEFAULT_LOCAL_LABELS],
      availableTasks
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
    const { title, description, priority, status, assigned, labels, relationships } = parseTaskFormData(data)

    if (!title) {
      return fail(400, {
        error: 'Task title is required.',
        title,
        description,
        priority,
        status,
        assigned,
        labels,
        relationships
      })
    }

    if (isSyncProject(project)) {
      if (!project.repo_url) {
        return fail(400, {
          error: 'Project repository URL is missing.',
          title,
          description,
          priority,
          status,
          assigned,
          labels,
          relationships
        })
      }

      try {
        const decryptedToken = decryptToken(project.token)
        await createProviderIssue(
          project,
          {
            title,
            body: description,
            labels,
            priority
          },
          locals.user.id,
          decryptedToken,
          locals.user.email
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to create issue.'
        return fail(500, {
          error: message,
          title,
          description,
          priority,
          status,
          assigned,
          labels,
          relationships
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
        priority,
        status: status || null,
        assigned: assigned || null,
        labels,
        relationships,
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
        priority,
        status,
        assigned,
        labels,
        relationships
      })
    }

    throw redirect(303, `/projects/${project.slug || project.id}`)
  },
}

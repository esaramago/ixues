import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { TaskPriority } from '@/types/task'
import type { User } from '@/types/user'

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const project = await locals.pb
      .collection('projects')
      .getOne(params.projectId)

    let statuses: Status[] = []
    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${params.projectId}"`,
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
      project: structuredClone(project) as unknown as Project,
      statuses,
      defaultStatus,
      users,
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

    const data = await request.formData()
    const title = (data.get('title') as string)?.trim()
    const description = (data.get('description') as string)?.trim() || ''
    const priority = ((data.get('priority') as string)?.trim() ||
      'medium') as TaskPriority
    const status = (data.get('status') as string)?.trim() || ''
    const assigned = (data.get('assigned') as string)?.trim() || ''

    if (!title) {
      return fail(400, {
        error: 'Task title is required.',
        title,
        description,
        priority,
        status,
        assigned,
      })
    }

    const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
    const selectedPriority: TaskPriority = validPriorities.includes(priority)
      ? priority
      : 'medium'

    let nextNumber = 1
    try {
      const highestTask = await locals.pb
        .collection('tasks')
        .getFirstListItem(`project = "${params.projectId}"`, {
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
          filter: `project = "${params.projectId}"`,
        })
        nextNumber = countResult.totalItems + 1
      }
    } catch {
      nextNumber = 1
    }

    try {
      await locals.pb.collection('tasks').create({
        number: nextNumber,
        title,
        description: description || null,
        priority: selectedPriority,
        status: status || null,
        assigned: assigned || null,
        project: params.projectId,
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
      })
    }

    throw redirect(303, `/projects/${params.projectId}`)
  },
}

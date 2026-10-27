import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task, TaskPriority } from '@/types/task'
import type { User } from '@/types/user'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const project = await locals.pb.collection('projects').getOne(params.projectId)
    const task = await locals.pb.collection('tasks').getOne(params.taskId, {
      expand: 'assigned'
    })

    if (task.project !== params.projectId) {
      throw error(404, 'Task not found in this project')
    }

    let statuses: Status[] = []
    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${params.projectId}"`,
        sort: 'order'
      })
      statuses = structuredClone(statusRecords) as unknown as Status[]
    } catch {
      statuses = []
    }

    let users: User[] = []
    try {
      const userRecords = await locals.pb.collection('users').getFullList({
        sort: 'name,email'
      })
      users = structuredClone(userRecords) as unknown as User[]
    } catch {
      users = []
    }

    return {
      project: structuredClone(project) as unknown as Project,
      task: structuredClone(task) as unknown as Task,
      statuses,
      users
    }
  } catch {
    throw error(404, 'Task not found')
  }
}

export const actions: Actions = {
  update: async ({ params, request, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    const data = await request.formData()
    const title = (data.get('title') as string)?.trim()
    const description = (data.get('description') as string)?.trim() || ''
    const priority = ((data.get('priority') as string)?.trim() || 'medium') as TaskPriority
    const status = (data.get('status') as string)?.trim() || ''
    const assigned = (data.get('assigned') as string)?.trim() || ''

    if (!title) {
      return fail(400, {
        error: 'Task title is required.',
        title,
        description,
        priority,
        status,
        assigned
      })
    }

    const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
    const selectedPriority: TaskPriority = validPriorities.includes(priority) ? priority : 'medium'

    try {
      await locals.pb.collection('tasks').update(params.taskId, {
        title,
        description: description || null,
        priority: selectedPriority,
        status: status || null,
        assigned: assigned || null
      })
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to update task.',
        title,
        description,
        priority: selectedPriority,
        status,
        assigned
      })
    }

    throw redirect(303, `/projects/${params.projectId}`)
  },

  delete: async ({ params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    try {
      await locals.pb.collection('tasks').delete(params.taskId)
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to delete task.'
      })
    }

    throw redirect(303, `/projects/${params.projectId}`)
  }
}

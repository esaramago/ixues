import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task } from '@/types/task'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const project = await locals.pb.collection('projects').getOne(params.projectId)
    const statuses = await locals.pb.collection('statuses').getFullList({
      filter: `project = "${params.projectId}"`,
      sort: 'order'
    })

    let tasks: Task[] = []
    try {
      const taskRecords = await locals.pb.collection('tasks').getFullList({
        filter: `project = "${params.projectId}"`,
        sort: 'number'
      })
      tasks = structuredClone(taskRecords) as unknown as Task[]
    } catch (err) {
      console.error('Failed to load tasks:', err)
      tasks = []
    }

    return {
      project: structuredClone(project) as unknown as Project,
      statuses: structuredClone(statuses) as unknown as Status[],
      tasks
    }
  } catch {
    throw error(404, 'Project not found')
  }
}

export const actions: Actions = {
  createStatus: async ({ request, params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    let project: Project
    try {
      const projectRecord = await locals.pb.collection('projects').getOne(params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const name = (data.get('name') as string)?.trim()
    const orderStr = (data.get('order') as string)?.trim()
    const color = (data.get('color') as string)?.trim() || null

    if (project.type === 'sync') {
      return fail(400, {
        error: 'Statuses cannot be created for synchronized projects.',
        name,
        order: orderStr,
        color
      })
    }

    if (!name) {
      return fail(400, {
        error: 'Status name is required.',
        name,
        order: orderStr,
        color
      })
    }

    let order = orderStr ? parseInt(orderStr, 10) : NaN
    if (isNaN(order)) {
      const existing = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${params.projectId}"`,
        sort: '-order',
        limit: 1
      })
      order = existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0
    }

    try {
      await locals.pb.collection('statuses').create({
        name,
        project: params.projectId,
        order,
        color,
        user: locals.user.id
      })
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to create status.',
        name,
        order: orderStr,
        color
      })
    }

    return {
      success: true
    }
  },

  updateStatus: async ({ request, params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    let project: Project
    try {
      const projectRecord = await locals.pb.collection('projects').getOne(params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const statusId = (data.get('statusId') as string)?.trim()
    const name = (data.get('name') as string)?.trim()
    const orderStr = (data.get('order') as string)?.trim()
    const color = (data.get('color') as string)?.trim() || null

    if (project.type === 'sync') {
      return fail(400, {
        error: 'Statuses cannot be edited for synchronized projects.',
        statusId,
        name,
        order: orderStr,
        color
      })
    }

    if (!statusId) {
      return fail(400, {
        error: 'Status ID is required.',
        statusId: '',
        name,
        order: orderStr,
        color
      })
    }

    if (!name) {
      return fail(400, {
        error: 'Status name is required.',
        statusId,
        name,
        order: orderStr,
        color
      })
    }

    try {
      const existingStatus = await locals.pb.collection('statuses').getOne(statusId)
      if (existingStatus.project !== params.projectId) {
        return fail(400, {
          error: 'Status does not belong to this project.',
          statusId,
          name,
          order: orderStr,
          color
        })
      }

      let order = orderStr ? parseInt(orderStr, 10) : NaN
      if (isNaN(order)) {
        order = existingStatus.order ?? 0
      }

      await locals.pb.collection('statuses').update(statusId, {
        name,
        order,
        color
      })
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to update status.',
        statusId,
        name,
        order: orderStr,
        color
      })
    }

    return {
      success: true
    }
  },

  moveTask: async ({ request, params, locals }) => {
    if (!locals.user) {
      throw redirect(303, '/login')
    }

    const data = await request.formData()
    const taskId = (data.get('taskId') as string)?.trim()
    const statusId = (data.get('statusId') as string)?.trim() || null

    if (!taskId) {
      return fail(400, { error: 'Task ID is required.' })
    }

    try {
      const task = await locals.pb.collection('tasks').getOne(taskId)
      if (task.project !== params.projectId) {
        return fail(400, { error: 'Task does not belong to this project.' })
      }

      if (statusId) {
        const statusRecord = await locals.pb.collection('statuses').getOne(statusId)
        if (statusRecord.project !== params.projectId) {
          return fail(400, { error: 'Status does not belong to this project.' })
        }
      }

      await locals.pb.collection('tasks').update(taskId, {
        status: statusId
      })

      return {
        success: true
      }
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to move task.'
      })
    }
  }
}

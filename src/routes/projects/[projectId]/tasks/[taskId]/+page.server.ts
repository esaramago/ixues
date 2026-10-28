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
  deleteProviderIssue,
  fetchProviderIssue,
  fetchProviderIssues,
  fetchProviderLabels,
  fetchProviderStatuses,
  isSyncProject,
  updateProviderIssue
} from '@/lib/providers'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { parseTaskFormData } from '@/lib/server/task-form'
import { generateTaskSlug, getProjectByIdOrSlug, getTaskByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (isSyncProject(project)) {
      if (!project.repo_url) {
        throw error(400, 'Project repository URL is missing')
      }

      const decryptedToken = decryptToken(project.token)
      const task = await fetchProviderIssue(
        project,
        params.taskId,
        locals.user.id,
        decryptedToken,
        locals.user.email
      )

      if (!task) {
        throw error(404, 'Issue not found')
      }

      const statuses = await fetchProviderStatuses(project, locals.user.id, decryptedToken, locals.user.email)
      const users: User[] = task.expand?.assigned ? [task.expand.assigned] : []

      let availableLabels: string[] = []
      let availableTasks: Task[] = []
      if (project.repo_url) {
        try {
          const [labels, allIssues] = await Promise.all([
            fetchProviderLabels(project, decryptedToken, locals.user.email),
            fetchProviderIssues(project, locals.user.id, decryptedToken, locals.user.email)
          ])
          availableLabels = labels
          availableTasks = allIssues.filter((t) => String(t.number || t.id) !== String(params.taskId))
        } catch (err) {
          console.error('Failed to load provider data:', err)
        }
      }

      return {
        project: sanitizeProject(project),
        task,
        statuses,
        users,
        availableLabels,
        availableTasks
      }
    }

    const taskRecord = await getTaskByIdOrSlug(locals.pb, project.id, params.taskId, {
      expand: 'assigned'
    })

    if (taskRecord.project !== project.id) {
      throw error(404, 'Task not found in this project')
    }

    let allProjectTasks: Task[] = []
    try {
      const records = await locals.pb.collection('tasks').getFullList({
        filter: `project = "${project.id}"`,
        sort: 'number'
      })
      allProjectTasks = structuredClone(records) as unknown as Task[]
    } catch {
      allProjectTasks = []
    }

    const availableTasks = allProjectTasks.filter((t) => t.id !== taskRecord.id)

    const task = structuredClone(taskRecord) as unknown as Task
    if (task.relationships && Array.isArray(task.relationships)) {
      task.relationships = task.relationships.map((rel) => {
        const found = allProjectTasks.find((t) => t.id === rel.taskId || String(t.number) === rel.taskId)
        return {
          ...rel,
          taskNumber: rel.taskNumber ?? found?.number,
          taskTitle: rel.taskTitle ?? found?.title
        }
      })
    }

    let statuses: Status[] = []
    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${project.id}"`,
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
      project: sanitizeProject(project),
      task,
      statuses,
      users,
      availableLabels: [...DEFAULT_LOCAL_LABELS],
      availableTasks
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw error(404, 'Task not found')
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
        await updateProviderIssue(
          project,
          params.taskId,
          {
            title,
            body: description,
            status,
            labels,
            relationships,
            priority
          },
          decryptedToken,
          locals.user.email
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update issue.'
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

    try {
      const taskRecord = await getTaskByIdOrSlug(locals.pb, project.id, params.taskId)
      if (taskRecord.project !== project.id) {
        throw error(404, 'Task not found in this project')
      }

      let taskSlug = taskRecord.slug
      if (!taskSlug) {
        taskSlug = await generateTaskSlug(locals.pb, project.id, title, taskRecord.id)
      }

      await locals.pb.collection('tasks').update(taskRecord.id, {
        title,
        slug: taskSlug,
        description: description || null,
        priority,
        status: status || null,
        assigned: assigned || null,
        labels,
        relationships
      })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 404) {
        throw err
      }
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to update task.',
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

  delete: async ({ params, locals }) => {
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

    if (isSyncProject(project)) {
      try {
        const decryptedToken = decryptToken(project.token)
        await deleteProviderIssue(project, params.taskId, decryptedToken, locals.user.email)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to delete issue.'
        return fail(400, { error: message })
      }

      throw redirect(303, `/projects/${project.slug || project.id}`)
    }

    try {
      const taskRecord = await getTaskByIdOrSlug(locals.pb, project.id, params.taskId)
      await locals.pb.collection('tasks').delete(taskRecord.id)
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to delete task.'
      })
    }

    throw redirect(303, `/projects/${project.slug || project.id}`)
  }
}

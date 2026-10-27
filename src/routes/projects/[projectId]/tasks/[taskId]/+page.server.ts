import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import { DEFAULT_LOCAL_LABELS, type Task, type TaskPriority } from '@/types/task'
import type { User } from '@/types/user'
import {
  fetchGitHubIssue,
  fetchGitHubLabels,
  getGitHubStatuses,
  updateGitHubIssue
} from '@/lib/github'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { generateTaskSlug, getProjectByIdOrSlug, getTaskByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (project.type === 'sync' && project.provider === 'github') {
      if (!project.repo_url) {
        throw error(400, 'Project repository URL is missing')
      }

      const decryptedToken = decryptToken(project.token)
      const task = await fetchGitHubIssue(
        project.repo_url,
        params.taskId,
        project.id,
        locals.user.id,
        decryptedToken
      )

      if (!task) {
        throw error(404, 'GitHub issue not found')
      }

      const statuses = getGitHubStatuses(project.id, locals.user.id)
      const users: User[] = task.expand?.assigned ? [task.expand.assigned] : []

      let availableLabels: string[] = []
      if (project.repo_url) {
        try {
          const decryptedToken = decryptToken(project.token)
          availableLabels = await fetchGitHubLabels(project.repo_url, decryptedToken)
        } catch (err) {
          console.error('Failed to load GitHub labels:', err)
        }
      }

      return {
        project: sanitizeProject(project),
        task,
        statuses,
        users,
        availableLabels
      }
    }

    const taskRecord = await getTaskByIdOrSlug(locals.pb, project.id, params.taskId, {
      expand: 'assigned'
    })

    if (taskRecord.project !== project.id) {
      throw error(404, 'Task not found in this project')
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
      task: structuredClone(taskRecord) as unknown as Task,
      statuses,
      users,
      availableLabels: [...DEFAULT_LOCAL_LABELS]
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
    const title = (data.get('title') as string)?.trim()
    const description = (data.get('description') as string)?.trim() || ''
    const priority = ((data.get('priority') as string)?.trim() || 'medium') as TaskPriority
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
        labels
      })
    }

    const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
    const selectedPriority: TaskPriority = validPriorities.includes(priority) ? priority : 'medium'

    if (project.type === 'sync' && project.provider === 'github') {
      if (!project.repo_url) {
        return fail(400, {
          error: 'Project repository URL is missing.',
          title,
          description,
          priority: selectedPriority,
          status,
          assigned,
          labels
        })
      }

      try {
        const decryptedToken = decryptToken(project.token)
        const isNumeric = /^\d+$/.test(params.taskId)
        let issueNumber = params.taskId
        if (!isNumeric) {
          const ghTask = await fetchGitHubIssue(
            project.repo_url,
            params.taskId,
            project.id,
            locals.user.id,
            decryptedToken
          )
          if (ghTask) {
            issueNumber = String(ghTask.number || ghTask.id)
          }
        }

        await updateGitHubIssue(
          project.repo_url,
          issueNumber,
          {
            title,
            body: description,
            state: status === 'closed' ? 'closed' : 'open',
            labels
          },
          decryptedToken
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update issue on GitHub.'
        return fail(500, {
          error: message,
          title,
          description,
          priority: selectedPriority,
          status,
          assigned,
          labels
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
        priority: selectedPriority,
        status: status || null,
        assigned: assigned || null,
        labels
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
        priority: selectedPriority,
        status,
        assigned,
        labels
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

    if (project.type === 'sync' && project.provider === 'github') {
      return fail(400, {
        error: 'GitHub issues cannot be deleted via API. You can close the issue instead.'
      })
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

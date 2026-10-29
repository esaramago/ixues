import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import {
  DEFAULT_LOCAL_LABELS,
  getLabelInfo,
  type Task,
  type TaskLabel
} from '@/types/task'
import type { User } from '@/types/user'
import {
  fetchProviderIssue,
  fetchProviderIssues,
  fetchProviderLabels,
  fetchProviderStatuses,
  isSyncProject
} from '@/lib/providers'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { getProjectByShareToken, getTaskByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals }) => {
  let projectRecord
  try {
    projectRecord = await getProjectByShareToken(locals.pb, params.shareToken, { expand: 'user' })
  } catch {
    throw error(404, 'Shared project not found')
  }

  const project = structuredClone(projectRecord) as unknown as Project
  if (project.privacy !== 'public' || !project.share_token) {
    throw error(404, 'Shared project not found')
  }

  try {
    if (isSyncProject(project)) {
      if (!project.repo_url) {
        throw error(400, 'Project repository URL is missing')
      }

      const decryptedToken = decryptToken(project.token)
      const ownerId = project.user
      const ownerEmail = (projectRecord.expand?.user as { email?: string } | undefined)?.email

      let statuses: Status[] = []
      try {
        const localStatusRecords = await locals.pb.collection('statuses').getFullList({
          filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
          sort: 'order'
        })
        const providerStatuses = await fetchProviderStatuses(project, ownerId, decryptedToken, ownerEmail)
        if (localStatusRecords.length > 0) {
          const validRecords = localStatusRecords.filter((r) => {
            const rKey = r.key || r.id
            if (project.provider === 'github' && (rKey === 'open' || rKey === 'closed')) return true
            if (providerStatuses.length === 0) return true
            return providerStatuses.some((ps) => {
              const norm = (s: string) => s.toLowerCase().replace(/[\s\-_:]+/g, '')
              return (
                norm(ps.name) === norm(r.name) ||
                (ps.key && r.key && norm(ps.key) === norm(r.key)) ||
                ps.id === rKey ||
                (ps.key && ps.key === rKey)
              )
            })
          })
          statuses = validRecords.map((r) => ({
            id: r.key || r.id,
            pbId: r.id,
            key: r.key,
            name: r.name,
            order: r.order,
            color: r.color,
            project: r.project,
            user: r.user
          }))
        } else {
          statuses = providerStatuses
        }
      } catch {
        statuses = await fetchProviderStatuses(project, ownerId, decryptedToken, ownerEmail)
      }

      const task = await fetchProviderIssue(
        project,
        params.taskId,
        ownerId,
        decryptedToken,
        ownerEmail,
        statuses
      )

      if (!task) {
        throw error(404, 'Issue not found')
      }

      const users: User[] = task.expand?.assigned ? [task.expand.assigned] : []

      let availableLabels: TaskLabel[] = []
      let availableTasks: Task[] = []
      if (project.repo_url) {
        try {
          const [labels, allIssues] = await Promise.all([
            fetchProviderLabels(project, decryptedToken, ownerEmail),
            fetchProviderIssues(project, ownerId, decryptedToken, ownerEmail, statuses)
          ])
          availableLabels = labels
          availableTasks = allIssues.filter((t) => String(t.number || t.id) !== String(params.taskId))
        } catch (err) {
          console.error('Failed to load provider data:', err)
        }
      }

      return {
        title: `${task.title} · ${project.name} · Shared · Ixues`,
        project: sanitizeProject(project),
        task,
        statuses,
        users,
        availableLabels,
        availableTasks,
        shareToken: params.shareToken
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
        filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
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
        filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
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
      title: `${task.title} · ${project.name} · Shared · Ixues`,
      project: sanitizeProject(project),
      task,
      statuses,
      users,
      availableLabels: DEFAULT_LOCAL_LABELS.map((name) => getLabelInfo(name)),
      availableTasks,
      shareToken: params.shareToken
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw error(404, 'Task not found')
  }
}

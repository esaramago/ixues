import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import {
  DEFAULT_LOCAL_LABELS,
  getLabelInfo,
  type Task,
  type TaskLabel
} from '@/types/task'
import type { User } from '@/types/user'
import { parseCodebergRepo } from '@/lib/codeberg'
import {
  createProviderIssue,
  fetchProviderIssues,
  fetchProviderLabels,
  fetchProviderStatuses,
  fetchProviderUsers,
  isSyncProject
} from '@/lib/providers'
import { sanitizeProject } from '@/lib/server/crypto'
import { resolveProjectToken } from '@/lib/server/tokens'
import { parseTaskFormData } from '@/lib/server/task-form'
import { generateTaskSlug, getProjectByIdOrSlug } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals, url }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    if (project.user !== locals.user.id) {
      throw error(403, 'Forbidden')
    }

    if (isSyncProject(project)) {
      const decryptedToken = await resolveProjectToken(locals.pb, project, locals.user.id)
      let statuses: Status[] = []
      try {
        const localStatusRecords = await locals.pb.collection('statuses').getFullList({
          filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
          sort: 'order'
        })
        const providerStatuses = await fetchProviderStatuses(project, locals.user.id, decryptedToken, locals.user.email)
        if (localStatusRecords.length > 0) {
          const validRecords = localStatusRecords.filter((r) => {
            const rKey = r.key || r.id
            if ((project.provider === 'github' || project.provider === 'codeberg') && (rKey === 'open' || rKey === 'closed')) return true
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
        statuses = await fetchProviderStatuses(project, locals.user.id, decryptedToken, locals.user.email)
      }

      const statusParam = url.searchParams.get('status') || ''
      const defaultStatus = statuses.some((s) => s.id === statusParam)
        ? statusParam
        : statuses[0]?.id || ''

      let availableLabels: TaskLabel[] = []
      let availableTasks: Task[] = []
      let users: User[] = []
      if (project.repo_url) {
        const [labelsResult, issuesResult, usersResult] = await Promise.allSettled([
          fetchProviderLabels(project, decryptedToken, locals.user.email),
          fetchProviderIssues(project, locals.user.id, decryptedToken, locals.user.email, statuses),
          fetchProviderUsers(project, decryptedToken, locals.user.email)
        ])
        if (labelsResult.status === 'fulfilled') {
          availableLabels = labelsResult.value
        } else {
          console.error('Failed to load provider labels:', labelsResult.reason)
        }
        if (issuesResult.status === 'fulfilled') {
          availableTasks = issuesResult.value
        } else {
          console.error('Failed to load provider issues:', issuesResult.reason)
        }
        if (usersResult.status === 'fulfilled') {
          users = usersResult.value
        } else {
          console.error('Failed to load provider users:', usersResult.reason)
        }
      }

      const currentUser = locals.user
      if (users.length === 0 && currentUser) {
        let fallbackUsername = currentUser.username || ''
        if (!fallbackUsername && project.repo_url) {
          const cb = parseCodebergRepo(project.repo_url)
          if (cb) fallbackUsername = cb.owner
        }
        if (fallbackUsername) {
          users = [
            {
              id: fallbackUsername,
              name: currentUser.name || fallbackUsername,
              username: fallbackUsername,
              email: currentUser.email
            }
          ]
        }
      }

      const clean = (s?: string | null) => (s || '').toLowerCase().replace(/[\s\-_.]+/g, '')
      const matchedUser = currentUser
        ? users.find(
            (u) =>
              (currentUser.username && clean(u.username) === clean(currentUser.username)) ||
              (currentUser.email && clean(u.email) === clean(currentUser.email)) ||
              (currentUser.name && (clean(u.name) === clean(currentUser.name) || clean(u.username) === clean(currentUser.name))) ||
              (currentUser.id && u.id === currentUser.id)
          )
        : undefined
      const defaultAssigned = matchedUser?.id || (users.length === 1 ? users[0].id : '')

      return {
        title: `New task · ${project.name} · Ixues`,
        project: sanitizeProject(project),
        statuses,
        defaultStatus,
        defaultAssigned,
        users,
        availableLabels,
        availableTasks
      }
    }

    let statuses: Status[] = []
    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
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
        filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
        sort: 'number'
      })
      availableTasks = structuredClone(records) as unknown as Task[]
    } catch {
      availableTasks = []
    }

    const defaultAssigned = users.length === 1 ? users[0].id : ''

    return {
      title: `New task · ${project.name} · Ixues`,
      project: sanitizeProject(project),
      statuses,
      defaultStatus,
      defaultAssigned,
      users,
      availableLabels: DEFAULT_LOCAL_LABELS.map((name) => getLabelInfo(name)),
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
      if (project.user !== locals.user.id) {
        throw error(403, 'Forbidden')
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err) {
        throw err
      }
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const { title, description, priority, status, assigned, labels, relationships, branches } =
      parseTaskFormData(data)

    if (!title) {
      return fail(400, {
        error: 'Task title is required.',
        title,
        description,
        priority,
        status,
        assigned,
        labels,
        relationships,
        branches
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
          relationships,
          branches
        })
      }

      try {
        const decryptedToken = await resolveProjectToken(locals.pb, project, locals.user.id)
        let projectStatuses: Status[] = []
        try {
          const statusRecords = await locals.pb.collection('statuses').getFullList({
            filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
            sort: 'order'
          })
          projectStatuses = statusRecords.map((r) => ({
            id: r.key || r.id,
            pbId: r.id,
            key: r.key,
            name: r.name,
            order: r.order,
            color: r.color,
            project: r.project,
            user: r.user
          }))
        } catch {}

        await createProviderIssue(
          project,
          {
            title,
            body: description,
            status,
            labels,
            priority,
            assigned
          },
          locals.user.id,
          decryptedToken,
          locals.user.email,
          projectStatuses
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
          relationships,
          branches
        })
      }

      throw redirect(303, `/projects/${project.slug || project.id}`)
    }

    let nextNumber = 1
    try {
      const highestTask = await locals.pb
        .collection('tasks')
        .getFirstListItem(
          locals.pb.filter('project = {:projectId}', { projectId: project.id }),
          {
            sort: '-number',
          }
        )
      if (
        highestTask &&
        typeof highestTask.number === 'number' &&
        highestTask.number >= 1
      ) {
        nextNumber = highestTask.number + 1
      } else {
        const countResult = await locals.pb.collection('tasks').getList(1, 1, {
          filter: locals.pb.filter('project = {:projectId}', { projectId: project.id }),
        })
        nextNumber = countResult.totalItems + 1
      }
    } catch {
      nextNumber = 1
    }

    try {
      const slug = await generateTaskSlug(locals.pb, project.id, title)

      let nextOrder = 0
      try {
        const filter = status
          ? locals.pb.filter('project = {:projectId} && status = {:status}', {
              projectId: project.id,
              status
            })
          : locals.pb.filter('project = {:projectId} && status = null', {
              projectId: project.id
            })
        const highestOrderTask = await locals.pb
          .collection('tasks')
          .getFirstListItem(filter, {
            sort: '-order'
          })
        if (
          highestOrderTask &&
          typeof highestOrderTask.order === 'number'
        ) {
          nextOrder = highestOrderTask.order + 1
        }
      } catch {
        nextOrder = 0
      }

      await locals.pb.collection('tasks').create({
        number: nextNumber,
        order: nextOrder,
        title,
        slug,
        description: description || null,
        priority,
        status: status || null,
        assigned: assigned || null,
        labels,
        relationships,
        branches,
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
        relationships,
        branches
      })
    }

    throw redirect(303, `/projects/${project.slug || project.id}`)
  },
}

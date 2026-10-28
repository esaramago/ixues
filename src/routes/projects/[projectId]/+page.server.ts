import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task } from '@/types/task'
import {
  fetchProviderIssues,
  fetchProviderStatuses,
  isSyncProject,
  updateProviderIssueStatus
} from '@/lib/providers'
import {
  deleteGitHubLabel,
  ensureGitHubLabelExists,
  formatGitHubStatusLabel,
  renameGitHubLabel
} from '@/lib/github'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { getProjectByIdOrSlug, slugify } from '@/lib/slug'

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
    const project = structuredClone(projectRecord) as unknown as Project

    let statuses: Status[] = []
    let tasks: Task[] = []
    let syncError: string | null = null

    if (isSyncProject(project)) {
      const decryptedToken = decryptToken(project.token)
      let providerStatuses: Status[] = []
      try {
        providerStatuses = await fetchProviderStatuses(project, locals.user.id, decryptedToken, locals.user.email)
      } catch (err) {
        console.error('Error fetching provider statuses:', err)
      }

      try {
        const localStatusRecords = await locals.pb.collection('statuses').getFullList({
          filter: `project = "${project.id}"`,
          sort: 'order'
        })

        if (localStatusRecords.length === 0 && providerStatuses.length > 0) {
          for (let i = 0; i < providerStatuses.length; i++) {
            const ps = providerStatuses[i]
            const record = await locals.pb.collection('statuses').create({
              name: ps.name,
              project: project.id,
              order: i,
              color: ps.color,
              user: locals.user.id,
              key: ps.id
            })
            statuses.push({
              id: ps.id,
              pbId: record.id,
              key: ps.id,
              name: ps.name,
              order: i,
              color: ps.color,
              project: project.id,
              user: locals.user.id
            })
          }
        } else {
          let currentStatusRecords = [...localStatusRecords]

          // Auto-sync: if a status was removed on the provider, delete it from PocketBase
          if (providerStatuses.length > 0) {
            const filteredRecords: typeof localStatusRecords = []
            for (const r of currentStatusRecords) {
              const rKey = r.key || r.id
              // Keep native open/closed statuses for GitHub
              if (
                project.provider === 'github' &&
                (rKey === 'open' || rKey === 'closed' || r.name.toLowerCase() === 'open' || r.name.toLowerCase() === 'closed')
              ) {
                filteredRecords.push(r)
                continue
              }

              const stillExists = providerStatuses.some((ps) => {
                const norm = (s: string) => s.toLowerCase().replace(/[\s\-_:]+/g, '')
                return (
                  norm(ps.name) === norm(r.name) ||
                  (ps.key && r.key && norm(ps.key) === norm(r.key)) ||
                  ps.id === rKey ||
                  (ps.key && ps.key === rKey)
                )
              })

              if (!stillExists) {
                try {
                  await locals.pb.collection('statuses').delete(r.id)
                } catch (delErr) {
                  console.error('Failed to delete removed provider status from PB:', delErr)
                }
              } else {
                filteredRecords.push(r)
              }
            }
            currentStatusRecords = filteredRecords
          }

          let nextOrder = currentStatusRecords.length > 0
            ? Math.max(...currentStatusRecords.map((r) => (r.order ?? 0))) + 1
            : 0

          for (const ps of providerStatuses) {
            const psKey = ps.key || ps.id
            const alreadyExists = currentStatusRecords.some((r) => {
              const norm = (s: string) => s.toLowerCase().replace(/[\s\-_:]+/g, '')
              return (
                norm(r.name) === norm(ps.name) ||
                (r.key && ps.key && norm(r.key) === norm(ps.key)) ||
                r.key === psKey ||
                r.id === ps.id
              )
            })

            if (!alreadyExists) {
              const record = await locals.pb.collection('statuses').create({
                name: ps.name,
                project: project.id,
                order: nextOrder++,
                color: ps.color,
                user: locals.user.id,
                key: psKey
              })
              currentStatusRecords.push(record)
            }
          }

          currentStatusRecords.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

          statuses = currentStatusRecords.map((r) => ({
            id: r.key || r.id,
            pbId: r.id,
            key: r.key,
            name: r.name,
            order: r.order,
            color: r.color,
            project: r.project,
            user: r.user
          }))
        }
      } catch (err) {
        console.error('Error managing persisted statuses:', err)
        statuses = providerStatuses
      }

      if (project.repo_url) {
        try {
          tasks = await fetchProviderIssues(project, locals.user.id, decryptedToken, locals.user.email, statuses)
        } catch (err: unknown) {
          syncError = err instanceof Error ? err.message : `Failed to fetch issues from ${project.provider || 'provider'}`
          console.error('Error fetching provider issues:', syncError)
          tasks = []
        }
      }
    } else {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${project.id}"`,
        sort: 'order'
      })
      statuses = structuredClone(statusRecords) as unknown as Status[]

      try {
        const taskRecords = await locals.pb.collection('tasks').getFullList({
          filter: `project = "${project.id}"`,
          sort: 'number',
          expand: 'assigned'
        })
        tasks = structuredClone(taskRecords) as unknown as Task[]
      } catch (err) {
        console.error('Failed to load tasks:', err)
        tasks = []
      }
    }

    return {
      title: `${project.name} · Ixues`,
      project: sanitizeProject(project),
      statuses,
      tasks,
      syncError
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
      const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const name = (data.get('name') as string)?.trim()
    const orderStr = (data.get('order') as string)?.trim()
    const color = (data.get('color') as string)?.trim() || null

    if (project.type === 'sync' && project.provider !== 'github') {
      return fail(400, {
        error: 'Statuses cannot be created for this synchronized project.',
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
        filter: `project = "${project.id}"`,
        sort: '-order',
        limit: 1
      })
      order = existing.length > 0 ? (existing[0].order ?? 0) + 1 : 0
    }

    const statusKey = slugify(name)

    try {
      await locals.pb.collection('statuses').create({
        name,
        project: project.id,
        order,
        color,
        user: locals.user.id,
        key: statusKey
      })

      if (project.provider === 'github' && project.repo_url) {
        try {
          const decryptedToken = decryptToken(project.token)
          await ensureGitHubLabelExists(
            project.repo_url,
            formatGitHubStatusLabel(name),
            color,
            decryptedToken
          )
        } catch (err) {
          console.error('Failed to create GitHub status label:', err)
        }
      }
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
      const projectRecord = await getProjectByIdOrSlug(locals.pb, params.projectId)
      project = structuredClone(projectRecord) as unknown as Project
    } catch {
      throw error(404, 'Project not found')
    }

    const data = await request.formData()
    const statusId = (data.get('statusId') as string)?.trim()
    const name = (data.get('name') as string)?.trim()
    const orderStr = (data.get('order') as string)?.trim()
    const color = (data.get('color') as string)?.trim() || null

    if (!statusId) {
      return fail(400, {
        error: 'Status ID is required.',
        statusId: '',
        name,
        order: orderStr,
        color
      })
    }

    if (!name && (project.type === 'local' || project.provider === 'github')) {
      return fail(400, {
        error: 'Status name is required.',
        statusId,
        name,
        order: orderStr,
        color
      })
    }

    try {
      let existingStatus
      try {
        existingStatus = await locals.pb.collection('statuses').getOne(statusId)
      } catch {
        const records = await locals.pb.collection('statuses').getFullList({
          filter: `project = "${project.id}" && (id = "${statusId}" || key = "${statusId}")`
        })
        if (records.length > 0) {
          existingStatus = records[0]
        }
      }

      if (!existingStatus || existingStatus.project !== project.id) {
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

      const updatePayload: Record<string, unknown> = {
        order,
        color
      }
      if (name) {
        updatePayload.name = name
      }
      if (name && project.provider === 'github') {
        updatePayload.key = slugify(name)
      }

      await locals.pb.collection('statuses').update(existingStatus.id, updatePayload)

      if (project.provider === 'github' && project.repo_url && name) {
        const oldLabelName = formatGitHubStatusLabel(existingStatus.name)
        const newLabelName = formatGitHubStatusLabel(name)
        const decryptedToken = decryptToken(project.token)

        if (oldLabelName !== newLabelName) {
          try {
            await renameGitHubLabel(
              project.repo_url,
              oldLabelName,
              newLabelName,
              color,
              decryptedToken
            )
          } catch (err) {
            console.error('Failed to rename GitHub label:', err)
          }
        } else if (color && color !== existingStatus.color) {
          try {
            await ensureGitHubLabelExists(
              project.repo_url,
              newLabelName,
              color,
              decryptedToken
            )
          } catch {}
        }
      }
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

  deleteStatus: async ({ request, params, locals }) => {
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
    const statusId = (data.get('statusId') as string)?.trim()

    if (!statusId) {
      return fail(400, {
        error: 'Status ID is required.'
      })
    }

    try {
      let existingStatus
      try {
        existingStatus = await locals.pb.collection('statuses').getOne(statusId)
      } catch {
        const records = await locals.pb.collection('statuses').getFullList({
          filter: `project = "${project.id}" && (id = "${statusId}" || key = "${statusId}")`
        })
        if (records.length > 0) {
          existingStatus = records[0]
        }
      }

      if (!existingStatus || existingStatus.project !== project.id) {
        return fail(404, {
          error: 'Status not found or does not belong to this project.'
        })
      }

      if (project.type === 'sync') {
        if (project.provider !== 'github') {
          return fail(400, {
            error: 'Statuses cannot be deleted for this synchronized project.'
          })
        }

        const statusKey = (existingStatus.key || existingStatus.id).toLowerCase()
        const statusName = existingStatus.name.toLowerCase()
        if (
          statusKey === 'open' ||
          statusKey === 'closed' ||
          statusName === 'open' ||
          statusName === 'closed'
        ) {
          return fail(400, {
            error: 'Native GitHub statuses (Open/Closed) cannot be deleted.'
          })
        }

        if (project.repo_url) {
          try {
            const decryptedToken = decryptToken(project.token)
            const labelName = formatGitHubStatusLabel(existingStatus.name)
            await deleteGitHubLabel(project.repo_url, labelName, decryptedToken)
          } catch (err) {
            console.error('Failed to delete GitHub label:', err)
          }
        }
      } else {
        // Disassociate any local tasks currently assigned to this status
        try {
          const tasksInStatus = await locals.pb.collection('tasks').getFullList({
            filter: `project = "${project.id}" && status = "${existingStatus.id}"`
          })
          for (const task of tasksInStatus) {
            await locals.pb.collection('tasks').update(task.id, {
              status: null
            })
          }
        } catch (err) {
          console.error('Failed to disassociate tasks from deleted status:', err)
        }
      }

      await locals.pb.collection('statuses').delete(existingStatus.id)

      return {
        success: true
      }
    } catch (err: unknown) {
      const pbError = err as { status?: number; data?: { message?: string }; message?: string }
      return fail(pbError?.status || 500, {
        error: pbError?.data?.message || pbError?.message || 'Failed to delete status.'
      })
    }
  },

  reorderStatus: async ({ request, params, locals }) => {
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
    const statusId = (data.get('statusId') as string)?.trim()
    const direction = (data.get('direction') as string)?.trim()

    if (!statusId || (direction !== 'left' && direction !== 'right')) {
      return fail(400, { error: 'Invalid reorder parameters.' })
    }

    try {
      const statusRecords = await locals.pb.collection('statuses').getFullList({
        filter: `project = "${project.id}"`,
        sort: 'order'
      })

      const currentIndex = statusRecords.findIndex(
        (s) => s.id === statusId || s.key === statusId
      )

      if (currentIndex === -1) {
        return fail(404, { error: 'Status not found.' })
      }

      const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= statusRecords.length) {
        return { success: true }
      }

      const currentItem = statusRecords[currentIndex]
      const targetItem = statusRecords[targetIndex]

      let currentOrder = currentItem.order ?? currentIndex
      let targetOrder = targetItem.order ?? targetIndex

      if (currentOrder === targetOrder) {
        currentOrder = currentIndex
        targetOrder = targetIndex
      }

      await locals.pb.collection('statuses').update(currentItem.id, {
        order: targetOrder
      })
      await locals.pb.collection('statuses').update(targetItem.id, {
        order: currentOrder
      })

      return { success: true }
    } catch (err: unknown) {
      const pbError = err as { message?: string }
      return fail(500, { error: pbError?.message || 'Failed to reorder status.' })
    }
  },

  moveTask: async ({ request, params, locals }) => {
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
    const taskId = (data.get('taskId') as string)?.trim()
    const statusId = (data.get('statusId') as string)?.trim() || null

    if (!taskId) {
      return fail(400, { error: 'Task ID is required.' })
    }

    if (isSyncProject(project)) {
      if (!project.repo_url) {
        return fail(400, { error: 'Project repository URL is missing.' })
      }
      if (!statusId) {
        return fail(400, { error: 'Status ID is required.' })
      }

      try {
        const decryptedToken = decryptToken(project.token)
        let projectStatuses: Status[] = []
        try {
          const statusRecords = await locals.pb.collection('statuses').getFullList({
            filter: `project = "${project.id}"`,
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

        await updateProviderIssueStatus(
          project,
          taskId,
          statusId,
          decryptedToken,
          locals.user.email,
          projectStatuses
        )
        return {
          success: true
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update issue status.'
        return fail(500, { error: message })
      }
    }

    try {
      const task = await locals.pb.collection('tasks').getOne(taskId)
      if (task.project !== project.id) {
        return fail(400, { error: 'Task does not belong to this project.' })
      }

      if (statusId) {
        const statusRecord = await locals.pb.collection('statuses').getOne(statusId)
        if (statusRecord.project !== project.id) {
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

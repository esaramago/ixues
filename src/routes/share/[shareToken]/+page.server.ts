import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task } from '@/types/task'
import {
  fetchProviderIssues,
  fetchProviderStatuses,
  isSyncProject
} from '@/lib/providers'
import { decryptToken, sanitizeProject } from '@/lib/server/crypto'
import { getProjectByShareToken } from '@/lib/slug'

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
    let statuses: Status[] = []
    let tasks: Task[] = []
    let syncError: string | null = null

    if (isSyncProject(project)) {
      const decryptedToken = decryptToken(project.token)
      const ownerId = project.user
      const ownerEmail = (projectRecord.expand?.user as { email?: string } | undefined)?.email

      try {
        const localStatusRecords = await locals.pb.collection('statuses').getFullList({
          filter: `project = "${project.id}"`,
          sort: 'order'
        })
        if (localStatusRecords.length > 0) {
          statuses = localStatusRecords.map((r) => ({
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
          statuses = await fetchProviderStatuses(project, ownerId, decryptedToken, ownerEmail)
        }
      } catch {
        statuses = await fetchProviderStatuses(project, ownerId, decryptedToken, ownerEmail).catch(() => [])
      }

      if (project.repo_url) {
        try {
          tasks = await fetchProviderIssues(project, ownerId, decryptedToken, ownerEmail, statuses)
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
      title: `${project.name} · Shared · Ixues`,
      project: sanitizeProject(project),
      statuses,
      tasks,
      syncError,
      shareToken: params.shareToken
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw error(404, 'Shared project not found')
  }
}

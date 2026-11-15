import type PocketBase from 'pocketbase'
import type { Project } from '@/types/project'
import { fetchProviderProjectDescription } from '@/lib/providers'
import { sanitizeProjects } from '@/lib/server/crypto'
import { resolveProjectToken } from '@/lib/server/tokens'

interface ProjectOwner {
  id: string
  email?: string
}

// Reuse the same promise across load functions of a single request.
const projectsCache = new WeakMap<PocketBase, Map<string, Promise<Project[]>>>()

export function getProjects(pb: PocketBase, owner: ProjectOwner): Promise<Project[]> {
  let userCache = projectsCache.get(pb)
  if (!userCache) {
    userCache = new Map()
    projectsCache.set(pb, userCache)
  }

  const cached = userCache.get(owner.id)
  if (cached) return cached

  const pending = loadProjects(pb, owner)
  userCache.set(owner.id, pending)
  return pending
}

async function loadProjects(pb: PocketBase, owner: ProjectOwner): Promise<Project[]> {
  const records = await pb.collection('projects').getFullList({
    filter: pb.filter('user = {:userId}', { userId: owner.id })
  })
  const projects = sanitizeProjects(structuredClone(records) as unknown as Project[])

  await Promise.allSettled(
    projects.map(async (project) => {
      if (project.type !== 'sync' || project.description || !project.repo_url) return

      try {
        const rawRecord = records.find((record) => record.id === project.id)
        const decryptedToken = rawRecord
          ? await resolveProjectToken(pb, rawRecord as unknown as Project, owner.id)
          : ''
        const description = await fetchProviderProjectDescription(project, decryptedToken, owner.email)

        if (description) {
          project.description = description
          await pb.collection('projects').update(project.id, {
            description
          }).catch(() => {})
        }
      } catch (err) {
        console.error(`Failed to fetch description for project ${project.name}:`, err)
      }
    })
  )

  return projects
}

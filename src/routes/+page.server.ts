import type { PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { fetchProviderProjectDescription } from '@/lib/providers'
import { decryptToken, sanitizeProjects } from '@/lib/server/crypto'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: []
    }
  }

  try {
    const records = await locals.pb.collection('projects').getFullList({
      filter: locals.pb.filter('user = {:userId}', { userId: locals.user.id })
    })
    const projects = sanitizeProjects(structuredClone(records) as unknown as Project[])

    await Promise.allSettled(
      projects.map(async (project) => {
        if (project.type === 'sync' && !project.description && project.repo_url) {
          try {
            const rawRecord = records.find((r) => r.id === project.id)
            const decryptedToken = decryptToken(rawRecord?.token)
            const desc = await fetchProviderProjectDescription(
              project,
              decryptedToken,
              locals.user?.email
            )
            if (desc) {
              project.description = desc
              await locals.pb.collection('projects').update(project.id, {
                description: desc
              }).catch(() => {})
            }
          } catch (err) {
            console.error(`Failed to fetch description for project ${project.name}:`, err)
          }
        }
      })
    )

    return {
      title: 'Projects · Ixues',
      projects,
    }
  } catch (err) {
    console.error('Error fetching projects:', err)
    return {
      title: 'Projects · Ixues',
      projects: [],
    }
  }
}

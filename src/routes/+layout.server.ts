import type { LayoutServerLoad } from './$types'
import type { Project } from '@/types/project'
import { getProjects } from '@/lib/server/projects'

export const load: LayoutServerLoad = async ({ locals }) => {
  let projects: Project[] = []

  if (locals.user) {
    try {
      projects = await getProjects(locals.pb, locals.user)
    } catch (err) {
      console.error('Error fetching projects for sidebar:', err)
    }
  }

  return {
    user: locals.user ? structuredClone(locals.user) : null,
    projects
  }
}

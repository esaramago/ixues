import type { PageServerLoad } from './$types'
import { getProjects } from '@/lib/server/projects'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      projects: []
    }
  }

  try {
    const projects = await getProjects(locals.pb, locals.user)

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

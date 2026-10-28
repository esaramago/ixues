import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Project } from '@/types/project'
import { sanitizeProjects } from '@/lib/server/crypto'

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, '/login')
  }

  try {
    const projects = await locals.pb.collection('projects').getFullList()

    return {
      title: 'Projects · Ixues',
      projects: sanitizeProjects(structuredClone(projects) as unknown as Project[]),
    }
  } catch (err) {
    console.error('Error fetching projects:', err)
    return {
      title: 'Projects · Ixues',
      projects: [],
    }
  }
}

import { redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
  throw redirect(303, '/')
}

export const actions: Actions = {
  default: async ({ locals }) => {
    locals.pb.authStore.clear()
    locals.user = null
    throw redirect(303, '/login')
  },
}

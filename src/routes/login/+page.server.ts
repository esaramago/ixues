import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  // Redirect already authenticated users to homepage
  if (locals.user) {
    throw redirect(303, '/')
  }

  return {
    title: 'Sign in · Ixues',
  }
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData()
    const email = data.get('email') as string
    const password = data.get('password') as string

    if (!email || !password) {
      return fail(400, {
        error: 'Email and password are required.',
        email,
      })
    }

    try {
      await locals.pb.collection('users').authWithPassword(email, password)
    } catch {
      return fail(400, {
        error: 'Invalid credentials. Please verify your email and password.',
        email,
      })
    }

    throw redirect(303, '/')
  },
}

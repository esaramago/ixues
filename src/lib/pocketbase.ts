import PocketBase from 'pocketbase'
import { writable } from 'svelte/store'

export const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'

export const pb = new PocketBase(POCKETBASE_URL)

export const currentUser = writable(pb.authStore.record)

pb.authStore.onChange((_token, model) => {
	currentUser.set(model)
})

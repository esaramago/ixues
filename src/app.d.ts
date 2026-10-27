import type PocketBase from 'pocketbase'
import type { RecordModel } from 'pocketbase'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			pb: PocketBase
			user: RecordModel | null
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}

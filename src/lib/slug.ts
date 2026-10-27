import type PocketBase from 'pocketbase'
import type { RecordModel, RecordOptions } from 'pocketbase'

export function slugify(text: string): string {
  if (!text) return ''
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

export async function generateProjectSlug(
  pb: PocketBase,
  name: string,
  excludeProjectId?: string
): Promise<string> {
  const baseSlug = slugify(name) || 'project'
  let slug = baseSlug
  let counter = 1

  while (true) {
    try {
      const filter = excludeProjectId
        ? `slug = "${slug}" && id != "${excludeProjectId}"`
        : `slug = "${slug}"`
      const existing = await pb.collection('projects').getFirstListItem(filter)
      if (existing) {
        slug = `${baseSlug}-${counter}`
        counter++
      } else {
        break
      }
    } catch {
      break
    }
  }

  return slug
}

export async function generateTaskSlug(
  pb: PocketBase,
  projectId: string,
  title: string,
  excludeTaskId?: string
): Promise<string> {
  const baseSlug = slugify(title) || 'task'
  let slug = baseSlug
  let counter = 1

  while (true) {
    try {
      const filter = excludeTaskId
        ? `project = "${projectId}" && slug = "${slug}" && id != "${excludeTaskId}"`
        : `project = "${projectId}" && slug = "${slug}"`
      const existing = await pb.collection('tasks').getFirstListItem(filter)
      if (existing) {
        slug = `${baseSlug}-${counter}`
        counter++
      } else {
        break
      }
    } catch {
      break
    }
  }

  return slug
}

export async function getProjectByIdOrSlug(
  pb: PocketBase,
  identifier: string
): Promise<RecordModel> {
  try {
    return await pb.collection('projects').getFirstListItem(`slug = "${identifier}"`)
  } catch {
    return await pb.collection('projects').getOne(identifier)
  }
}

export async function getTaskByIdOrSlug(
  pb: PocketBase,
  projectId: string,
  identifier: string,
  options?: RecordOptions
): Promise<RecordModel> {
  const trimmed = identifier.trim()
  const isNumeric = /^\d+$/.test(trimmed)
  if (isNumeric) {
    try {
      return await pb.collection('tasks').getFirstListItem(
        `project = "${projectId}" && number = ${parseInt(trimmed, 10)}`,
        options
      )
    } catch {
      // Continue to try slug or id
    }
  }

  try {
    return await pb.collection('tasks').getFirstListItem(
      `project = "${projectId}" && slug = "${trimmed}"`,
      options
    )
  } catch {
    return await pb.collection('tasks').getOne(trimmed, options)
  }
}

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
        ? pb.filter('slug = {:slug} && id != {:excludeProjectId}', { slug, excludeProjectId })
        : pb.filter('slug = {:slug}', { slug })
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
        ? pb.filter('project = {:projectId} && slug = {:slug} && id != {:excludeTaskId}', {
            projectId,
            slug,
            excludeTaskId
          })
        : pb.filter('project = {:projectId} && slug = {:slug}', { projectId, slug })
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
  identifier: string,
  options?: RecordOptions
): Promise<RecordModel> {
  try {
    return await pb
      .collection('projects')
      .getFirstListItem(pb.filter('slug = {:identifier}', { identifier }), options)
  } catch {
    return await pb.collection('projects').getOne(identifier, options)
  }
}

export async function getProjectByShareToken(
  pb: PocketBase,
  shareToken: string,
  options?: RecordOptions
): Promise<RecordModel> {
  return await pb.collection('projects').getFirstListItem(
    pb.filter('share_token = {:shareToken} && privacy = "public"', { shareToken }),
    options
  )
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
        pb.filter('project = {:projectId} && number = {:number}', {
          projectId,
          number: parseInt(trimmed, 10)
        }),
        options
      )
    } catch {
      // Continue to try slug or id
    }
  }

  try {
    return await pb.collection('tasks').getFirstListItem(
      pb.filter('project = {:projectId} && slug = {:trimmed}', { projectId, trimmed }),
      options
    )
  } catch {
    return await pb.collection('tasks').getOne(trimmed, options)
  }
}

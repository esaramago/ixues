import type PocketBase from 'pocketbase'
import type { Project } from '@/types/project'
import type { ProviderType, UserToken } from '@/types/token'
import { decryptToken, encryptToken, sanitizeUserToken, sanitizeUserTokens } from './crypto'

export async function getUserTokens(pb: PocketBase, userId: string): Promise<UserToken[]> {
  try {
    const records = await pb.collection('user_tokens').getFullList({
      filter: pb.filter('user = {:userId}', { userId }),
      sort: '-created'
    })
    return sanitizeUserTokens(records as unknown as UserToken[])
  } catch {
    try {
      const records = await pb.collection('user_tokens').getFullList({
        filter: pb.filter('user = {:userId}', { userId })
      })
      return sanitizeUserTokens(records as unknown as UserToken[])
    } catch (innerErr) {
      console.warn('Failed to fetch user tokens:', innerErr)
      return []
    }
  }
}

export async function getDecryptedUserToken(
  pb: PocketBase,
  userId: string,
  provider: string
): Promise<string> {
  if (!userId || !provider) return ''

  try {
    const record = await pb.collection('user_tokens').getFirstListItem(
      pb.filter('user = {:userId} && provider = {:provider}', {
        userId,
        provider: provider.toLowerCase()
      })
    )
    if (record?.token) {
      return decryptToken(record.token)
    }
  } catch {
    // No token record found for this user and provider
  }

  return ''
}

export async function resolveProjectToken(
  pb: PocketBase,
  project: Pick<Project, 'type' | 'provider' | 'token' | 'user'> & Partial<Pick<Project, 'user_token'>>,
  userId?: string
): Promise<string> {
  if (project.token) {
    const decrypted = decryptToken(project.token)
    if (decrypted) {
      return decrypted
    }
  }

  if (project.user_token) {
    try {
      const record = await pb.collection('user_tokens').getOne(project.user_token)
      if (record?.token) {
        return decryptToken(record.token)
      }
    } catch {
      // Ignore if user token record deleted or inaccessible
    }
  }

  if (project.type === 'sync' && project.provider) {
    const targetUserId = userId || project.user
    if (targetUserId) {
      return getDecryptedUserToken(pb, targetUserId, project.provider)
    }
  }

  return ''
}

export async function saveUserToken(
  pb: PocketBase,
  userId: string,
  provider: ProviderType,
  token: string,
  name?: string
): Promise<UserToken> {
  const normProvider = provider.toLowerCase() as ProviderType
  const encrypted = encryptToken(token)

  // Check if a token for this provider already exists for the user
  let existingId: string | null = null
  try {
    const existing = await pb.collection('user_tokens').getFirstListItem(
      pb.filter('user = {:userId} && provider = {:provider}', {
        userId,
        provider: normProvider
      })
    )
    if (existing?.id) {
      existingId = existing.id
    }
  } catch {
    // Record does not exist yet
  }

  const payload: Record<string, unknown> = {
    provider: normProvider,
    token: encrypted,
    name: name?.trim() || (normProvider === 'github' ? 'GitHub' : normProvider === 'codeberg' ? 'Codeberg' : 'Jira'),
    user: userId
  }

  if (existingId) {
    const updated = await pb.collection('user_tokens').update(existingId, payload)
    return sanitizeUserToken(updated as unknown as UserToken)
  }

  const created = await pb.collection('user_tokens').create(payload)
  return sanitizeUserToken(created as unknown as UserToken)
}

export async function deleteUserToken(
  pb: PocketBase,
  tokenId: string,
  userId: string
): Promise<void> {
  const record = await pb.collection('user_tokens').getOne(tokenId)
  if (record.user !== userId) {
    throw new Error('Unauthorized to delete this token.')
  }
  await pb.collection('user_tokens').delete(tokenId)
}

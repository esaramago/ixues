import crypto from 'node:crypto'
import { building } from '$app/environment'
import type { Project } from '@/types/project'

const DEFAULT_INSECURE_SECRET = 'ixues-default-token-encryption-secret-key-32'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.POCKETBASE_SECRET

  if (!building && process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim() === '' || secret === DEFAULT_INSECURE_SECRET) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY environment variable is required in production and cannot use the default fallback key.'
      )
    }
    cachedKey = crypto.createHash('sha256').update(secret).digest()
    return cachedKey
  }

  const effectiveSecret = secret || DEFAULT_INSECURE_SECRET
  cachedKey = crypto.createHash('sha256').update(effectiveSecret).digest()
  return cachedKey
}

export function assertEncryptionConfig(): void {
  if (building) return

  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.POCKETBASE_SECRET

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim() === '' || secret === DEFAULT_INSECURE_SECRET) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY environment variable is required in production and cannot use the default fallback key.'
      )
    }
  }
}

// Validate on startup
assertEncryptionConfig()

export function encryptToken(token: string): string {
  if (!token) return ''
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptToken(value: string | null | undefined): string {
  if (!value) return ''
  // For backwards compatibility, if not encrypted, return as-is
  if (!value.startsWith('enc:v1:')) {
    return value
  }

  try {
    const parts = value.split(':')
    if (parts.length !== 5) return ''
    const [, , ivHex, tagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')

    const key = getEncryptionKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err) {
    console.error('Failed to decrypt authentication token:', err)
    return ''
  }
}

export function sanitizeProject(project: Project): Project {
  return {
    ...project,
    has_token: Boolean(project.token),
    token: null
  }
}

export function sanitizeProjects(projects: Project[]): Project[] {
  return projects.map((p) => sanitizeProject(p))
}

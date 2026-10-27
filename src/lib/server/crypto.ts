import crypto from 'node:crypto'
import type { Project } from '@/types/project'

const ENCRYPTION_SECRET =
  process.env.TOKEN_ENCRYPTION_KEY ||
  process.env.ENCRYPTION_KEY ||
  process.env.POCKETBASE_SECRET ||
  'ixues-default-token-encryption-secret-key-32'

// Derive a fixed 32-byte key using sha256
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest()
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

export function encryptToken(token: string): string {
  if (!token) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
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

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
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

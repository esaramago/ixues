import type { Status } from '@/types/status'
import type { User } from '@/types/user'
import {
  TASK_PRIORITIES,
  type Task,
  type TaskBranch,
  type TaskLabel,
  type TaskPriority,
  type TaskRelationship
} from '@/types/task'
import { getDeterministicColor, normalizeHexColor } from '@/lib/colors'
import { slugify } from '@/lib/slug'

export interface CodebergIssueResponse {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  user: {
    id: number
    login: string
    avatar_url: string
  } | null
  assignee: {
    id: number
    login: string
    avatar_url: string
  } | null
  assignees?: Array<{
    id: number
    login: string
    avatar_url: string
  }>
  labels: Array<{
    id: number
    name: string
    color: string
    description?: string
  }>
  created_at: string
  updated_at: string
  pull_request?: unknown
}

export function parseCodebergRepo(repoUrl?: string | null): { owner: string; repo: string } | null {
  if (!repoUrl) return null
  const cleaned = repoUrl.trim().replace(/\.git\/?$/, '')

  try {
    const parsed = new URL(
      cleaned.startsWith('http://') || cleaned.startsWith('https://')
        ? cleaned
        : `https://${cleaned}`
    )
    if (parsed.hostname !== 'codeberg.org' && parsed.hostname !== 'www.codeberg.org') {
      return null
    }
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] }
    }
  } catch {
    const match = cleaned.match(/codeberg\.org\/([^/]+)\/([^/]+)/)
    if (match) {
      return { owner: match[1], repo: match[2] }
    }
  }

  return null
}

function getCodebergHeaders(customToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Ixues-App'
  }

  const token = customToken || process.env.CODEBERG_TOKEN || process.env.VITE_CODEBERG_TOKEN
  if (token) {
    headers.Authorization = `token ${token}`
  }

  return headers
}

export async function fetchCodebergRepoDescription(
  repoUrl?: string | null,
  token?: string | null
): Promise<string | null> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) return null

  try {
    const headers = getCodebergHeaders(token)
    const res = await fetch(`https://codeberg.org/api/v1/repos/${repoInfo.owner}/${repoInfo.repo}`, {
      headers
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.description || null
  } catch (err) {
    console.error('Failed to fetch Codeberg repo description:', err)
    return null
  }
}

function extractPriority(
  labels: Array<{ name?: string } | string>
): TaskPriority | null {
  for (const label of labels) {
    const name = typeof label === 'string' ? label : label.name || ''
    const parsed = parseCodebergPriorityLabel(name)
    if (parsed) return parsed
  }

  for (const label of labels) {
    const name = (typeof label === 'string' ? label : label.name || '').toLowerCase()
    if (!name || isCodebergStatusLabel(name) || isCodebergPriorityLabel(name)) continue
    if (/\b(urgent|critical)\b/.test(name) || name === 'p0') {
      return 'urgent'
    }
    if (/\bhigh\b/.test(name) || name === 'p1') {
      return 'high'
    }
    if (/\bmedium\b/.test(name) || name === 'p2') {
      return 'medium'
    }
    if (/\blowest\b/.test(name) || name === 'p4') {
      return 'lowest'
    }
    if (/\blow\b/.test(name) || name === 'p3') {
      return 'low'
    }
  }
  return null
}

export function isCodebergStatusLabel(labelName: string): boolean {
  return /^status:\s*.+$/i.test(labelName.trim())
}

export function formatCodebergStatusLabel(statusName: string): string {
  return `status: ${statusName.trim().toLowerCase()}`
}

export function parseCodebergStatusLabel(labelName: string): string | null {
  const match = labelName.trim().match(/^status:\s*(.+)$/i)
  return match ? match[1].trim() : null
}

export function isCodebergPriorityLabel(labelName: string): boolean {
  return /^priority:\s*.+$/i.test(labelName.trim())
}

export function formatCodebergPriorityLabel(priority: TaskPriority | string): string {
  return `priority: ${priority.trim().toLowerCase()}`
}

export function parseCodebergPriorityLabel(labelName: string): TaskPriority | null {
  const match = labelName.trim().match(/^priority:\s*(.+)$/i)
  if (!match) return null
  const value = match[1].trim().toLowerCase()
  return TASK_PRIORITIES.includes(value as TaskPriority) ? (value as TaskPriority) : null
}

const CODEBERG_PRIORITY_LABEL_COLORS: Record<TaskPriority, string> = {
  urgent: 'b42318',
  high: 'd97706',
  medium: '2563eb',
  low: '15803d',
  lowest: '6b7280'
}

export function matchStatusByNameOrKey(
  statusString: string,
  statuses: Status[]
): Status | undefined {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_:]+/g, '')
  const target = normalize(statusString)
  return statuses.find((s) => {
    if (normalize(s.name) === target) return true
    if (s.key && normalize(s.key) === target) return true
    if (normalize(s.id) === target) return true
    return false
  })
}

export function isClosedStatus(status: { name?: string; key?: string | null; id?: string }): boolean {
  const norm = (status.key || status.name || status.id || '').toLowerCase().trim()
  return (
    norm === 'closed' ||
    norm === 'done' ||
    norm === 'resolved' ||
    norm === 'completed' ||
    norm === 'released' ||
    norm === 'abandoned'
  )
}

export function isNativeCodebergStatus(
  status: { name?: string; key?: string | null; id?: string } | string
): boolean {
  const raw =
    typeof status === 'string'
      ? status
      : status.key || status.name || status.id || ''
  const norm = raw.toLowerCase().trim()
  return norm === 'open' || norm === 'closed'
}

function formatCodebergErrorMessage(status: number, apiMessage?: string, fallback?: string): string {
  if (status === 429) {
    return 'Codeberg rate limit reached. Please wait a moment and try again.'
  }
  if (status === 403) {
    return apiMessage || 'Permission denied. Please verify your Codeberg access token permissions.'
  }
  return apiMessage || fallback || `Codeberg API error (HTTP ${status})`
}

async function fetchCodeberg(
  url: string,
  init?: RequestInit,
  retries = 1
): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status === 429 && retries > 0) {
    const retryAfter = res.headers.get('retry-after')
    const delay = retryAfter ? Math.min(Math.max(parseInt(retryAfter, 10), 1), 3) * 1000 : 1500
    await new Promise((resolve) => setTimeout(resolve, delay))
    return fetch(url, init)
  }
  return res
}

interface CacheEntry<T> {
  data: T
  expires: number
}

const labelCache = new Map<string, CacheEntry<RawCodebergLabel[]>>()
const assigneeCache = new Map<string, CacheEntry<User[]>>()

export function invalidateCodebergRepoCache(repoUrl?: string | null): void {
  if (!repoUrl) return
  const info = parseCodebergRepo(repoUrl)
  if (!info) return
  const key = `${info.owner}/${info.repo}`.toLowerCase()
  labelCache.delete(key)
  assigneeCache.delete(key)
}

export function getDefaultCodebergStatuses(projectId: string, userId: string): Status[] {
  return [
    {
      id: 'open',
      name: 'Open',
      order: 0,
      color: '#2da44e',
      project: projectId,
      user: userId,
      key: 'open'
    },
    {
      id: 'closed',
      name: 'Closed',
      order: 1,
      color: '#8250df',
      project: projectId,
      user: userId,
      key: 'closed'
    }
  ]
}

export interface RawCodebergLabel {
  id: number
  name: string
  color: string
}

export async function listCodebergRepoRawLabels(
  repoUrl: string,
  token?: string | null
): Promise<RawCodebergLabel[]> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) return []
  const { owner, repo } = repoInfo
  const cacheKey = `${owner}/${repo}`.toLowerCase()

  const cached = labelCache.get(cacheKey)
  if (cached && Date.now() < cached.expires) {
    return cached.data
  }

  const headers = getCodebergHeaders(token)
  try {
    const res = await fetchCodeberg(`https://codeberg.org/api/v1/repos/${owner}/${repo}/labels?limit=100`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        labelCache.set(cacheKey, { data, expires: Date.now() + 60_000 })
        return data
      }
    }
  } catch (err) {
    console.error('Failed to list Codeberg labels:', err)
  }

  return []
}

export async function fetchCodebergStatuses(
  repoUrl?: string | null,
  projectId?: string,
  userId?: string,
  token?: string | null
): Promise<Status[]> {
  const defaults = getDefaultCodebergStatuses(projectId || '', userId || '')
  if (!repoUrl) return defaults

  try {
    const labels = await listCodebergRepoRawLabels(repoUrl, token)
    const statusLabels = labels.filter((l) => l.name && isCodebergStatusLabel(l.name))
    if (statusLabels.length === 0) {
      return defaults
    }

    const discovered: Status[] = statusLabels.map((l, index) => {
      const rawName = l.name ? parseCodebergStatusLabel(l.name) || l.name : ''
      const displayName = rawName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      const key = slugify(rawName)
      return {
        id: key,
        name: displayName,
        order: index + 1,
        color: l.color ? `#${l.color.replace(/^#/, '')}` : '#6b7280',
        project: projectId || '',
        user: userId || '',
        key
      }
    })

    const openStatus = defaults[0]
    const closedStatus = defaults[1]
    closedStatus.order = discovered.length + 1

    return [openStatus, ...discovered, closedStatus]
  } catch (err) {
    console.error('Failed to fetch Codeberg statuses from labels:', err)
    return defaults
  }
}

export async function fetchCodebergLabels(
  repoUrl?: string | null,
  token?: string | null
): Promise<TaskLabel[]> {
  if (!repoUrl) return []

  try {
    const labels = await listCodebergRepoRawLabels(repoUrl, token)
    return labels
      .filter(
        (l) =>
          Boolean(l.name) &&
          !isCodebergStatusLabel(l.name || '') &&
          !isCodebergPriorityLabel(l.name || '')
      )
      .map((l) => {
        const name = l.name || ''
        const rawColor = l.color ? `#${l.color.replace(/^#/, '')}` : undefined
        return {
          name,
          color: normalizeHexColor(rawColor) || getDeterministicColor(name)
        }
      })
  } catch (err) {
    console.error('Failed to fetch Codeberg repository labels:', err)
    return []
  }
}

export async function fetchCodebergAssignees(
  repoUrl?: string | null,
  token?: string | null
): Promise<User[]> {
  if (!repoUrl) return []
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) return []
  const { owner, repo } = repoInfo
  const cacheKey = `${owner}/${repo}`.toLowerCase()

  const cached = assigneeCache.get(cacheKey)
  if (cached && Date.now() < cached.expires) {
    return cached.data
  }

  const headers = getCodebergHeaders(token)
  const users: User[] = []
  const seenLogins = new Set<string>()

  try {
    const res = await fetchCodeberg(`https://codeberg.org/api/v1/repos/${owner}/${repo}/assignees?limit=100`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        for (const u of data) {
          if (u && u.login && !seenLogins.has(u.login.toLowerCase())) {
            seenLogins.add(u.login.toLowerCase())
            users.push({
              id: u.login,
              name: u.full_name || u.login,
              username: u.login,
              email: u.email || undefined,
              avatar: u.avatar_url || undefined
            })
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch Codeberg repo assignees:', err)
  }

  // Also include the authenticated user if available
  if (token) {
    try {
      const res = await fetchCodeberg('https://codeberg.org/api/v1/user', { headers })
      if (res.ok) {
        const u = await res.json()
        if (u && u.login && !seenLogins.has(u.login.toLowerCase())) {
          seenLogins.add(u.login.toLowerCase())
          users.unshift({
            id: u.login,
            name: u.full_name || u.login,
            username: u.login,
            email: u.email || undefined,
            avatar: u.avatar_url || undefined
          })
        }
      }
    } catch {}
  }

  // Also include repository owner (for personal repos, owner is always an eligible assignee)
  if (!seenLogins.has(owner.toLowerCase())) {
    try {
      const res = await fetchCodeberg(`https://codeberg.org/api/v1/users/${owner}`, { headers })
      if (res.ok) {
        const u = await res.json()
        if (u && u.login && !seenLogins.has(u.login.toLowerCase())) {
          seenLogins.add(u.login.toLowerCase())
          users.push({
            id: u.login,
            name: u.full_name || u.login,
            username: u.login,
            email: u.email || undefined,
            avatar: u.avatar_url || undefined
          })
        }
      }
    } catch {}
  }

  assigneeCache.set(cacheKey, { data: users, expires: Date.now() + 60_000 })
  return users
}

export function mapCodebergIssueToTask(
  issue: CodebergIssueResponse,
  projectId: string,
  userId: string,
  extra?: {
    statuses?: Status[]
    relationships?: TaskRelationship[]
    branches?: TaskBranch[]
  }
): Task {
  const priority = extractPriority(issue.labels || [])

  let taskStatus: string | undefined

  if (extra?.statuses && extra.statuses.length > 0) {
    for (const label of issue.labels || []) {
      const name = typeof label === 'string' ? label : label.name || ''
      const statusName = parseCodebergStatusLabel(name)
      if (statusName) {
        const matched = matchStatusByNameOrKey(statusName, extra.statuses)
        if (matched) {
          taskStatus = matched.id
          break
        }
      }
    }

    if (!taskStatus) {
      if (issue.state === 'closed') {
        const closed = extra.statuses.find(isClosedStatus) || extra.statuses[extra.statuses.length - 1]
        taskStatus = closed ? closed.id : 'closed'
      } else {
        const open = extra.statuses.find((s) => !isClosedStatus(s)) || extra.statuses[0]
        taskStatus = open ? open.id : 'open'
      }
    }
  } else {
    taskStatus = issue.state === 'closed' ? 'closed' : 'open'
  }

  const contentLabels: TaskLabel[] = (issue.labels || [])
    .map((l) => {
      const name = typeof l === 'string' ? l : l.name || ''
      const rawColor = typeof l === 'string' ? undefined : (l.color ? `#${l.color.replace(/^#/, '')}` : undefined)
      const color = normalizeHexColor(rawColor) || getDeterministicColor(name)
      return { name, color }
    })
    .filter(
      (l) => Boolean(l.name) && !isCodebergStatusLabel(l.name) && !isCodebergPriorityLabel(l.name)
    )

  const assigneeUser = issue.assignee || (issue.assignees && issue.assignees[0]) || null

  return {
    id: String(issue.number),
    number: issue.number,
    title: issue.title,
    slug: slugify(issue.title),
    description: issue.body || '',
    priority,
    status: taskStatus,
    project: projectId,
    user: userId,
    assigned: assigneeUser?.login || null,
    url: issue.html_url,
    labels: contentLabels,
    relationships: extra?.relationships || [],
    branches: extra?.branches || [],
    expand: {
      ...(assigneeUser
        ? {
            assigned: {
              id: String(assigneeUser.id),
              name: assigneeUser.login,
              username: assigneeUser.login,
              avatar: assigneeUser.avatar_url
            }
          }
        : {}),
      ...(issue.user
        ? {
            user: {
              id: String(issue.user.id),
              name: issue.user.login,
              username: issue.user.login,
              avatar: issue.user.avatar_url
            }
          }
        : {})
    },
    created: issue.created_at,
    updated: issue.updated_at
  }
}

export async function fetchCodebergIssues(
  repoUrl: string,
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task[]> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid Codeberg repository URL')
  }

  const { owner, repo } = repoInfo
  const url = `https://codeberg.org/api/v1/repos/${owner}/${repo}/issues?state=all&limit=100&type=issues`

  const response = await fetchCodeberg(url, {
    headers: getCodebergHeaders(token)
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found or is private.`)
    }
    if (response.status === 403) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(data?.message || 'Codeberg API rate limit exceeded or access forbidden.')
    }
    throw new Error(`Failed to fetch issues from Codeberg (HTTP ${response.status})`)
  }

  const data = (await response.json()) as CodebergIssueResponse[]
  const issuesOnly = data.filter((item) => !item.pull_request)

  return issuesOnly.map((issue) => mapCodebergIssueToTask(issue, projectId, userId, { statuses }))
}

export async function fetchCodebergBranches(
  repoUrl: string,
  issueNumber: number | string,
  token?: string | null
): Promise<TaskBranch[]> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) {
    return []
  }

  const { owner, repo } = repoInfo
  const branches: TaskBranch[] = []

  try {
    const res = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/branches?limit=100`, {
      headers: getCodebergHeaders(token)
    })

    if (res.ok) {
      const data = (await res.json()) as Array<{ name: string }>
      if (Array.isArray(data)) {
        const numStr = String(issueNumber).trim()
        for (const branch of data) {
          const branchName = branch.name.toLowerCase()
          const isLinked =
            branchName.includes(`issue-${numStr}`) ||
            branchName.includes(`issue/${numStr}`) ||
            branchName.includes(`#${numStr}`) ||
            branchName.includes(`/${numStr}-`) ||
            branchName.includes(`-${numStr}-`) ||
            branchName.startsWith(`${numStr}-`) ||
            branchName.endsWith(`-${numStr}`)

          if (isLinked) {
            branches.push({
              name: branch.name,
              url: `https://codeberg.org/${owner}/${repo}/src/branch/${encodeURIComponent(branch.name)}`
            })
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch Codeberg branches:', err)
  }

  return branches
}

export async function fetchCodebergRelationships(
  repoUrl: string,
  issueNumber: number | string,
  token?: string | null
): Promise<TaskRelationship[]> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) {
    return []
  }

  const { owner, repo } = repoInfo
  const num = parseInt(String(issueNumber).trim(), 10)
  if (isNaN(num)) return []

  const relationships: TaskRelationship[] = []

  try {
    const response = await fetch(
      `https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}/dependencies`,
      {
        headers: getCodebergHeaders(token)
      }
    )

    if (response.ok) {
      const data = (await response.json()) as Array<{
        id: number
        number: number
        title: string
      }>
      if (Array.isArray(data)) {
        for (const item of data) {
          relationships.push({
            type: 'blocked_by',
            taskId: String(item.number || item.id),
            taskNumber: item.number,
            taskTitle: item.title
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch dependencies from Codeberg:', err)
  }

  try {
    const response = await fetch(
      `https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}/blocks`,
      {
        headers: getCodebergHeaders(token)
      }
    )

    if (response.ok) {
      const data = (await response.json()) as Array<{
        id: number
        number: number
        title: string
      }>
      if (Array.isArray(data)) {
        for (const item of data) {
          relationships.push({
            type: 'blocks',
            taskId: String(item.number || item.id),
            taskNumber: item.number,
            taskTitle: item.title
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch blocking issues from Codeberg:', err)
  }

  return relationships
}

export async function fetchCodebergIssue(
  repoUrl: string,
  issueNumber: number | string,
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task | null> {
  const isNumeric = /^\d+$/.test(String(issueNumber).trim())
  if (!isNumeric) {
    const allIssues = await fetchCodebergIssues(repoUrl, projectId, userId, token, statuses)
    return allIssues.find((t) => t.slug === issueNumber || t.id === String(issueNumber)) || null
  }

  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid Codeberg repository URL')
  }

  const { owner, repo } = repoInfo
  const num = parseInt(String(issueNumber).trim(), 10)
  const url = `https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`

  const response = await fetch(url, {
    headers: getCodebergHeaders(token)
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to fetch issue #${num} from Codeberg (HTTP ${response.status})`)
  }

  const data = (await response.json()) as CodebergIssueResponse

  const [relationships, branches] = await Promise.all([
    fetchCodebergRelationships(repoUrl, num, token),
    fetchCodebergBranches(repoUrl, num, token)
  ])

  return mapCodebergIssueToTask(data, projectId, userId, {
    statuses,
    relationships,
    branches
  })
}

export async function createCodebergLabel(
  repoUrl: string,
  name: string,
  color?: string | null,
  token?: string | null,
  description?: string
): Promise<RawCodebergLabel | null> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid Codeberg repository URL')
  }
  const { owner, repo } = repoInfo
  const rawColor = (color || '#6b7280').replace(/^#/, '')

  const res = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    headers: {
      ...getCodebergHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      color: rawColor,
      description: description || ''
    })
  })

  if (!res.ok) {
    if (res.status === 409 || res.status === 422) {
      const labels = await listCodebergRepoRawLabels(repoUrl, token)
      return labels.find((l) => l.name.toLowerCase() === name.toLowerCase()) || null
    }
    const data = await res.json().catch(() => null)
    throw new Error(formatCodebergErrorMessage(res.status, data?.message, 'Failed to create Codeberg label.'))
  }

  return (await res.json()) as RawCodebergLabel
}

export async function ensureCodebergLabelExists(
  repoUrl: string,
  name: string,
  color?: string | null,
  token?: string | null
): Promise<RawCodebergLabel | null> {
  const existingLabels = await listCodebergRepoRawLabels(repoUrl, token)
  const existing = existingLabels.find((l) => l.name.toLowerCase() === name.toLowerCase())

  if (!existing) {
    return await createCodebergLabel(repoUrl, name, color, token)
  } else if (color) {
    const rawColor = color.replace(/^#/, '')
    if (existing.color && existing.color.toLowerCase() !== rawColor.toLowerCase()) {
      await updateCodebergLabel(repoUrl, existing.id, { color: rawColor }, token).catch(() => {})
      existing.color = rawColor
    }
  }
  return existing
}

export async function resolveCodebergLabelIds(
  repoUrl: string,
  labels: Array<{ name: string; color?: string | null } | string>,
  token?: string | null
): Promise<number[]> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo || labels.length === 0) return []

  const existingLabels = await listCodebergRepoRawLabels(repoUrl, token)
  const labelMap = new Map<string, RawCodebergLabel>()
  for (const l of existingLabels) {
    if (l && l.name) {
      labelMap.set(l.name.toLowerCase(), l)
    }
  }

  const ids: number[] = []
  const seenIds = new Set<number>()

  for (const item of labels) {
    const name = (typeof item === 'string' ? item : item.name).trim()
    if (!name) continue
    const color = typeof item === 'string' ? null : item.color

    const lower = name.toLowerCase()
    let label = labelMap.get(lower)

    if (!label) {
      try {
        const created = await createCodebergLabel(repoUrl, name, color, token)
        if (created) {
          label = created
          labelMap.set(lower, created)
        }
      } catch (err) {
        console.error(`Failed to create Codeberg label "${name}":`, err)
      }
    } else if (color) {
      const rawColor = color.replace(/^#/, '')
      if (label.color && label.color.toLowerCase() !== rawColor.toLowerCase()) {
        await updateCodebergLabel(repoUrl, label.id, { color: rawColor }, token).catch(() => {})
        label.color = rawColor
      }
    }

    if (label && typeof label.id === 'number' && !seenIds.has(label.id)) {
      seenIds.add(label.id)
      ids.push(label.id)
    }
  }

  return ids
}

export async function updateCodebergLabel(
  repoUrl: string,
  labelId: number,
  updates: { name?: string; color?: string; description?: string },
  token?: string | null
): Promise<void> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) throw new Error('Invalid Codeberg repository URL')
  const { owner, repo } = repoInfo

  const body: Record<string, unknown> = {}
  if (updates.name !== undefined) body.name = updates.name
  if (updates.color !== undefined) body.color = updates.color.replace(/^#/, '')
  if (updates.description !== undefined) body.description = updates.description

  const res = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/labels/${labelId}`, {
    method: 'PATCH',
    headers: {
      ...getCodebergHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(formatCodebergErrorMessage(res.status, data?.message, 'Failed to update Codeberg label.'))
  }
}

export async function renameCodebergLabel(
  repoUrl: string,
  oldName: string,
  newName: string,
  color?: string | null,
  token?: string | null
): Promise<void> {
  const labels = await listCodebergRepoRawLabels(repoUrl, token)
  const existing = labels.find((l) => l.name.toLowerCase() === oldName.toLowerCase())
  if (!existing) {
    await ensureCodebergLabelExists(repoUrl, newName, color, token)
    return
  }

  await updateCodebergLabel(
    repoUrl,
    existing.id,
    {
      name: newName,
      ...(color ? { color: color.replace(/^#/, '') } : {})
    },
    token
  )
}

export async function deleteCodebergLabel(
  repoUrl: string,
  labelName: string,
  token?: string | null
): Promise<void> {
  const labels = await listCodebergRepoRawLabels(repoUrl, token)
  const existing = labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase())
  if (!existing) return

  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) return
  const { owner, repo } = repoInfo

  const res = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/labels/${existing.id}`, {
    method: 'DELETE',
    headers: getCodebergHeaders(token)
  })

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => null)
    throw new Error(formatCodebergErrorMessage(res.status, data?.message, 'Failed to delete Codeberg label.'))
  }
}

export async function updateCodebergIssueStatus(
  repoUrl: string,
  issueNumber: number | string,
  statusId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<void> {
  const num = parseInt(String(issueNumber).trim(), 10)
  if (isNaN(num)) {
    throw new Error(`Invalid issue number: ${issueNumber}`)
  }

  const matched = statuses ? matchStatusByNameOrKey(statusId, statuses) : null
  const statusName = matched ? matched.name : statusId
  const isClosed = matched ? isClosedStatus(matched) : statusId === 'closed'
  const isNative = isNativeCodebergStatus(matched || statusName)
  const desiredState = isClosed ? 'closed' : 'open'

  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) throw new Error('Invalid Codeberg repository URL')
  const { owner, repo } = repoInfo

  const issueRes = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`, {
    headers: getCodebergHeaders(token)
  })
  if (!issueRes.ok) {
    throw new Error(`Failed to fetch issue #${num} from Codeberg`)
  }
  const currentIssue = (await issueRes.json()) as CodebergIssueResponse

  const currentLabels = (currentIssue.labels || []).map((l) => l.name)
  const otherLabels = currentLabels.filter((l) => !isCodebergStatusLabel(l))

  const newStatusLabel = formatCodebergStatusLabel(statusName)
  const labelSpecs: Array<{ name: string; color?: string | null }> = otherLabels.map((name) => ({ name }))

  if (!isNative) {
    labelSpecs.push({
      name: newStatusLabel,
      color: matched?.color
    })
  }

  const patchRes = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`, {
    method: 'PATCH',
    headers: {
      ...getCodebergHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ state: desiredState })
  })

  if (!patchRes.ok) {
    const data = await patchRes.json().catch(() => null)
    throw new Error(formatCodebergErrorMessage(patchRes.status, data?.message, 'Failed to update issue status'))
  }

  const labelIds = await resolveCodebergLabelIds(repoUrl, labelSpecs, token)

  const labelsRes = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}/labels`, {
    method: 'PUT',
    headers: {
      ...getCodebergHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ labels: labelIds })
  })

  if (!labelsRes.ok) {
    const data = await labelsRes.json().catch(() => null)
    throw new Error(formatCodebergErrorMessage(labelsRes.status, data?.message, 'Failed to update issue labels'))
  }
}

export async function updateCodebergIssue(
  repoUrl: string,
  issueNumber: number | string,
  updates: {
    title?: string
    body?: string
    state?: 'open' | 'closed'
    labels?: string[]
    status?: string
    priority?: TaskPriority | null
    relationships?: TaskRelationship[]
    assigned?: string | null
  },
  token?: string | null,
  statuses?: Status[]
): Promise<void> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) throw new Error('Invalid Codeberg repository URL')
  const { owner, repo } = repoInfo

  const num = parseInt(String(issueNumber).trim(), 10)
  if (isNaN(num)) throw new Error(`Invalid issue number: ${issueNumber}`)

  const issueRes = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`, {
    headers: getCodebergHeaders(token)
  })
  if (!issueRes.ok) throw new Error(`Failed to fetch issue #${num}`)
  const currentIssue = (await issueRes.json()) as CodebergIssueResponse

  const currentLabelNames = (currentIssue.labels || []).map((l) => l.name)
  const baseLabels = updates.labels !== undefined ? updates.labels : currentLabelNames
  const labelSpecs: Array<{ name: string; color?: string | null }> = baseLabels
    .filter((l) => !isCodebergStatusLabel(l) && !isCodebergPriorityLabel(l))
    .map((name) => ({ name }))

  let state = updates.state

  if (updates.status) {
    const matchedStatus = statuses ? matchStatusByNameOrKey(updates.status, statuses) : null
    const statusName = matchedStatus ? matchedStatus.name : updates.status
    const isClosed = matchedStatus ? isClosedStatus(matchedStatus) : updates.status === 'closed'
    const isNative = isNativeCodebergStatus(matchedStatus || statusName)
    state = isClosed ? 'closed' : 'open'

    const newStatusLabel = formatCodebergStatusLabel(statusName)
    if (!isNative) {
      labelSpecs.push({
        name: newStatusLabel,
        color: matchedStatus?.color
      })
    }
  } else {
    const existingStatus = currentLabelNames.find(isCodebergStatusLabel)
    if (existingStatus) labelSpecs.push({ name: existingStatus })
  }

  if (updates.priority !== undefined) {
    if (updates.priority) {
      const priorityLabel = formatCodebergPriorityLabel(updates.priority)
      labelSpecs.push({
        name: priorityLabel,
        color: CODEBERG_PRIORITY_LABEL_COLORS[updates.priority]
      })
    }
  } else {
    const existingPriority = currentLabelNames.find(isCodebergPriorityLabel)
    if (existingPriority) labelSpecs.push({ name: existingPriority })
  }

  const patchBody: Record<string, unknown> = {}
  if (updates.title !== undefined) patchBody.title = updates.title
  if (updates.body !== undefined) patchBody.body = updates.body
  if (state !== undefined) patchBody.state = state
  if (updates.assigned !== undefined) {
    patchBody.assignees = updates.assigned ? [updates.assigned.trim()] : []
  }

  if (Object.keys(patchBody).length > 0) {
    const response = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`, {
      method: 'PATCH',
      headers: {
        ...getCodebergHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      throw new Error(
        formatCodebergErrorMessage(
          response.status,
          errorData?.message,
          `Failed to update Codeberg issue (HTTP ${response.status})`
        )
      )
    }
  }

  const shouldUpdateLabels =
    updates.labels !== undefined ||
    updates.status !== undefined ||
    updates.priority !== undefined

  if (shouldUpdateLabels) {
    const labelIds = await resolveCodebergLabelIds(repoUrl, labelSpecs, token)
    const labelsRes = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}/labels`, {
      method: 'PUT',
      headers: {
        ...getCodebergHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ labels: labelIds })
    })

    if (!labelsRes.ok) {
      const data = await labelsRes.json().catch(() => null)
      throw new Error(formatCodebergErrorMessage(labelsRes.status, data?.message, 'Failed to update issue labels'))
    }
  }
}

export async function createCodebergIssue(
  repoUrl: string,
  data: {
    title: string
    body?: string
    status?: string
    labels?: string[]
    priority?: TaskPriority | null
    assigned?: string | null
  },
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) throw new Error('Invalid Codeberg repository URL')
  const { owner, repo } = repoInfo

  const labelSpecs: Array<{ name: string; color?: string | null }> = []

  for (const labelName of data.labels || []) {
    if (!isCodebergStatusLabel(labelName) && !isCodebergPriorityLabel(labelName)) {
      labelSpecs.push({ name: labelName })
    }
  }

  let matchedStatus: Status | null = null
  let isClosed = false

  if (data.status) {
    matchedStatus = statuses ? matchStatusByNameOrKey(data.status, statuses) || null : null
    const statusName = matchedStatus ? matchedStatus.name : data.status
    isClosed = matchedStatus ? isClosedStatus(matchedStatus) : data.status === 'closed'
    const isNative = isNativeCodebergStatus(matchedStatus || statusName)

    if (!isNative) {
      const statusLabel = formatCodebergStatusLabel(statusName)
      labelSpecs.push({
        name: statusLabel,
        color: matchedStatus?.color
      })
    }
  }

  if (data.priority) {
    const priorityLabel = formatCodebergPriorityLabel(data.priority)
    labelSpecs.push({
      name: priorityLabel,
      color: CODEBERG_PRIORITY_LABEL_COLORS[data.priority]
    })
  }

  const labelIds = await resolveCodebergLabelIds(repoUrl, labelSpecs, token)

  const createPayload: Record<string, unknown> = {
    title: data.title,
    body: data.body || '',
    labels: labelIds,
    closed: isClosed
  }

  const response = await fetchCodeberg(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      ...getCodebergHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(
      formatCodebergErrorMessage(
        response.status,
        errorData?.message,
        `Failed to create Codeberg issue (HTTP ${response.status})`
      )
    )
  }

  const createdIssue = (await response.json()) as CodebergIssueResponse

  const patchUpdates: Record<string, unknown> = {}
  if (data.assigned) {
    patchUpdates.assignees = [data.assigned.trim()]
  }
  if (isClosed && createdIssue.state !== 'closed') {
    patchUpdates.state = 'closed'
  }

  if (Object.keys(patchUpdates).length > 0) {
    const patchRes = await fetchCodeberg(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${createdIssue.number}`, {
      method: 'PATCH',
      headers: {
        ...getCodebergHeaders(token),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchUpdates)
    }).catch(() => null)

    if (patchRes && patchRes.ok) {
      const patched = (await patchRes.json().catch(() => null)) as CodebergIssueResponse | null
      if (patched) {
        if (patched.assignee) createdIssue.assignee = patched.assignee
        if (patched.assignees) createdIssue.assignees = patched.assignees
        if (patched.state) createdIssue.state = patched.state
      }
    } else if (isClosed) {
      createdIssue.state = 'closed'
    }
  }

  invalidateCodebergRepoCache(repoUrl)
  return mapCodebergIssueToTask(createdIssue, projectId, userId, { statuses })
}

export async function deleteCodebergIssue(
  repoUrl: string,
  issueNumber: number | string,
  token?: string | null
): Promise<void> {
  const repoInfo = parseCodebergRepo(repoUrl)
  if (!repoInfo) throw new Error('Invalid Codeberg repository URL')
  const { owner, repo } = repoInfo
  const num = parseInt(String(issueNumber).trim(), 10)
  if (isNaN(num)) throw new Error(`Invalid issue number: ${issueNumber}`)

  const res = await fetch(`https://codeberg.org/api/v1/repos/${owner}/${repo}/issues/${num}`, {
    method: 'DELETE',
    headers: getCodebergHeaders(token)
  })

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(
      formatCodebergErrorMessage(
        res.status,
        data?.message,
        `Failed to delete Codeberg issue (HTTP ${res.status})`
      )
    )
  }
}

import type { Status } from '@/types/status'
import type { Task, TaskBranch, TaskLabel, TaskPriority, TaskRelationship } from '@/types/task'
import { getDeterministicColor, normalizeHexColor } from '@/lib/colors'
import { slugify } from '@/lib/slug'

export interface GitHubIssueResponse {
  id: number
  node_id: string
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
  labels: Array<
    | {
        id: number
        name: string
        color: string
        description?: string
      }
    | string
  >
  created_at: string
  updated_at: string
  pull_request?: unknown
}

export function parseGitHubRepo(repoUrl?: string | null): { owner: string; repo: string } | null {
  if (!repoUrl) return null
  const cleaned = repoUrl.trim().replace(/\.git\/?$/, '')

  try {
    const parsed = new URL(
      cleaned.startsWith('http://') || cleaned.startsWith('https://')
        ? cleaned
        : `https://${cleaned}`
    )
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      return null
    }
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] }
    }
  } catch {
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (match) {
      return { owner: match[1], repo: match[2] }
    }
  }

  return null
}

export async function fetchGitHubRepoDescription(
  repoUrl?: string | null,
  token?: string | null
): Promise<string | null> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) return null

  try {
    const headers = getGitHubHeaders(token)
    const res = await fetch(`https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`, {
      headers
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.description || null
  } catch (err) {
    console.error('Failed to fetch GitHub repo description:', err)
    return null
  }
}

function getGitHubHeaders(customToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Ixues-App',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  const token = customToken || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function extractPriority(
  labels: Array<{ name?: string } | string>
): TaskPriority | null {
  for (const label of labels) {
    const name = (typeof label === 'string' ? label : label.name || '').toLowerCase()
    if (name.includes('urgent') || name.includes('critical') || name === 'p0') {
      return 'urgent'
    }
    if (name.includes('high') || name === 'p1') {
      return 'high'
    }
    if (name.includes('medium') || name === 'p2') {
      return 'medium'
    }
    if (name.includes('lowest') || name === 'p4') {
      return 'lowest'
    }
    if (name.includes('low') || name === 'p3') {
      return 'low'
    }
  }
  return null
}

export function isGitHubStatusLabel(labelName: string): boolean {
  return /^status:\s*.+$/i.test(labelName.trim())
}

export function formatGitHubStatusLabel(statusName: string): string {
  return `status: ${statusName.trim().toLowerCase()}`
}

export function parseGitHubStatusLabel(labelName: string): string | null {
  const match = labelName.trim().match(/^status:\s*(.+)$/i)
  return match ? match[1].trim() : null
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

export function getDefaultGitHubStatuses(projectId: string, userId: string): Status[] {
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

export async function fetchGitHubStatuses(
  repoUrl?: string | null,
  projectId?: string,
  userId?: string,
  token?: string | null
): Promise<Status[]> {
  const defaults = getDefaultGitHubStatuses(projectId || '', userId || '')
  if (!repoUrl) return defaults

  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) return defaults

  try {
    const { owner, repo } = repoInfo
    const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`
    const res = await fetch(url, {
      headers: getGitHubHeaders(token)
    })

    if (!res.ok) return defaults

    const labels = (await res.json()) as Array<{ name?: string; color?: string }>
    if (!Array.isArray(labels)) return defaults

    const statusLabels = labels.filter((l) => l.name && isGitHubStatusLabel(l.name))
    if (statusLabels.length === 0) {
      return defaults
    }

    const discovered: Status[] = statusLabels.map((l, index) => {
      const rawName = l.name ? parseGitHubStatusLabel(l.name) || l.name : ''
      const displayName = rawName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
      const key = slugify(rawName)
      return {
        id: key,
        name: displayName,
        order: index + 1,
        color: l.color ? `#${l.color}` : '#6b7280',
        project: projectId || '',
        user: userId || '',
        key
      }
    })

    const hasOpen = discovered.some((s) => s.key === 'open' || s.name.toLowerCase() === 'open')
    const hasClosed = discovered.some((s) => isClosedStatus(s))

    const result: Status[] = []
    if (!hasOpen) {
      result.push(defaults[0])
    }
    result.push(...discovered)
    if (!hasClosed) {
      result.push(defaults[1])
    }

    return result.map((s, index) => ({ ...s, order: index }))
  } catch {
    return defaults
  }
}

export function getGitHubStatuses(projectId: string, userId: string): Status[] {
  return getDefaultGitHubStatuses(projectId, userId)
}

export function mapGitHubIssueToTask(
  issue: GitHubIssueResponse,
  projectId: string,
  userId: string,
  extra?: {
    relationships?: TaskRelationship[]
    branches?: TaskBranch[]
    statuses?: Status[]
  }
): Task {
  const priority = extractPriority(issue.labels || [])
  const allLabelNames = (issue.labels || [])
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter(Boolean)

  let taskStatus: string | null = null

  if (extra?.statuses && extra.statuses.length > 0) {
    for (const label of allLabelNames) {
      const parsed = parseGitHubStatusLabel(label)
      if (parsed) {
        const matched = matchStatusByNameOrKey(parsed, extra.statuses)
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
      const rawColor = typeof l === 'string' ? undefined : l.color
      const color = normalizeHexColor(rawColor) || getDeterministicColor(name)
      return { name, color }
    })
    .filter((l) => Boolean(l.name) && !isGitHubStatusLabel(l.name))

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
    assigned: issue.assignee?.login || null,
    url: issue.html_url,
    labels: contentLabels,
    relationships: extra?.relationships || [],
    branches: extra?.branches || [],
    expand: issue.assignee
      ? {
          assigned: {
            id: String(issue.assignee.id),
            name: issue.assignee.login,
            avatar: issue.assignee.avatar_url
          }
        }
      : undefined,
    created: issue.created_at,
    updated: issue.updated_at
  }
}

export async function fetchGitHubIssues(
  repoUrl: string,
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task[]> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100`

  const response = await fetch(url, {
    headers: getGitHubHeaders(token)
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found or is private.`)
    }
    if (response.status === 403) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(data?.message || 'GitHub API rate limit exceeded or access forbidden.')
    }
    throw new Error(`Failed to fetch issues from GitHub (HTTP ${response.status})`)
  }

  const data = (await response.json()) as GitHubIssueResponse[]

  // Filter out pull requests, as GitHub returns both issues and pull requests in the issues endpoint
  const issuesOnly = data.filter((item) => !item.pull_request)

  return issuesOnly.map((issue) => mapGitHubIssueToTask(issue, projectId, userId, { statuses }))
}

export async function fetchGitHubBranches(
  repoUrl: string,
  issueNumber: number | string,
  token?: string | null
): Promise<TaskBranch[]> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    return []
  }

  const { owner, repo } = repoInfo
  const num = parseInt(String(issueNumber).trim(), 10)
  const branches: TaskBranch[] = []
  const branchNames = new Set<string>()

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (resolvedToken && !isNaN(num)) {
    try {
      const gqlQuery = {
        query: `
          query($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              issue(number: $number) {
                linkedBranches(first: 20) {
                  nodes {
                    ref {
                      name
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { owner, repo, number: num }
      }

      const gqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          ...getGitHubHeaders(resolvedToken),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gqlQuery)
      })

      if (gqlResponse.ok) {
        const gqlData = (await gqlResponse.json()) as {
          data?: {
            repository?: {
              issue?: {
                linkedBranches?: {
                  nodes?: Array<{ ref?: { name?: string } }>
                }
              }
            }
          }
        }

        const nodes = gqlData.data?.repository?.issue?.linkedBranches?.nodes || []
        for (const node of nodes) {
          const name = node.ref?.name
          if (name && !branchNames.has(name)) {
            branchNames.add(name)
            branches.push({
              name,
              url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(name)}`
            })
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch linked branches via GraphQL:', err)
    }
  }

  if (!isNaN(num)) {
    try {
      const restResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        {
          headers: getGitHubHeaders(token)
        }
      )

      if (restResponse.ok) {
        const repoBranches = (await restResponse.json()) as Array<{ name?: string }>
        if (Array.isArray(repoBranches)) {
          const issuePattern = new RegExp(`(^|[\\-_/]|#)(${num})([\\-_/]|$)`, 'i')
          for (const b of repoBranches) {
            const name = b.name
            if (name && !branchNames.has(name) && issuePattern.test(name)) {
              branchNames.add(name)
              branches.push({
                name,
                url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(name)}`
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches from REST API:', err)
    }
  }

  return branches
}

export async function fetchGitHubRelationships(
  repoUrl: string,
  issueNumber: number | string,
  token?: string | null
): Promise<TaskRelationship[]> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    return []
  }

  const { owner, repo } = repoInfo
  const num = parseInt(String(issueNumber).trim(), 10)
  if (isNaN(num)) return []

  const relationships: TaskRelationship[] = []

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${num}/relates_to`,
      {
        headers: getGitHubHeaders(token)
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
            type: 'relates_to',
            taskId: String(item.number || item.id),
            taskNumber: item.number,
            taskTitle: item.title
          })
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch related issues from GitHub:', err)
  }

  return relationships
}

export async function fetchGitHubIssue(
  repoUrl: string,
  issueNumber: number | string,
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task | null> {
  const isNumeric = /^\d+$/.test(String(issueNumber).trim())
  if (!isNumeric) {
    const allIssues = await fetchGitHubIssues(repoUrl, projectId, userId, token, statuses)
    return allIssues.find((t) => t.slug === issueNumber || t.id === String(issueNumber)) || null
  }

  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`

  const response = await fetch(url, {
    headers: getGitHubHeaders(token)
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub issue #${issueNumber} (HTTP ${response.status})`)
  }

  const issue = (await response.json()) as GitHubIssueResponse

  const [branches, relationships] = await Promise.all([
    fetchGitHubBranches(repoUrl, issue.number, token),
    fetchGitHubRelationships(repoUrl, issue.number, token)
  ])

  return mapGitHubIssueToTask(issue, projectId, userId, { branches, relationships, statuses })
}

export async function ensureGitHubLabelExists(
  repoUrl: string,
  labelName: string,
  color?: string | null,
  token?: string | null
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) return

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) return

  const { owner, repo } = repoInfo
  const hexColor = (color || '#6b7280').replace('#', '').trim()

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      headers: {
        ...getGitHubHeaders(resolvedToken),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: labelName,
        color: hexColor
      })
    })

    if (res.status === 422 && color) {
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(labelName)}`,
        {
          method: 'PATCH',
          headers: {
            ...getGitHubHeaders(resolvedToken),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ color: hexColor })
        }
      )
    }
  } catch (err) {
    console.error('Failed to ensure GitHub label exists:', err)
  }
}

export async function renameGitHubLabel(
  repoUrl: string,
  oldName: string,
  newName: string,
  color?: string | null,
  token?: string | null
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo || oldName === newName) return

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) return

  const { owner, repo } = repoInfo
  const payload: Record<string, string> = { new_name: newName }
  if (color) {
    payload.color = color.replace('#', '').trim()
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(oldName)}`,
      {
        method: 'PATCH',
        headers: {
          ...getGitHubHeaders(resolvedToken),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    )

    if (!res.ok && res.status === 404) {
      await ensureGitHubLabelExists(repoUrl, newName, color, resolvedToken)
    }
  } catch (err) {
    console.error('Failed to rename GitHub label:', err)
  }
}

export async function deleteGitHubLabel(
  repoUrl: string,
  name: string,
  token?: string | null
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo || !name) return

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) return

  const { owner, repo } = repoInfo

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
      {
        method: 'DELETE',
        headers: getGitHubHeaders(resolvedToken)
      }
    )

    if (!res.ok && res.status !== 404) {
      console.error(`Failed to delete GitHub label: HTTP ${res.status}`)
    }
  } catch (err) {
    console.error('Failed to delete GitHub label:', err)
  }
}

export async function updateGitHubIssueStatus(
  repoUrl: string,
  issueNumber: number | string,
  targetStatusId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) {
    throw new Error('A GitHub token is required to update issue status.')
  }

  const { owner, repo } = repoInfo
  const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`

  const getRes = await fetch(issueUrl, {
    headers: getGitHubHeaders(resolvedToken)
  })

  if (!getRes.ok) {
    throw new Error(`Failed to fetch GitHub issue #${issueNumber} before updating status.`)
  }

  const issue = (await getRes.json()) as GitHubIssueResponse

  const matchedStatus = statuses ? matchStatusByNameOrKey(targetStatusId, statuses) : null
  const statusName = matchedStatus ? matchedStatus.name : targetStatusId
  const isClosed = matchedStatus ? isClosedStatus(matchedStatus) : targetStatusId === 'closed'
  const newStatusLabel = formatGitHubStatusLabel(statusName)

  const existingLabels = (issue.labels || [])
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter(Boolean)

  const nonStatusLabels = existingLabels.filter((label) => !isGitHubStatusLabel(label))
  const updatedLabels = [...nonStatusLabels, newStatusLabel]

  const patchRes = await fetch(issueUrl, {
    method: 'PATCH',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      state: isClosed ? 'closed' : 'open',
      labels: updatedLabels
    })
  })

  if (!patchRes.ok) {
    const errorData = (await patchRes.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to update GitHub issue status (HTTP ${patchRes.status})`)
  }

  if (matchedStatus?.color) {
    ensureGitHubLabelExists(
      repoUrl,
      newStatusLabel,
      matchedStatus.color,
      resolvedToken
    ).catch(() => {})
  }
}

export async function updateGitHubIssueState(
  repoUrl: string,
  issueNumber: number | string,
  state: 'open' | 'closed',
  token?: string | null
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) {
    throw new Error('A GitHub token is required to update issue status.')
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ state })
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to update GitHub issue (HTTP ${response.status})`)
  }
}

export async function fetchGitHubLabels(
  repoUrl: string,
  token?: string | null
): Promise<TaskLabel[]> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    return []
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`

  try {
    const response = await fetch(url, {
      headers: getGitHubHeaders(token)
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as Array<{ name?: string; color?: string }>
    if (Array.isArray(data)) {
      return data
        .filter((l) => Boolean(l.name) && !isGitHubStatusLabel(l.name || ''))
        .map((l) => {
          const name = l.name || ''
          const color = normalizeHexColor(l.color) || getDeterministicColor(name)
          return { name, color }
        })
    }
  } catch (err) {
    console.error('Failed to fetch GitHub labels:', err)
  }

  return []
}

export async function updateGitHubIssue(
  repoUrl: string,
  issueNumber: number | string,
  updates: {
    title?: string
    body?: string
    status?: string
    state?: 'open' | 'closed'
    labels?: string[]
    relationships?: TaskRelationship[]
  },
  token?: string | null,
  statuses?: Status[]
): Promise<void> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) {
    throw new Error('A GitHub token is required to edit issues on GitHub.')
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`

  let state = updates.state
  let finalLabels = updates.labels ? [...updates.labels] : undefined

  if (updates.status) {
    const matchedStatus = statuses ? matchStatusByNameOrKey(updates.status, statuses) : null
    const statusName = matchedStatus ? matchedStatus.name : updates.status
    const isClosed = matchedStatus ? isClosedStatus(matchedStatus) : updates.status === 'closed'
    state = isClosed ? 'closed' : 'open'

    const newStatusLabel = formatGitHubStatusLabel(statusName)

    if (finalLabels !== undefined) {
      finalLabels = finalLabels.filter((l) => !isGitHubStatusLabel(l))
      finalLabels.push(newStatusLabel)
    } else {
      try {
        const getRes = await fetch(url, { headers: getGitHubHeaders(resolvedToken) })
        if (getRes.ok) {
          const current = (await getRes.json()) as GitHubIssueResponse
          const existing = (current.labels || []).map((l) => (typeof l === 'string' ? l : l.name || '')).filter(Boolean)
          finalLabels = existing.filter((l) => !isGitHubStatusLabel(l))
          finalLabels.push(newStatusLabel)
        }
      } catch {}
    }

    if (matchedStatus?.color) {
      ensureGitHubLabelExists(
        repoUrl,
        newStatusLabel,
        matchedStatus.color,
        resolvedToken
      ).catch(() => {})
    }
  }

  const patchBody: Record<string, unknown> = {}
  if (updates.title !== undefined) patchBody.title = updates.title
  if (updates.body !== undefined) patchBody.body = updates.body
  if (state !== undefined) patchBody.state = state
  if (finalLabels !== undefined) patchBody.labels = finalLabels

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patchBody)
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to update GitHub issue (HTTP ${response.status})`)
  }

  if (updates.relationships && updates.relationships.length > 0) {
    for (const rel of updates.relationships) {
      const targetId = parseInt(rel.taskId, 10)
      if (!isNaN(targetId)) {
        try {
          await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/relates_to`, {
            method: 'POST',
            headers: {
              ...getGitHubHeaders(resolvedToken),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ issue_id: targetId })
          })
        } catch (err) {
          console.error('Failed to sync relationship with GitHub:', err)
        }
      }
    }
  }
}

export async function createGitHubIssue(
  repoUrl: string,
  data: {
    title: string
    body?: string
    status?: string
    labels?: string[]
  },
  projectId: string,
  userId: string,
  token?: string | null,
  statuses?: Status[]
): Promise<Task> {
  const repoInfo = parseGitHubRepo(repoUrl)
  if (!repoInfo) {
    throw new Error('Invalid GitHub repository URL')
  }

  const resolvedToken = token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
  if (!resolvedToken) {
    throw new Error('A GitHub token is required to create issues on GitHub.')
  }

  const { owner, repo } = repoInfo
  const url = `https://api.github.com/repos/${owner}/${repo}/issues`

  const payloadLabels = [...(data.labels || [])]
  let isClosed = false

  if (data.status) {
    const matchedStatus = statuses ? matchStatusByNameOrKey(data.status, statuses) : null
    const statusName = matchedStatus ? matchedStatus.name : data.status
    isClosed = matchedStatus ? isClosedStatus(matchedStatus) : data.status === 'closed'
    const newStatusLabel = formatGitHubStatusLabel(statusName)

    if (!payloadLabels.includes(newStatusLabel)) {
      payloadLabels.push(newStatusLabel)
    }

    if (matchedStatus?.color) {
      ensureGitHubLabelExists(
        repoUrl,
        newStatusLabel,
        matchedStatus.color,
        resolvedToken
      ).catch(() => {})
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: data.title,
      body: data.body,
      labels: payloadLabels
    })
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to create GitHub issue (HTTP ${response.status})`)
  }

  const created = (await response.json()) as GitHubIssueResponse

  if (isClosed) {
    await updateGitHubIssueState(repoUrl, created.number, 'closed', resolvedToken).catch(() => {})
    created.state = 'closed'
  }

  return mapGitHubIssueToTask(created, projectId, userId, { statuses })
}

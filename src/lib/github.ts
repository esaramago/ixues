import type { Status } from '@/types/status'
import type { Task, TaskPriority } from '@/types/task'
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
    if (name.includes('low') || name === 'p3') {
      return 'low'
    }
  }
  return null
}

export function getGitHubStatuses(projectId: string, userId: string): Status[] {
  return [
    {
      id: 'open',
      name: 'Open',
      order: 0,
      color: '#2da44e',
      project: projectId,
      user: userId
    },
    {
      id: 'closed',
      name: 'Closed',
      order: 1,
      color: '#8250df',
      project: projectId,
      user: userId
    }
  ]
}

export function mapGitHubIssueToTask(
  issue: GitHubIssueResponse,
  projectId: string,
  userId: string
): Task {
  const priority = extractPriority(issue.labels || [])
  const labelNames = (issue.labels || [])
    .map((l) => (typeof l === 'string' ? l : l.name || ''))
    .filter(Boolean)

  return {
    id: String(issue.number),
    number: issue.number,
    title: issue.title,
    slug: slugify(issue.title),
    description: issue.body || '',
    priority,
    status: issue.state === 'closed' ? 'closed' : 'open',
    project: projectId,
    user: userId,
    assigned: issue.assignee?.login || null,
    url: issue.html_url,
    labels: labelNames,
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
  token?: string | null
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

  return issuesOnly.map((issue) => mapGitHubIssueToTask(issue, projectId, userId))
}

export async function fetchGitHubIssue(
  repoUrl: string,
  issueNumber: number | string,
  projectId: string,
  userId: string,
  token?: string | null
): Promise<Task | null> {
  const isNumeric = /^\d+$/.test(String(issueNumber).trim())
  if (!isNumeric) {
    const allIssues = await fetchGitHubIssues(repoUrl, projectId, userId, token)
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
  return mapGitHubIssueToTask(issue, projectId, userId)
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
): Promise<string[]> {
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

    const data = (await response.json()) as Array<{ name?: string }>
    if (Array.isArray(data)) {
      return data
        .map((l) => (typeof l === 'string' ? l : l.name || ''))
        .filter(Boolean)
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
    state?: 'open' | 'closed'
    labels?: string[]
  },
  token?: string | null
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

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to update GitHub issue (HTTP ${response.status})`)
  }
}

export async function createGitHubIssue(
  repoUrl: string,
  data: {
    title: string
    body?: string
    labels?: string[]
  },
  projectId: string,
  userId: string,
  token?: string | null
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

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...getGitHubHeaders(resolvedToken),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(errorData?.message || `Failed to create GitHub issue (HTTP ${response.status})`)
  }

  const created = (await response.json()) as GitHubIssueResponse
  return mapGitHubIssueToTask(created, projectId, userId)
}

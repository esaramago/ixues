import type { Status } from '@/types/status'
import type { Task, TaskBranch, TaskPriority, TaskRelationship } from '@/types/task'
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
    if (name.includes('lowest') || name === 'p4') {
      return 'lowest'
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
  userId: string,
  extra?: {
    relationships?: TaskRelationship[]
    branches?: TaskBranch[]
  }
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

  const [branches, relationships] = await Promise.all([
    fetchGitHubBranches(repoUrl, issue.number, token),
    fetchGitHubRelationships(repoUrl, issue.number, token)
  ])

  return mapGitHubIssueToTask(issue, projectId, userId, { branches, relationships })
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
    relationships?: TaskRelationship[]
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
    body: JSON.stringify({
      title: updates.title,
      body: updates.body,
      state: updates.state,
      labels: updates.labels
    })
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

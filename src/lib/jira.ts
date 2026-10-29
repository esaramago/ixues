import type { Status } from '@/types/status'
import type { Task, TaskBranch, TaskLabel, TaskPriority, TaskRelationship } from '@/types/task'
import { getDeterministicColor } from '@/lib/colors'
import { slugify } from '@/lib/slug'

export interface JiraIssueResponse {
  id: string
  key: string
  self: string
  fields: {
    summary: string
    description?: unknown
    created: string
    updated: string
    status?: {
      id: string
      name: string
      statusCategory?: {
        id: number
        key: string
        colorName?: string
        name?: string
      }
    }
    priority?: {
      id: string
      name: string
    }
    assignee?: {
      accountId?: string
      name?: string
      displayName: string
      avatarUrls?: Record<string, string>
    } | null
    labels?: string[]
    issuelinks?: Array<{
      id: string
      type?: {
        name: string
        inward?: string
        outward?: string
      }
      inwardIssue?: {
        id: string
        key: string
        fields?: {
          summary?: string
        }
      }
      outwardIssue?: {
        id: string
        key: string
        fields?: {
          summary?: string
        }
      }
    }>
    [key: string]: unknown
  }
}

export interface JiraProjectResponse {
  id: string
  key: string
  name: string
  issueTypes?: Array<{
    id: string
    name: string
    subtask: boolean
  }>
}

export interface JiraStatusCategory {
  id: number
  key: string
  colorName?: string
  name?: string
}

export interface JiraStatusItem {
  id: string
  name: string
  statusCategory?: JiraStatusCategory
}

const cloudIdCache = new Map<string, string>()

export async function resolveJiraApiBaseUrl(hostUrl: string): Promise<string> {
  const cached = cloudIdCache.get(hostUrl)
  if (cached) return cached

  try {
    const res = await fetch(`${hostUrl}/_edge/tenant_info`)
    if (res.ok) {
      const data = (await res.json()) as { cloudId?: string }
      if (data.cloudId) {
        const apiBase = `https://api.atlassian.com/ex/jira/${data.cloudId}`
        cloudIdCache.set(hostUrl, apiBase)
        return apiBase
      }
    }
  } catch {
    // If not Jira Cloud or edge endpoint unavailable, fallback to hostUrl
  }

  return hostUrl
}

export function parseJiraUrl(repoUrl?: string | null): { hostUrl: string; projectKey?: string } | null {
  if (!repoUrl) return null
  const cleaned = repoUrl.trim().replace(/\/+$/, '')

  try {
    const parsed = new URL(
      cleaned.startsWith('http://') || cleaned.startsWith('https://')
        ? cleaned
        : `https://${cleaned}`
    )

    const hostUrl = `${parsed.protocol}//${parsed.host}`
    const pathname = parsed.pathname

    // Look for project key in common Jira URL paths:
    // /jira/software/projects/KEY/...
    // /projects/KEY/...
    // /browse/KEY
    const match =
      pathname.match(/\/jira\/software\/projects\/([^/]+)/i) ||
      pathname.match(/\/projects\/([^/]+)/i) ||
      pathname.match(/\/browse\/([^/-]+)/i)

    const projectKey = match ? match[1].toUpperCase() : undefined
    return { hostUrl, projectKey }
  } catch {
    return null
  }
}

export function getJiraHeaders(token?: string | null, userEmail?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Ixues-App'
  }

  const rawToken = token || process.env.JIRA_TOKEN || process.env.VITE_JIRA_TOKEN
  const envEmail = process.env.JIRA_EMAIL || process.env.VITE_JIRA_EMAIL
  const email = userEmail || envEmail

  if (rawToken) {
    if (rawToken.startsWith('Basic ') || rawToken.startsWith('Bearer ')) {
      headers.Authorization = rawToken
    } else if (rawToken.includes(':')) {
      const base64 = Buffer.from(rawToken).toString('base64')
      headers.Authorization = `Basic ${base64}`
    } else if (rawToken.startsWith('ATATT')) {
      headers.Authorization = `Bearer ${rawToken}`
    } else if (email) {
      const base64 = Buffer.from(`${email}:${rawToken}`).toString('base64')
      headers.Authorization = `Basic ${base64}`
    } else {
      headers.Authorization = `Bearer ${rawToken}`
    }
  }

  return headers
}

export function extractJiraDescription(desc: unknown): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc

  if (typeof desc === 'object') {
    const extractText = (node: unknown): string => {
      if (!node || typeof node !== 'object') return ''
      const item = node as { type?: string; text?: string; content?: unknown[] }
      if (item.text) return item.text
      if (Array.isArray(item.content)) {
        const textParts = item.content.map(extractText)
        if (item.type === 'paragraph' || item.type === 'heading') {
          return textParts.join('') + '\n'
        }
        return textParts.join('')
      }
      return ''
    }

    return extractText(desc).trim()
  }

  return String(desc)
}

export function mapJiraPriority(priorityName?: string | null): TaskPriority {
  if (!priorityName) return 'medium'
  const lower = priorityName.toLowerCase()

  if (lower.includes('highest') || lower.includes('blocker') || lower.includes('urgent') || lower === 'p0') {
    return 'urgent'
  }
  if (lower.includes('high') || lower.includes('critical') || lower === 'p1') {
    return 'high'
  }
  if (lower.includes('medium') || lower.includes('normal') || lower === 'p2') {
    return 'medium'
  }
  if (lower.includes('lowest') || lower.includes('trivial') || lower === 'p4') {
    return 'lowest'
  }
  if (lower.includes('low') || lower.includes('minor') || lower === 'p3') {
    return 'low'
  }

  return 'medium'
}

export function mapPriorityToJira(priority?: TaskPriority | null): string {
  switch (priority) {
    case 'urgent':
      return 'Highest'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    case 'lowest':
      return 'Lowest'
    default:
      return 'Medium'
  }
}

export function mapJiraStatusColor(colorName?: string | null, key?: string | null): string {
  const normKey = (key || '').toLowerCase()
  const normColor = (colorName || '').toLowerCase()

  if (normKey === 'done' || normColor.includes('green')) {
    return '#34a03d'
  }
  if (normKey === 'new' || normColor.includes('gray') || normColor.includes('grey')) {
    return '#4b6584'
  }
  if (normKey === 'indeterminate' || normColor.includes('yellow') || normColor.includes('blue')) {
    return '#0052cc'
  }

  return '#4b6584'
}

export async function resolveJiraProjectKey(
  hostUrl: string,
  headers: HeadersInit,
  projectName?: string,
  projectSlug?: string,
  explicitKey?: string
): Promise<string | null> {
  if (explicitKey) return explicitKey

  try {
    const apiBase = await resolveJiraApiBaseUrl(hostUrl)
    let res = await fetch(`${apiBase}/rest/api/3/project`, { headers })
    if (!res.ok) {
      res = await fetch(`${apiBase}/rest/api/2/project`, { headers })
    }

    if (res.ok) {
      const projects = (await res.json()) as JiraProjectResponse[]
      if (Array.isArray(projects) && projects.length > 0) {
        if (projectName) {
          const matchByName = projects.find(
            (p) =>
              p.name.toLowerCase() === projectName.toLowerCase() ||
              p.key.toLowerCase() === projectName.toLowerCase()
          )
          if (matchByName) return matchByName.key
        }

        if (projectSlug) {
          const matchBySlug = projects.find(
            (p) =>
              slugify(p.name) === projectSlug ||
              slugify(p.key) === projectSlug
          )
          if (matchBySlug) return matchBySlug.key
        }

        if (projects.length === 1) {
          return projects[0].key
        }
      }
    }
  } catch (err) {
    console.error('Failed to resolve Jira project key:', err)
  }

  if (projectName) {
    return projectName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  }

  return null
}

export async function fetchJiraProjectDescription(
  repoUrl?: string | null,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string
): Promise<string | null> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) return null

  try {
    const headers = getJiraHeaders(token, userEmail)
    const projectKey = await resolveJiraProjectKey(
      parsed.hostUrl,
      headers,
      projectName,
      projectSlug,
      parsed.projectKey
    )
    if (!projectKey) return null

    const apiBase = await resolveJiraApiBaseUrl(parsed.hostUrl)
    let res = await fetch(`${apiBase}/rest/api/3/project/${projectKey}`, { headers })
    if (!res.ok) {
      res = await fetch(`${apiBase}/rest/api/2/project/${projectKey}`, { headers })
    }
    if (res.ok) {
      const data = (await res.json()) as { description?: unknown }
      return extractJiraDescription(data.description) || null
    }
  } catch (err) {
    console.error('Failed to fetch Jira project description:', err)
  }

  return null
}

export function mapJiraIssueToTask(
  issue: JiraIssueResponse,
  projectId: string,
  userId: string,
  hostUrl: string,
  branches: TaskBranch[] = []
): Task {
  const numMatch = issue.key.match(/-(\d+)$/)
  const issueNumber = numMatch ? parseInt(numMatch[1], 10) : undefined

  const relationships: TaskRelationship[] = []
  if (Array.isArray(issue.fields.issuelinks)) {
    for (const link of issue.fields.issuelinks) {
      const linked = link.outwardIssue || link.inwardIssue
      if (!linked) continue

      const isOutward = Boolean(link.outwardIssue)
      const linkTypeName = (link.type?.name || '').toLowerCase()
      let relType: TaskRelationship['type'] = 'relates_to'

      if (linkTypeName.includes('block')) {
        relType = isOutward ? 'blocks' : 'blocked_by'
      } else if (linkTypeName.includes('duplicate')) {
        relType = 'duplicate_of'
      }

      const linkedNumMatch = linked.key.match(/-(\d+)$/)
      const linkedNumber = linkedNumMatch ? parseInt(linkedNumMatch[1], 10) : undefined

      relationships.push({
        type: relType,
        taskId: linked.key,
        taskNumber: linkedNumber,
        taskTitle: linked.fields?.summary || linked.key
      })
    }
  }

  const assignee = issue.fields.assignee
  const expandAssigned = assignee
    ? {
        id: assignee.accountId || assignee.name || issue.key,
        name: assignee.displayName,
        email: (assignee as { emailAddress?: string }).emailAddress,
        avatar: assignee.avatarUrls?.['48x48'] || assignee.avatarUrls?.['32x32']
      }
    : undefined

  return {
    id: issue.key,
    number: issueNumber,
    title: issue.fields.summary,
    slug: slugify(issue.fields.summary),
    description: extractJiraDescription(issue.fields.description),
    priority: mapJiraPriority(issue.fields.priority?.name),
    status: issue.fields.status?.id || 'open',
    project: projectId,
    user: userId,
    assigned: assignee?.displayName || null,
    url: `${hostUrl}/browse/${issue.key}`,
    labels: Array.isArray(issue.fields.labels)
      ? issue.fields.labels.map((l) => ({
          name: l,
          color: getDeterministicColor(l)
        }))
      : [],
    relationships,
    branches,
    expand: expandAssigned ? { assigned: expandAssigned } : undefined,
    created: issue.fields.created,
    updated: issue.fields.updated
  }
}

export function getJiraCategoryWeight(categoryKey?: string | null): number {
  const norm = (categoryKey || '').toLowerCase()
  if (norm === 'new') return 0
  if (norm === 'indeterminate') return 1
  if (norm === 'done') return 2
  return 1
}

export function getDefaultJiraStatuses(projectId: string, userId: string): Status[] {
  return [
    {
      id: '1',
      name: 'To Do',
      order: 0,
      color: '#4b6584',
      project: projectId,
      user: userId
    },
    {
      id: '2',
      name: 'In Progress',
      order: 1,
      color: '#0052cc',
      project: projectId,
      user: userId
    },
    {
      id: '3',
      name: 'Done',
      order: 2,
      color: '#34a03d',
      project: projectId,
      user: userId
    }
  ]
}

export async function fetchJiraStatuses(
  repoUrl: string,
  projectId: string,
  userId: string,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string
): Promise<Status[]> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    return getDefaultJiraStatuses(projectId, userId)
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)
  const projectKey = await resolveJiraProjectKey(
    hostUrl,
    headers,
    projectName,
    projectSlug,
    parsed.projectKey
  )

  if (projectKey) {
    try {
      let res = await fetch(`${apiBase}/rest/api/3/project/${projectKey}/statuses`, { headers })
      if (!res.ok) {
        res = await fetch(`${apiBase}/rest/api/2/project/${projectKey}/statuses`, { headers })
      }

      if (res.ok) {
        const issueTypes = (await res.json()) as Array<{
          statuses?: JiraStatusItem[]
        }>

        const seenIds = new Set<string>()
        const statuses: Status[] = []

        if (Array.isArray(issueTypes)) {
          const rawItems: Array<{ status: JiraStatusItem; categoryWeight: number; originalIndex: number }> = []
          for (const it of issueTypes) {
            for (const s of it.statuses || []) {
              if (!seenIds.has(s.id)) {
                seenIds.add(s.id)
                rawItems.push({
                  status: s,
                  categoryWeight: getJiraCategoryWeight(s.statusCategory?.key),
                  originalIndex: rawItems.length
                })
              }
            }
          }

          rawItems.sort((a, b) => {
            if (a.categoryWeight !== b.categoryWeight) {
              return a.categoryWeight - b.categoryWeight
            }
            return a.originalIndex - b.originalIndex
          })

          for (let i = 0; i < rawItems.length; i++) {
            const s = rawItems[i].status
            statuses.push({
              id: s.id,
              name: s.name,
              order: i,
              color: mapJiraStatusColor(s.statusCategory?.colorName, s.statusCategory?.key),
              project: projectId,
              user: userId,
              key: s.id
            })
          }
        }

        if (statuses.length > 0) {
          return statuses
        }
      }
    } catch (err) {
      console.error('Failed to fetch project statuses from Jira:', err)
    }
  }

  try {
    let res = await fetch(`${apiBase}/rest/api/3/status`, { headers })
    if (!res.ok) {
      res = await fetch(`${apiBase}/rest/api/2/status`, { headers })
    }
    if (res.ok) {
      const allStatuses = (await res.json()) as JiraStatusItem[]
      if (Array.isArray(allStatuses) && allStatuses.length > 0) {
        const sorted = allStatuses.slice(0, 10).sort((a, b) => {
          const weightA = getJiraCategoryWeight(a.statusCategory?.key)
          const weightB = getJiraCategoryWeight(b.statusCategory?.key)
          return weightA - weightB
        })
        return sorted.map((s, index) => ({
          id: s.id,
          name: s.name,
          order: index,
          color: mapJiraStatusColor(s.statusCategory?.colorName, s.statusCategory?.key),
          project: projectId,
          user: userId,
          key: s.id
        }))
      }
    }
  } catch (err) {
    console.error('Failed to fetch all statuses from Jira:', err)
  }

  return getDefaultJiraStatuses(projectId, userId)
}

export async function searchJiraIssues(
  hostUrl: string,
  headers: HeadersInit,
  jql: string,
  maxPages: number = 3
): Promise<JiraIssueResponse[]> {
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)
  const allIssues: JiraIssueResponse[] = []
  let nextPageToken: string | undefined = undefined

  // 1. Try Jira Cloud enhanced search with pagination: POST /rest/api/3/search/jql
  for (let page = 0; page < maxPages; page++) {
    try {
      const body: Record<string, unknown> = {
        jql,
        maxResults: 100,
        fields: ['*all']
      }
      if (nextPageToken) {
        body.nextPageToken = nextPageToken
      }

      const postRes = await fetch(`${apiBase}/rest/api/3/search/jql`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (postRes.ok) {
        const data = (await postRes.json()) as {
          issues?: JiraIssueResponse[]
          nextPageToken?: string
          isLast?: boolean
        }
        if (Array.isArray(data.issues)) {
          allIssues.push(...data.issues)
        }
        if (!data.nextPageToken || data.isLast || !data.issues || data.issues.length === 0) {
          break
        }
        nextPageToken = data.nextPageToken
        continue
      }

      if (postRes.status === 401 || postRes.status === 403) {
        throw new Error('Jira authentication failed. Please check your token and credentials.')
      }

      // Try GET /rest/api/3/search/jql if first POST fails
      if (page === 0 && postRes.status !== 404 && postRes.status !== 410) {
        const getRes = await fetch(
          `${apiBase}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=*all`,
          { headers }
        )
        if (getRes.ok) {
          const data = (await getRes.json()) as { issues?: JiraIssueResponse[] }
          return Array.isArray(data.issues) ? data.issues : []
        }
        if (getRes.status === 401 || getRes.status === 403) {
          throw new Error('Jira authentication failed. Please check your token and credentials.')
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Jira authentication failed')) {
        throw err
      }
      console.warn('Jira /rest/api/3/search/jql call failed for page', page, err)
      break
    }
  }

  if (allIssues.length > 0) {
    return allIssues
  }

  // 2. Fallback to legacy endpoint for Jira Data Center / Server: /rest/api/2/search
  const legacyRes = await fetch(
    `${apiBase}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=*all`,
    { headers }
  )

  if (!legacyRes.ok) {
    if (legacyRes.status === 401 || legacyRes.status === 403) {
      throw new Error('Jira authentication failed. Please check your token and credentials.')
    }
    const errData = (await legacyRes.json().catch(() => null)) as {
      errorMessages?: string[]
      errors?: Record<string, string>
    } | null
    const message =
      errData?.errorMessages?.join(', ') ||
      Object.values(errData?.errors || {}).join(', ') ||
      `Failed to fetch Jira issues (HTTP ${legacyRes.status})`
    throw new Error(message)
  }

  const legacyData = (await legacyRes.json()) as { issues?: JiraIssueResponse[] }
  return Array.isArray(legacyData.issues) ? legacyData.issues : []
}

export async function fetchJiraIssues(
  repoUrl: string,
  projectId: string,
  userId: string,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string,
  onlyMyTasks?: boolean
): Promise<Task[]> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const projectKey = await resolveJiraProjectKey(
    hostUrl,
    headers,
    projectName,
    projectSlug,
    parsed.projectKey
  )

  const baseJqlParts: string[] = []
  if (projectKey) {
    baseJqlParts.push(`project = "${projectKey}"`)
  } else if (projectName) {
    baseJqlParts.push(`project = "${projectName}"`)
  } else {
    baseJqlParts.push('created >= -3650d')
  }

  if (onlyMyTasks) {
    baseJqlParts.push('assignee = currentUser()')
  }

  // 1. Prioritize querying the active/open sprint
  const sprintJql = `${[...baseJqlParts, 'sprint in openSprints()'].join(' AND ')} ORDER BY updated DESC`
  let issues: JiraIssueResponse[] = []

  try {
    issues = await searchJiraIssues(hostUrl, headers, sprintJql)
  } catch (err) {
    console.warn('Failed to query with openSprints, falling back to all project issues:', err)
  }

  // 2. If no open sprint issues found or sprint field not supported, fallback to base query
  if (issues.length === 0) {
    const fallbackJql = `${baseJqlParts.join(' AND ')} ORDER BY updated DESC`
    issues = await searchJiraIssues(hostUrl, headers, fallbackJql)
  }

  return issues.map((issue) => mapJiraIssueToTask(issue, projectId, userId, hostUrl))
}

export async function fetchJiraBranches(
  repoUrl: string,
  issueIdOrKey: string,
  token?: string | null,
  userEmail?: string | null
): Promise<TaskBranch[]> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) return []

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)

  const parseBranchesFromDetail = (detail: unknown): TaskBranch[] => {
    const branches: TaskBranch[] = []
    if (Array.isArray(detail)) {
      for (const d of detail) {
        // Direct branches array on item
        for (const b of (d as { branches?: Array<{ name: string; url?: string }> }).branches || []) {
          if (b.name) {
            branches.push({ name: b.name, url: b.url })
          }
        }
        // Nested repositories array with branches
        for (const repo of (d as { repositories?: Array<{ branches?: Array<{ name: string; url?: string }> }> }).repositories || []) {
          for (const b of repo.branches || []) {
            if (b.name) {
              branches.push({ name: b.name, url: b.url })
            }
          }
        }
      }
    }
    return branches
  }

  const applicationTypesToTry = new Set<string>()

  // 1. First attempt to query dev-status summary to discover registered providers / instance types
  try {
    for (const summaryEndpoint of [
      `${apiBase}/rest/dev-status/latest/issue/summary?issueId=${encodeURIComponent(issueIdOrKey)}`,
      `${apiBase}/rest/dev-status/1.0/issue/summary?issueId=${encodeURIComponent(issueIdOrKey)}`
    ]) {
      const summaryRes = await fetch(summaryEndpoint, { headers })
      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as {
          summary?: {
            branch?: {
              byInstanceType?: Record<string, unknown>
            }
            repository?: {
              byInstanceType?: Record<string, unknown>
            }
            pullrequest?: {
              byInstanceType?: Record<string, unknown>
            }
          }
        }

        const summary = summaryData.summary
        if (summary) {
          for (const section of [summary.branch, summary.repository, summary.pullrequest]) {
            if (section?.byInstanceType) {
              for (const key of Object.keys(section.byInstanceType)) {
                if (key) applicationTypesToTry.add(key)
              }
            }
          }
        }
        break
      }
    }
  } catch {
    // dev-status summary is optional
  }

  // Common application types as fallback candidates
  for (const appType of [
    'GitHub',
    'github',
    'githube',
    'oAuth-com.github.integration.production',
    'bitbucket',
    'stash',
    'gitlab',
    'GitLab'
  ]) {
    applicationTypesToTry.add(appType)
  }

  // 2. Query dev-status detail for each candidate application type and data type
  const branches: TaskBranch[] = []
  const seenBranchKeys = new Set<string>()

  const addBranch = (b: TaskBranch) => {
    const key = `${b.name}::${b.url || ''}`
    if (!seenBranchKeys.has(key)) {
      seenBranchKeys.add(key)
      branches.push(b)
    }
  }

  for (const appType of applicationTypesToTry) {
    for (const dataType of ['branch', 'repository']) {
      try {
        const devUrls = [
          `${apiBase}/rest/dev-status/latest/issue/detail?issueId=${encodeURIComponent(issueIdOrKey)}&applicationType=${encodeURIComponent(appType)}&dataType=${dataType}`,
          `${apiBase}/rest/dev-status/1.0/issue/detail?issueId=${encodeURIComponent(issueIdOrKey)}&applicationType=${encodeURIComponent(appType)}&dataType=${dataType}`
        ]

        for (const devUrl of devUrls) {
          const res = await fetch(devUrl, { headers })
          if (res.ok) {
            const data = (await res.json()) as { detail?: unknown }
            const parsedBranches = parseBranchesFromDetail(data.detail)
            for (const b of parsedBranches) {
              addBranch(b)
            }
            break
          }
        }
      } catch {
        // Dev-status is optional
      }
    }

    if (branches.length > 0) {
      return branches
    }
  }

  return branches
}

export async function fetchJiraIssue(
  repoUrl: string,
  issueIdOrKeyOrSlug: string,
  projectId: string,
  userId: string,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string
): Promise<Task | null> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)
  const identifier = issueIdOrKeyOrSlug.trim()

  const projectKey = await resolveJiraProjectKey(
    hostUrl,
    headers,
    projectName,
    projectSlug,
    parsed.projectKey
  )

  const directKey = /^[A-Z0-9]+-\d+$/i.test(identifier)
    ? identifier
    : /^\d+$/.test(identifier) && projectKey
      ? `${projectKey}-${identifier}`
      : null

  if (directKey) {
    let res = await fetch(`${apiBase}/rest/api/3/issue/${encodeURIComponent(directKey)}?fields=*all`, { headers })
    if (!res.ok) {
      res = await fetch(`${apiBase}/rest/api/2/issue/${encodeURIComponent(directKey)}?fields=*all`, { headers })
    }
    if (res.ok) {
      const issue = (await res.json()) as JiraIssueResponse
      const branches = await fetchJiraBranches(repoUrl, issue.id || issue.key, token, userEmail)
      return mapJiraIssueToTask(issue, projectId, userId, hostUrl, branches)
    }
  }

  const allIssues = await fetchJiraIssues(repoUrl, projectId, userId, token, userEmail, projectName, projectSlug)
  const found = allIssues.find(
    (t) =>
      t.id.toLowerCase() === identifier.toLowerCase() ||
      String(t.number) === identifier ||
      t.slug === identifier ||
      t.id.toLowerCase().endsWith(`-${identifier.toLowerCase()}`)
  )

  if (found) {
    const branches = await fetchJiraBranches(repoUrl, found.id, token, userEmail)
    return {
      ...found,
      branches
    }
  }

  return null
}

export async function updateJiraIssueStatus(
  repoUrl: string,
  issueIdOrKey: string,
  statusId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)

  let transitionsUrl = `${apiBase}/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/transitions`
  let transRes = await fetch(transitionsUrl, { headers })

  if (!transRes.ok) {
    transitionsUrl = `${apiBase}/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}/transitions`
    transRes = await fetch(transitionsUrl, { headers })
  }

  if (!transRes.ok) {
    throw new Error(`Failed to load transitions for Jira issue ${issueIdOrKey}`)
  }

  const transData = (await transRes.json()) as {
    transitions?: Array<{
      id: string
      name: string
      to?: {
        id: string
        name: string
      }
    }>
  }

  const transitions = transData.transitions || []
  const match = transitions.find(
    (t) =>
      t.to?.id === statusId ||
      t.to?.name?.toLowerCase() === statusId.toLowerCase() ||
      t.id === statusId ||
      t.name.toLowerCase() === statusId.toLowerCase()
  )

  if (!match) {
    const available = transitions.map((t) => t.to?.name || t.name).join(', ')
    throw new Error(
      `Cannot transition Jira issue to status "${statusId}". Available transitions: ${available || 'none'}`
    )
  }

  const updateRes = await fetch(transitionsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      transition: {
        id: match.id
      }
    })
  })

  if (!updateRes.ok) {
    const errData = (await updateRes.json().catch(() => null)) as { errorMessages?: string[] } | null
    throw new Error(
      errData?.errorMessages?.join(', ') || `Failed to transition Jira issue (HTTP ${updateRes.status})`
    )
  }
}

export async function createJiraIssue(
  repoUrl: string,
  data: {
    title: string
    body?: string
    labels?: string[]
    priority?: TaskPriority | null
  },
  projectId: string,
  userId: string,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string
): Promise<Task> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)
  const projectKey = await resolveJiraProjectKey(
    hostUrl,
    headers,
    projectName,
    projectSlug,
    parsed.projectKey
  )

  if (!projectKey) {
    throw new Error('Could not determine Jira project key for issue creation.')
  }

  let issueTypeName = 'Task'
  try {
    let projRes = await fetch(`${apiBase}/rest/api/3/project/${projectKey}`, { headers })
    if (!projRes.ok) {
      projRes = await fetch(`${apiBase}/rest/api/2/project/${projectKey}`, { headers })
    }

    if (projRes.ok) {
      const projData = (await projRes.json()) as JiraProjectResponse
      const available = (projData.issueTypes || []).filter((it) => !it.subtask)
      const preferred = available.find(
        (it) => it.name.toLowerCase() === 'task' || it.name.toLowerCase() === 'story'
      )
      if (preferred) {
        issueTypeName = preferred.name
      } else if (available.length > 0) {
        issueTypeName = available[0].name
      }
    }
  } catch (err) {
    console.error('Failed to fetch Jira issue types:', err)
  }

  const payload: Record<string, unknown> = {
    fields: {
      project: { key: projectKey },
      summary: data.title,
      description: data.body || '',
      issuetype: { name: issueTypeName }
    }
  }

  const fields = payload.fields as Record<string, unknown>
  if (data.labels && data.labels.length > 0) {
    fields.labels = data.labels
  }
  if (data.priority) {
    fields.priority = { name: mapPriorityToJira(data.priority) }
  }

  let createRes = await fetch(`${apiBase}/rest/api/2/issue`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!createRes.ok) {
    // If v2 fails, try v3 with ADF description
    const v3Payload = {
      ...payload,
      fields: {
        ...fields,
        description: data.body
          ? {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: data.body }]
                }
              ]
            }
          : undefined
      }
    }
    createRes = await fetch(`${apiBase}/rest/api/3/issue`, {
      method: 'POST',
      headers,
      body: JSON.stringify(v3Payload)
    })
  }

  if (!createRes.ok) {
    const errData = (await createRes.json().catch(() => null)) as {
      errorMessages?: string[]
      errors?: Record<string, string>
    } | null

    const messages = [
      ...(errData?.errorMessages || []),
      ...Object.values(errData?.errors || {})
    ]
    throw new Error(messages.join(', ') || `Failed to create Jira issue (HTTP ${createRes.status})`)
  }

  const created = (await createRes.json()) as { id: string; key: string }
  const task = await fetchJiraIssue(
    repoUrl,
    created.key,
    projectId,
    userId,
    token,
    userEmail,
    projectName,
    projectSlug
  )

  if (!task) {
    throw new Error(`Issue created as ${created.key}, but could not be loaded.`)
  }

  return task
}

export async function updateJiraIssue(
  repoUrl: string,
  issueIdOrKey: string,
  updates: {
    title?: string
    body?: string
    status?: string
    labels?: string[]
    relationships?: TaskRelationship[]
    priority?: TaskPriority | null
  },
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)

  const fields: Record<string, unknown> = {}
  if (updates.title !== undefined) {
    fields.summary = updates.title
  }
  if (updates.body !== undefined) {
    fields.description = updates.body
  }
  if (updates.labels !== undefined) {
    fields.labels = updates.labels
  }
  if (updates.priority) {
    fields.priority = { name: mapPriorityToJira(updates.priority) }
  }

  if (Object.keys(fields).length > 0) {
    let updateRes = await fetch(`${apiBase}/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ fields })
    })

    if (!updateRes.ok) {
      const v3Fields = {
        ...fields,
        description: updates.body !== undefined
          ? {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: updates.body }]
                }
              ]
            }
          : undefined
      }
      updateRes = await fetch(`${apiBase}/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields: v3Fields })
      })
    }

    if (!updateRes.ok) {
      const errData = (await updateRes.json().catch(() => null)) as {
        errorMessages?: string[]
        errors?: Record<string, string>
      } | null
      const messages = [
        ...(errData?.errorMessages || []),
        ...Object.values(errData?.errors || {})
      ]
      throw new Error(messages.join(', ') || `Failed to update Jira issue (HTTP ${updateRes.status})`)
    }
  }

  if (updates.status) {
    try {
      await updateJiraIssueStatus(repoUrl, issueIdOrKey, updates.status, token, userEmail)
    } catch (err) {
      console.error('Failed to update Jira issue status during issue update:', err)
    }
  }

  if (updates.relationships && updates.relationships.length > 0) {
    for (const rel of updates.relationships) {
      if (!rel.taskId) continue
      try {
        let typeName = 'Relates'
        if (rel.type === 'blocks') typeName = 'Blocks'
        if (rel.type === 'blocked_by') typeName = 'Blocks'
        if (rel.type === 'duplicate_of') typeName = 'Duplicate'

        const isBlockedBy = rel.type === 'blocked_by'
        await fetch(`${apiBase}/rest/api/3/issueLink`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: { name: typeName },
            inwardIssue: { key: isBlockedBy ? rel.taskId : issueIdOrKey },
            outwardIssue: { key: isBlockedBy ? issueIdOrKey : rel.taskId }
          })
        })
      } catch (err) {
        console.error('Failed to link Jira issues:', err)
      }
    }
  }
}

export async function deleteJiraIssue(
  repoUrl: string,
  issueIdOrKey: string,
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const parsed = parseJiraUrl(repoUrl)
  if (!parsed) {
    throw new Error('Invalid Jira URL')
  }

  const { hostUrl } = parsed
  const headers = getJiraHeaders(token, userEmail)
  const apiBase = await resolveJiraApiBaseUrl(hostUrl)

  let res = await fetch(`${apiBase}/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}`, {
    method: 'DELETE',
    headers
  })

  if (!res.ok) {
    res = await fetch(`${apiBase}/rest/api/2/issue/${encodeURIComponent(issueIdOrKey)}`, {
      method: 'DELETE',
      headers
    })
  }

  if (!res.ok && res.status !== 204) {
    const errData = (await res.json().catch(() => null)) as { errorMessages?: string[] } | null
    throw new Error(
      errData?.errorMessages?.join(', ') || `Failed to delete Jira issue (HTTP ${res.status})`
    )
  }
}

export async function fetchJiraLabels(
  repoUrl: string,
  token?: string | null,
  userEmail?: string | null,
  projectName?: string,
  projectSlug?: string
): Promise<TaskLabel[]> {
  try {
    const issues = await fetchJiraIssues(
      repoUrl,
      'temp',
      'temp',
      token,
      userEmail,
      projectName,
      projectSlug
    )
    const labelMap = new Map<string, TaskLabel>()
    for (const issue of issues) {
      for (const l of issue.labels || []) {
        const name = typeof l === 'string' ? l : l.name
        if (name && !labelMap.has(name)) {
          const color = typeof l === 'string' ? getDeterministicColor(name) : (l.color || getDeterministicColor(name))
          labelMap.set(name, { name, color })
        }
      }
    }
    return Array.from(labelMap.values())
  } catch (err) {
    console.error('Failed to fetch Jira labels:', err)
    return []
  }
}

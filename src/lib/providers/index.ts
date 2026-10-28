import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task } from '@/types/task'
import { githubAdapter } from './github'
import { jiraAdapter } from './jira'
import type { CreateIssueInput, ProviderAdapter, UpdateIssueInput } from './types'

export * from './types'

const adapters: Record<string, ProviderAdapter> = {
  github: githubAdapter,
  jira: jiraAdapter
}

export function getProvider(project?: Pick<Project, 'type' | 'provider'> | null): ProviderAdapter | null {
  if (!project || project.type !== 'sync' || !project.provider) {
    return null
  }
  return adapters[project.provider.toLowerCase()] || null
}

export function isSyncProject(project?: Pick<Project, 'type'> | null): boolean {
  return project?.type === 'sync'
}

export async function fetchProviderStatuses(
  project: Project,
  userId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<Status[]> {
  const provider = getProvider(project)
  if (!provider) return []
  return provider.getStatuses(project, userId, token, userEmail)
}

export async function fetchProviderIssues(
  project: Project,
  userId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<Task[]> {
  const provider = getProvider(project)
  if (!provider) return []
  return provider.getIssues(project, userId, token, userEmail)
}

export async function fetchProviderIssue(
  project: Project,
  issueIdOrSlug: string,
  userId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<Task | null> {
  const provider = getProvider(project)
  if (!provider) return null
  return provider.getIssue(project, issueIdOrSlug, userId, token, userEmail)
}

export async function fetchProviderLabels(
  project: Project,
  token?: string | null,
  userEmail?: string | null
): Promise<string[]> {
  const provider = getProvider(project)
  if (!provider) return []
  return provider.getLabels(project, token, userEmail)
}

export async function createProviderIssue(
  project: Project,
  data: CreateIssueInput,
  userId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<Task> {
  const provider = getProvider(project)
  if (!provider) {
    throw new Error(`Unsupported or unconfigured synchronization provider "${project.provider}".`)
  }
  return provider.createIssue(project, data, userId, token, userEmail)
}

export async function updateProviderIssue(
  project: Project,
  issueIdOrSlug: string,
  updates: UpdateIssueInput,
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const provider = getProvider(project)
  if (!provider) {
    throw new Error(`Unsupported or unconfigured synchronization provider "${project.provider}".`)
  }
  return provider.updateIssue(project, issueIdOrSlug, updates, token, userEmail)
}

export async function updateProviderIssueStatus(
  project: Project,
  issueIdOrSlug: string,
  statusId: string,
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const provider = getProvider(project)
  if (!provider) {
    throw new Error(`Unsupported or unconfigured synchronization provider "${project.provider}".`)
  }
  return provider.updateIssueStatus(project, issueIdOrSlug, statusId, token, userEmail)
}

export async function deleteProviderIssue(
  project: Project,
  issueIdOrSlug: string,
  token?: string | null,
  userEmail?: string | null
): Promise<void> {
  const provider = getProvider(project)
  if (!provider) {
    throw new Error(`Unsupported or unconfigured synchronization provider "${project.provider}".`)
  }
  return provider.deleteIssue(project, issueIdOrSlug, token, userEmail)
}

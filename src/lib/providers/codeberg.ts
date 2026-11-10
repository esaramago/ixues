import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task, TaskLabel } from '@/types/task'
import type { User } from '@/types/user'
import {
  createCodebergIssue,
  deleteCodebergIssue,
  fetchCodebergAssignees,
  fetchCodebergIssue,
  fetchCodebergIssues,
  fetchCodebergLabels,
  fetchCodebergRepoDescription,
  fetchCodebergStatuses,
  updateCodebergIssue,
  updateCodebergIssueStatus
} from '@/lib/codeberg'
import type { CreateIssueInput, ProviderAdapter, UpdateIssueInput } from './types'

async function resolveCodebergIssueNumber(
  repoUrl: string,
  issueIdOrSlug: string,
  project: Project,
  userId: string,
  token?: string | null
): Promise<string> {
  if (/^\d+$/.test(issueIdOrSlug.trim())) {
    return issueIdOrSlug.trim()
  }

  const issue = await fetchCodebergIssue(repoUrl, issueIdOrSlug, project.id, userId, token)
  if (issue) {
    return String(issue.number || issue.id)
  }

  return issueIdOrSlug
}

export const codebergAdapter: ProviderAdapter = {
  name: 'codeberg',

  async getDescription(project: Project, token?: string | null): Promise<string | null> {
    if (!project.repo_url) return null
    return fetchCodebergRepoDescription(project.repo_url, token)
  },

  async getStatuses(
    project: Project,
    userId: string,
    token?: string | null
  ): Promise<Status[]> {
    return fetchCodebergStatuses(project.repo_url, project.id, userId, token)
  },

  async getIssues(
    project: Project,
    userId: string,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<Task[]> {
    if (!project.repo_url) return []
    return fetchCodebergIssues(project.repo_url, project.id, userId, token, statuses)
  },

  async getIssue(
    project: Project,
    issueIdOrSlug: string,
    userId: string,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<Task | null> {
    if (!project.repo_url) return null
    return fetchCodebergIssue(project.repo_url, issueIdOrSlug, project.id, userId, token, statuses)
  },

  async getLabels(project: Project, token?: string | null): Promise<TaskLabel[]> {
    if (!project.repo_url) return []
    return fetchCodebergLabels(project.repo_url, token)
  },

  async getUsers(project: Project, token?: string | null): Promise<User[]> {
    if (!project.repo_url) return []
    return fetchCodebergAssignees(project.repo_url, token)
  },

  async createIssue(
    project: Project,
    data: CreateIssueInput,
    userId: string,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<Task> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return createCodebergIssue(
      project.repo_url,
      {
        title: data.title,
        body: data.body,
        status: data.status,
        labels: data.labels,
        priority: data.priority,
        assigned: data.assigned
      },
      project.id,
      userId,
      token,
      statuses
    )
  },

  async updateIssue(
    project: Project,
    issueIdOrSlug: string,
    updates: UpdateIssueInput,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }

    const issueNumber = await resolveCodebergIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    return updateCodebergIssue(
      project.repo_url,
      issueNumber,
      {
        title: updates.title,
        body: updates.body,
        status: updates.status,
        labels: updates.labels,
        priority: updates.priority,
        relationships: updates.relationships,
        assigned: updates.assigned
      },
      token,
      statuses
    )
  },

  async updateIssueStatus(
    project: Project,
    issueIdOrSlug: string,
    statusId: string,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }

    const issueNumber = await resolveCodebergIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    return updateCodebergIssueStatus(project.repo_url, issueNumber, statusId, token, statuses)
  },

  async deleteIssue(
    project: Project,
    issueIdOrSlug: string,
    token?: string | null
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }

    const issueNumber = await resolveCodebergIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    return deleteCodebergIssue(project.repo_url, issueNumber, token)
  }
}

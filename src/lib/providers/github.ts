import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task, TaskLabel } from '@/types/task'
import {
  createGitHubIssue,
  fetchGitHubIssue,
  fetchGitHubIssues,
  fetchGitHubLabels,
  fetchGitHubRepoDescription,
  fetchGitHubStatuses,
  updateGitHubIssue,
  updateGitHubIssueStatus
} from '@/lib/github'
import type { CreateIssueInput, ProviderAdapter, UpdateIssueInput } from './types'

async function resolveGitHubIssueNumber(
  repoUrl: string,
  issueIdOrSlug: string,
  project: Project,
  userId: string,
  token?: string | null
): Promise<string> {
  if (/^\d+$/.test(issueIdOrSlug.trim())) {
    return issueIdOrSlug.trim()
  }

  const issue = await fetchGitHubIssue(repoUrl, issueIdOrSlug, project.id, userId, token)
  if (issue) {
    return String(issue.number || issue.id)
  }

  return issueIdOrSlug
}

export const githubAdapter: ProviderAdapter = {
  name: 'github',

  async getDescription(project: Project, token?: string | null): Promise<string | null> {
    if (!project.repo_url) return null
    return fetchGitHubRepoDescription(project.repo_url, token)
  },

  async getStatuses(
    project: Project,
    userId: string,
    token?: string | null
  ): Promise<Status[]> {
    return fetchGitHubStatuses(project.repo_url, project.id, userId, token)
  },

  async getIssues(
    project: Project,
    userId: string,
    token?: string | null,
    _userEmail?: string | null,
    statuses?: Status[]
  ): Promise<Task[]> {
    if (!project.repo_url) return []
    return fetchGitHubIssues(project.repo_url, project.id, userId, token, statuses)
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
    return fetchGitHubIssue(project.repo_url, issueIdOrSlug, project.id, userId, token, statuses)
  },

  async getLabels(project: Project, token?: string | null): Promise<TaskLabel[]> {
    if (!project.repo_url) return []
    return fetchGitHubLabels(project.repo_url, token)
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
    return createGitHubIssue(
      project.repo_url,
      {
        title: data.title,
        body: data.body,
        status: data.status,
        labels: data.labels
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

    const issueNumber = await resolveGitHubIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    await updateGitHubIssue(
      project.repo_url,
      issueNumber,
      {
        title: updates.title,
        body: updates.body,
        status: updates.status,
        labels: updates.labels,
        relationships: updates.relationships
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

    const issueNumber = await resolveGitHubIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    await updateGitHubIssueStatus(
      project.repo_url,
      issueNumber,
      statusId,
      token,
      statuses
    )
  },

  async deleteIssue(): Promise<void> {
    throw new Error('GitHub issues cannot be deleted via API. You can close the issue instead.')
  }
}

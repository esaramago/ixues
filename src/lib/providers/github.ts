import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task } from '@/types/task'
import {
  createGitHubIssue,
  fetchGitHubIssue,
  fetchGitHubIssues,
  fetchGitHubLabels,
  getGitHubStatuses,
  updateGitHubIssue,
  updateGitHubIssueState
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

  getStatuses(project: Project, userId: string): Status[] {
    return getGitHubStatuses(project.id, userId)
  },

  async getIssues(
    project: Project,
    userId: string,
    token?: string | null
  ): Promise<Task[]> {
    if (!project.repo_url) return []
    return fetchGitHubIssues(project.repo_url, project.id, userId, token)
  },

  async getIssue(
    project: Project,
    issueIdOrSlug: string,
    userId: string,
    token?: string | null
  ): Promise<Task | null> {
    if (!project.repo_url) return null
    return fetchGitHubIssue(project.repo_url, issueIdOrSlug, project.id, userId, token)
  },

  async getLabels(project: Project, token?: string | null): Promise<string[]> {
    if (!project.repo_url) return []
    return fetchGitHubLabels(project.repo_url, token)
  },

  async createIssue(
    project: Project,
    data: CreateIssueInput,
    userId: string,
    token?: string | null
  ): Promise<Task> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return createGitHubIssue(
      project.repo_url,
      {
        title: data.title,
        body: data.body,
        labels: data.labels
      },
      project.id,
      userId,
      token
    )
  },

  async updateIssue(
    project: Project,
    issueIdOrSlug: string,
    updates: UpdateIssueInput,
    token?: string | null
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

    let state: 'open' | 'closed' | undefined
    if (updates.status === 'closed') {
      state = 'closed'
    } else if (updates.status === 'open') {
      state = 'open'
    }

    await updateGitHubIssue(
      project.repo_url,
      issueNumber,
      {
        title: updates.title,
        body: updates.body,
        state,
        labels: updates.labels,
        relationships: updates.relationships
      },
      token
    )
  },

  async updateIssueStatus(
    project: Project,
    issueIdOrSlug: string,
    statusId: string,
    token?: string | null
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    if (statusId !== 'open' && statusId !== 'closed') {
      throw new Error('Invalid status for GitHub issue. Expected "open" or "closed".')
    }

    const issueNumber = await resolveGitHubIssueNumber(
      project.repo_url,
      issueIdOrSlug,
      project,
      project.user,
      token
    )

    await updateGitHubIssueState(project.repo_url, issueNumber, statusId, token)
  },

  async deleteIssue(): Promise<void> {
    throw new Error('GitHub issues cannot be deleted via API. You can close the issue instead.')
  }
}

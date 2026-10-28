import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task, TaskLabel } from '@/types/task'
import {
  createJiraIssue,
  deleteJiraIssue,
  fetchJiraIssue,
  fetchJiraIssues,
  fetchJiraLabels,
  fetchJiraProjectDescription,
  fetchJiraStatuses,
  updateJiraIssue,
  updateJiraIssueStatus
} from '@/lib/jira'
import type { CreateIssueInput, ProviderAdapter, UpdateIssueInput } from './types'

export const jiraAdapter: ProviderAdapter = {
  name: 'jira',

  async getDescription(
    project: Project,
    token?: string | null,
    userEmail?: string | null
  ): Promise<string | null> {
    if (!project.repo_url) return null
    return fetchJiraProjectDescription(
      project.repo_url,
      token,
      userEmail,
      project.name,
      project.slug
    )
  },

  async getStatuses(
    project: Project,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Status[]> {
    if (!project.repo_url) return []
    return fetchJiraStatuses(
      project.repo_url,
      project.id,
      userId,
      token,
      userEmail,
      project.name,
      project.slug
    )
  },

  async getIssues(
    project: Project,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task[]> {
    if (!project.repo_url) return []
    return fetchJiraIssues(
      project.repo_url,
      project.id,
      userId,
      token,
      userEmail,
      project.name,
      project.slug,
      project.only_my_tasks
    )
  },

  async getIssue(
    project: Project,
    issueIdOrSlug: string,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task | null> {
    if (!project.repo_url) return null
    return fetchJiraIssue(
      project.repo_url,
      issueIdOrSlug,
      project.id,
      userId,
      token,
      userEmail,
      project.name,
      project.slug
    )
  },

  async getLabels(
    project: Project,
    token?: string | null,
    userEmail?: string | null
  ): Promise<TaskLabel[]> {
    if (!project.repo_url) return []
    return fetchJiraLabels(
      project.repo_url,
      token,
      userEmail,
      project.name,
      project.slug
    )
  },

  async createIssue(
    project: Project,
    data: CreateIssueInput,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return createJiraIssue(
      project.repo_url,
      data,
      project.id,
      userId,
      token,
      userEmail,
      project.name,
      project.slug
    )
  },

  async updateIssue(
    project: Project,
    issueIdOrSlug: string,
    updates: UpdateIssueInput,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return updateJiraIssue(
      project.repo_url,
      issueIdOrSlug,
      updates,
      token,
      userEmail
    )
  },

  async updateIssueStatus(
    project: Project,
    issueIdOrSlug: string,
    statusId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return updateJiraIssueStatus(
      project.repo_url,
      issueIdOrSlug,
      statusId,
      token,
      userEmail
    )
  },

  async deleteIssue(
    project: Project,
    issueIdOrSlug: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void> {
    if (!project.repo_url) {
      throw new Error('Project repository URL is missing.')
    }
    return deleteJiraIssue(
      project.repo_url,
      issueIdOrSlug,
      token,
      userEmail
    )
  }
}

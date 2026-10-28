import type { Project } from '@/types/project'
import type { Status } from '@/types/status'
import type { Task, TaskPriority, TaskRelationship } from '@/types/task'

export interface CreateIssueInput {
  title: string
  body?: string
  labels?: string[]
  priority?: TaskPriority | null
}

export interface UpdateIssueInput {
  title?: string
  body?: string
  status?: string
  labels?: string[]
  relationships?: TaskRelationship[]
  priority?: TaskPriority | null
}

export interface ProviderAdapter {
  readonly name: string

  getStatuses(
    project: Project,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Status[]> | Status[]

  getIssues(
    project: Project,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task[]>

  getIssue(
    project: Project,
    issueIdOrSlug: string,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task | null>

  getLabels(
    project: Project,
    token?: string | null,
    userEmail?: string | null
  ): Promise<string[]>

  createIssue(
    project: Project,
    data: CreateIssueInput,
    userId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<Task>

  updateIssue(
    project: Project,
    issueIdOrSlug: string,
    updates: UpdateIssueInput,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void>

  updateIssueStatus(
    project: Project,
    issueIdOrSlug: string,
    statusId: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void>

  deleteIssue(
    project: Project,
    issueIdOrSlug: string,
    token?: string | null,
    userEmail?: string | null
  ): Promise<void>
}

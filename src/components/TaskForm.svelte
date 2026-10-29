<script lang="ts">
  import Back from '@/components/Back.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { Project } from '@/types/project'
  import type { Status } from '@/types/status'
  import {
    DEFAULT_LOCAL_LABELS,
    PRIORITY_OPTIONS,
    RELATIONSHIP_TYPES,
    getPriorityIcon,
    getRelationshipLabel,
    type RelationshipType,
    type Task,
    type TaskBranch,
    type TaskLabelItem,
    type TaskPriority,
    type TaskRelationship
  } from '@/types/task'
  import type { User } from '@/types/user'

  export interface TaskFormData {
    error?: string
    title?: string
    description?: string
    priority?: TaskPriority | '' | null
    status?: string
    assigned?: string
    labels?: string[]
    relationships?: TaskRelationship[]
  }

  interface Props {
    project: Pick<Project, 'id' | 'name'> & Partial<Pick<Project, 'type' | 'provider' | 'repo_url' | 'slug'>>
    statuses: Status[]
    users?: User[]
    availableLabels?: TaskLabelItem[]
    availableTasks?: Task[]
    task?: Task | null
    defaultStatus?: string
    defaultAssigned?: string
    form?: TaskFormData | null
    heading?: string
    subheading?: string
    action?: string
    deleteAction?: string
    showDelete?: boolean
    cancelHref?: string
    submitLabel?: string
    readonly?: boolean
  }

  let {
    project,
    statuses,
    users = [],
    availableLabels = [],
    availableTasks = [],
    task = null,
    defaultStatus = '',
    defaultAssigned = '',
    form = null,
    heading,
    subheading,
    action,
    deleteAction = '?/delete',
    showDelete = true,
    cancelHref,
    submitLabel,
    readonly = false
  }: Props = $props()

  let isEdit = $derived(!!task)
  let resolvedHeading = $derived(
    heading ?? (isEdit ? (task?.number ? `Task #${task.number}` : 'Edit Task') : 'New Task')
  )
  let resolvedAction = $derived(action ?? (isEdit ? '?/update' : undefined))
  let resolvedCancelHref = $derived(cancelHref ?? `/projects/${project.slug || project.id}`)
  let resolvedSubmitLabel = $derived(submitLabel ?? (isEdit ? 'Save Changes' : 'Create Task'))

  let isSyncTask = $derived(project.type === 'sync' || !!task?.url)
  let originalTaskUrl = $derived(
    task?.url ||
      (isSyncTask && project.repo_url && (task?.number || task?.id)
        ? (project.provider === 'jira'
          ? `${project.repo_url.replace(/\/+$/, '')}/browse/${task.id || task.number}`
          : `${project.repo_url.replace(/\/+$/, '')}/issues/${task.number || task.id}`)
        : null)
  )

  let defaultAssignedValue = $derived(
    defaultAssigned || (!task && users.length === 1 ? users[0].id : '')
  )

  let priority = $state<TaskPriority | ''>('medium')
  let status = $state('')
  let assigned = $state('')
  let selectedLabels = $state<string[]>([])
  let selectedRelationships = $state<TaskRelationship[]>([])
  let newRelType = $state<RelationshipType>('relates_to')
  let newRelTaskId = $state('')
  let prevKey = $state('')
  let isConfirmOpen = $state(false)

  let allLabelOptions = $derived.by(() => {
    const list: string[] = []
    const sourceList =
      availableLabels.length > 0
        ? availableLabels
        : project.type === 'local'
          ? [...DEFAULT_LOCAL_LABELS]
          : []
    for (const item of sourceList) {
      const name = typeof item === 'string' ? item : item.name
      if (name && !list.includes(name)) list.push(name)
    }
    for (const name of selectedLabels) {
      if (name && !list.includes(name)) list.push(name)
    }
    return list
  })

  $effect(() => {
    const currentKey = task?.id ?? `new-${defaultStatus}-${defaultAssignedValue}`
    if (currentKey !== prevKey) {
      prevKey = currentKey
      priority = task ? (task.priority || '') : 'medium'
      status = task ? (task.status || '') : (defaultStatus || statuses[0]?.id || '')
      assigned = task ? (task.assigned || '') : defaultAssignedValue
      selectedLabels = Array.isArray(task?.labels)
        ? task.labels.map((l) => (typeof l === 'string' ? l : l.name))
        : []
      selectedRelationships = Array.isArray(task?.relationships) ? [...task.relationships] : []
    }
    if (form?.priority !== undefined) {
      priority = form.priority || ''
    }
    if (form?.status !== undefined) {
      status = form.status
    }
    if (form?.assigned !== undefined) {
      assigned = form.assigned
    }
    if (form?.labels !== undefined) {
      selectedLabels = form.labels
    }
    if (form?.relationships !== undefined) {
      selectedRelationships = form.relationships
    }
  })

  function handlePriorityChange(event: Event) {
    priority = (event.target as HTMLInputElement).value as TaskPriority | ''
  }

  function handleStatusChange(event: Event) {
    status = (event.target as HTMLInputElement).value
  }

  function handleAssignedChange(event: Event) {
    assigned = (event.target as HTMLInputElement).value
  }

  function handleLabelsChange(event: Event) {
    const target = event.target as { value?: unknown }
    if (Array.isArray(target.value)) {
      selectedLabels = target.value as string[]
    } else if (typeof target.value === 'string' && target.value) {
      selectedLabels = [target.value]
    } else {
      selectedLabels = []
    }
  }

  function handleAddRelationship() {
    if (!newRelTaskId) return
    const targetTask = availableTasks.find((t) => t.id === newRelTaskId || String(t.number) === newRelTaskId)
    const exists = selectedRelationships.some(
      (rel) => rel.taskId === newRelTaskId && rel.type === newRelType
    )
    if (!exists) {
      selectedRelationships = [
        ...selectedRelationships,
        {
          type: newRelType,
          taskId: newRelTaskId,
          taskNumber: targetTask?.number,
          taskTitle: targetTask?.title
        }
      ]
    }
    newRelTaskId = ''
  }

  function handleRemoveRelationship(index: number) {
    selectedRelationships = selectedRelationships.filter((_, i) => i !== index)
  }

  function getRelBadgeVariant(type: RelationshipType): 'neutral' | 'danger' | 'warning' {
    switch (type) {
      case 'blocked_by':
        return 'danger'
      case 'blocks':
        return 'warning'
      case 'duplicate_of':
      case 'relates_to':
      default:
        return 'neutral'
    }
  }
</script>

<Grid direction="column" gap="xl" align="center">
  <wa-card>
    <Grid direction="column" gap="l">
      <Grid justify="space-between" align="center" wrap={true} gap="s">
        <Back href={resolvedCancelHref} title={resolvedHeading} />

        {#if originalTaskUrl}
          <wa-button
            href={originalTaskUrl}
            target="_blank"
            rel="noreferrer"
            variant="neutral"
            size="s"
          >
            <wa-icon slot="start" family="brands" name={project.provider}></wa-icon>
            Original Task
            <wa-icon slot="end" name="arrow-up-right-from-square" variant="solid"></wa-icon>
          </wa-button>
        {/if}
      </Grid>

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST" action={resolvedAction}>
        <Grid direction="column" gap="l">
          <wa-input
            name="title"
            label="Title"
            placeholder="e.g. Implement user authentication"
            value={form?.title ?? task?.title ?? ''}
            readonly={readonly}
            disabled={readonly}
            required
          ></wa-input>

          <wa-textarea
            name="description"
            label="Description"
            placeholder="Provide details about this task..."
            value={form?.description ?? task?.description ?? ''}
            readonly={readonly}
            disabled={readonly}
            rows={4}
          ></wa-textarea>

          <Grid break="mobile">
            <wa-select
              name="priority"
              label="Priority"
              value={priority}
              disabled={readonly}
              onchange={handlePriorityChange}
            >
              {#if priority && getPriorityIcon(priority)}
                <wa-icon slot="start" name={getPriorityIcon(priority)} variant="solid"></wa-icon>
              {/if}
              <wa-option value="">No priority</wa-option>
              {#each PRIORITY_OPTIONS as option (option.value)}
                <wa-option value={option.value}>
                  <wa-icon slot="start" name={option.icon} variant="solid"></wa-icon>
                  {option.label}
                </wa-option>
              {/each}
            </wa-select>

            {#if statuses.length > 0}
              <wa-select
                name="status"
                label="Status"
                value={status}
                disabled={readonly}
                onchange={handleStatusChange}
              >
                <wa-option value="">No Status</wa-option>
                {#each statuses as statusItem (statusItem.id)}
                  <wa-option value={statusItem.id}>{statusItem.name}</wa-option>
                {/each}
              </wa-select>
            {/if}

            <wa-select
              name="assigned"
              label="Assigned"
              value={assigned}
              disabled={readonly}
              onchange={handleAssignedChange}
            >
              <wa-option value="">Unassigned</wa-option>
              {#each users as userItem (userItem.id)}
                <wa-option value={userItem.id}>
                  {userItem.name || userItem.email || userItem.id}
                </wa-option>
              {/each}
            </wa-select>
          </Grid>

          <wa-select
            name="labels"
            label="Labels"
            multiple
            with-clear
            value={selectedLabels}
            disabled={readonly}
            onchange={handleLabelsChange}
          >
            {#each allLabelOptions as labelName (labelName)}
              <wa-option value={labelName} selected={selectedLabels.includes(labelName)}>
                {labelName}
              </wa-option>
            {/each}
          </wa-select>

          <Grid direction="column" gap="s">
            <h4 data-appearance="h6">Relationships</h4>

            {#if selectedRelationships.length > 0}
              <Grid direction="column" gap="xs">
                {#each selectedRelationships as rel, index (rel.taskId + rel.type)}
                  {@const targetTask = availableTasks.find((t) => t.id === rel.taskId || String(t.number) === rel.taskId)}
                  {@const taskNum = rel.taskNumber ?? targetTask?.number}
                  {@const taskTitle = rel.taskTitle ?? targetTask?.title}
                  {@const taskIdentifier = taskNum ?? rel.taskId}
                  <Grid align="center" justify="space-between" gap="s">
                    <Grid align="center" gap="xs" wrap={true}>
                      <wa-badge size="s" pill variant={getRelBadgeVariant(rel.type)}>
                        {getRelationshipLabel(rel.type)}
                      </wa-badge>
                      <a href={`/projects/${project.slug || project.id}/tasks/${taskIdentifier}`}>
                        {#if taskNum}#{taskNum} {/if}{taskTitle || rel.taskId}
                      </a>
                    </Grid>
                    {#if !readonly}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <wa-button
                        type="button"
                        size="xs"
                        variant="neutral"
                        appearance="plain"
                        onclick={() => handleRemoveRelationship(index)}
                        aria-label="Remove relationship"
                      >
                        <wa-icon name="xmark" variant="solid"></wa-icon>
                      </wa-button>
                    {/if}
                  </Grid>
                {/each}
              </Grid>
            {/if}

            {#if !readonly && availableTasks.length > 0}
              <Grid break="mobile" align="end" gap="s">
                <wa-select
                  label="Relation Type"
                  value={newRelType}
                  onchange={(e: Event) => (newRelType = (e.target as HTMLInputElement).value as RelationshipType)}
                >
                  {#each RELATIONSHIP_TYPES as option (option.value)}
                    <wa-option value={option.value}>{option.label}</wa-option>
                  {/each}
                </wa-select>

                <wa-select
                  label="Related Task"
                  value={newRelTaskId}
                  onchange={(e: Event) => (newRelTaskId = (e.target as HTMLInputElement).value)}
                >
                  <wa-option value="">Select a task...</wa-option>
                  {#each availableTasks as t (t.id)}
                    <wa-option value={t.id}>
                      {#if t.number}#{t.number} {/if}{t.title}
                    </wa-option>
                  {/each}
                </wa-select>

                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <wa-button
                  type="button"
                  variant="neutral"
                  disabled={!newRelTaskId}
                  onclick={handleAddRelationship}
                >
                  <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
                  Add Relation
                </wa-button>
              </Grid>
            {/if}

            <input type="hidden" name="relationships" value={JSON.stringify(selectedRelationships)} />
          </Grid>

          {#if isSyncTask}
            <Grid direction="column" gap="s">
              <h4 data-appearance="h6">Branches</h4>

              {#if task?.branches && task.branches.length > 0}
                <Grid direction="column" gap="xs">
                  {#each task.branches as branch (branch.name)}
                    <Grid align="center" gap="xs">
                      <wa-icon name="code-branch" variant="solid"></wa-icon>
                      {#if branch.url}
                        <a href={branch.url} target="_blank" rel="noreferrer">
                          {branch.name}
                          <wa-icon name="arrow-up-right-from-square" variant="solid"></wa-icon>
                        </a>
                      {:else}
                        <span>{branch.name}</span>
                      {/if}
                    </Grid>
                  {/each}
                </Grid>
              {:else}
                <small>No linked branches found for this issue.</small>
              {/if}
            </Grid>
          {/if}

          {#if readonly}
            <Grid justify="end" gap="s">
              <wa-button variant="neutral" href={resolvedCancelHref}>Back to Project</wa-button>
            </Grid>
          {:else if isEdit && showDelete}
            <Grid justify="space-between" align="center">
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <wa-button
                type="button"
                variant="danger"
                onclick={() => (isConfirmOpen = true)}
              >
                Delete Task
              </wa-button>

              <Grid justify="end" gap="s">
                <wa-button variant="neutral" href={resolvedCancelHref}>Cancel</wa-button>
                <wa-button type="submit" variant="brand">{resolvedSubmitLabel}</wa-button>
              </Grid>
            </Grid>
          {:else}
            <Grid justify="end" gap="s">
              <wa-button variant="neutral" href={resolvedCancelHref}>Cancel</wa-button>
              <wa-button type="submit" variant="brand">{resolvedSubmitLabel}</wa-button>
            </Grid>
          {/if}
        </Grid>
      </form>
    </Grid>
  </wa-card>
</Grid>

{#if isEdit && showDelete && !readonly}
  <ConfirmDialog
    bind:open={isConfirmOpen}
    title="Delete Task"
    message="Are you sure you want to delete this task? This action cannot be undone."
    confirmLabel="Delete Task"
    confirmVariant="danger"
    action={deleteAction}
  />
{/if}

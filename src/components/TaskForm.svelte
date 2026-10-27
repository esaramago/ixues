<script lang="ts">
  import Back from '@/components/Back.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { Project } from '@/types/project'
  import type { Status } from '@/types/status'
  import { DEFAULT_LOCAL_LABELS, type Task, type TaskPriority } from '@/types/task'
  import type { User } from '@/types/user'

  export interface TaskFormData {
    error?: string
    title?: string
    description?: string
    priority?: TaskPriority
    status?: string
    assigned?: string
    labels?: string[]
  }

  interface Props {
    project: Pick<Project, 'id' | 'name'> & Partial<Pick<Project, 'type' | 'provider' | 'repo_url' | 'slug'>>
    statuses: Status[]
    users?: User[]
    availableLabels?: string[]
    task?: Task | null
    defaultStatus?: string
    form?: TaskFormData | null
    heading?: string
    subheading?: string
    action?: string
    deleteAction?: string
    showDelete?: boolean
    cancelHref?: string
    submitLabel?: string
  }

  let {
    project,
    statuses,
    users = [],
    availableLabels = [],
    task = null,
    defaultStatus = '',
    form = null,
    heading,
    subheading,
    action,
    deleteAction = '?/delete',
    showDelete = true,
    cancelHref,
    submitLabel
  }: Props = $props()

  let isEdit = $derived(!!task)
  let resolvedHeading = $derived(
    heading ?? (isEdit ? (task?.number ? `Task #${task.number}` : 'Edit Task') : 'New Task')
  )
  let resolvedSubheading = $derived(
    subheading ?? (isEdit ? `Edit task in ${project.name}.` : `Add a new task to ${project.name}.`)
  )
  let resolvedAction = $derived(action ?? (isEdit ? '?/update' : undefined))
  let resolvedCancelHref = $derived(cancelHref ?? `/projects/${project.slug || project.id}`)
  let resolvedSubmitLabel = $derived(submitLabel ?? (isEdit ? 'Save Changes' : 'Create Task'))

  let isSyncTask = $derived(project.type === 'sync' || !!task?.url)
  let originalTaskUrl = $derived(
    task?.url ||
      (isSyncTask && project.repo_url && (task?.number || task?.id)
        ? `${project.repo_url.replace(/\/+$/, '')}/issues/${task.number || task.id}`
        : null)
  )

  let priority = $state<TaskPriority>('medium')
  let status = $state('')
  let assigned = $state('')
  let selectedLabels = $state<string[]>([])
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
    for (const name of sourceList) {
      if (name && !list.includes(name)) list.push(name)
    }
    for (const name of selectedLabels) {
      if (name && !list.includes(name)) list.push(name)
    }
    return list
  })

  $effect(() => {
    const currentKey = task?.id ?? `new-${defaultStatus}`
    if (currentKey !== prevKey) {
      prevKey = currentKey
      priority = task?.priority || 'medium'
      status = task ? (task.status || '') : (defaultStatus || statuses[0]?.id || '')
      assigned = task?.assigned || ''
      selectedLabels = Array.isArray(task?.labels) ? [...task.labels] : []
    }
    if (form?.priority) {
      priority = form.priority
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
  })

  function handlePriorityChange(event: Event) {
    priority = (event.target as HTMLInputElement).value as TaskPriority
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
</script>

<Grid direction="column" gap="xl" align="center">
  <wa-card>
    <Grid direction="column" gap="l">
      <Grid justify="space-between" align="center" wrap={true} gap="s">
        <Back href={resolvedCancelHref} title={resolvedHeading} subtitle={resolvedSubheading} />

        {#if originalTaskUrl}
          <wa-button
            href={originalTaskUrl}
            target="_blank"
            rel="noreferrer"
            variant="neutral"
            size="s"
          >
            {#if project.provider === 'github'}
              <wa-icon slot="start" family="brands" name="github"></wa-icon>
            {:else if project.provider === 'jira'}
              <wa-icon slot="start" family="brands" name="jira"></wa-icon>
            {:else}
              <wa-icon slot="start" name="link" variant="solid"></wa-icon>
            {/if}
            Original Task
            <wa-icon slot="end" name="arrow-up-right-from-square" variant="solid"></wa-icon>
          </wa-button>
        {/if}
      </Grid>

      {#if originalTaskUrl}
        <Grid align="center" gap="s">
          <wa-icon name="link" variant="solid"></wa-icon>
          <a href={originalTaskUrl} target="_blank" rel="noreferrer">
            {originalTaskUrl}
          </a>
        </Grid>
      {/if}

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST" action={resolvedAction}>
        <Grid direction="column" gap="l">
          {#if isEdit && task?.number}
            <wa-input
              label="Number"
              value={`#${task.number}`}
              readonly
              disabled
            ></wa-input>
          {/if}

          <wa-input
            name="title"
            label="Title"
            placeholder="e.g. Implement user authentication"
            value={form?.title ?? task?.title ?? ''}
            required
          ></wa-input>

          <wa-textarea
            name="description"
            label="Description"
            placeholder="Provide details about this task..."
            value={form?.description ?? task?.description ?? ''}
            rows={4}
          ></wa-textarea>

          <Grid break="mobile">
            <wa-select
              name="priority"
              label="Priority"
              value={priority}
              onchange={handlePriorityChange}
            >
              <wa-option value="low">Low</wa-option>
              <wa-option value="medium">Medium</wa-option>
              <wa-option value="high">High</wa-option>
              <wa-option value="urgent">Urgent</wa-option>
            </wa-select>

            {#if statuses.length > 0}
              <wa-select
                name="status"
                label="Status"
                value={status}
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
            onchange={handleLabelsChange}
          >
            {#each allLabelOptions as labelName (labelName)}
              <wa-option value={labelName} selected={selectedLabels.includes(labelName)}>
                {labelName}
              </wa-option>
            {/each}
          </wa-select>

          {#if isEdit && showDelete}
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

{#if isEdit && showDelete}
  <ConfirmDialog
    bind:open={isConfirmOpen}
    title="Delete Task"
    message="Are you sure you want to delete this task? This action cannot be undone."
    confirmLabel="Delete Task"
    confirmVariant="danger"
    action={deleteAction}
  />
{/if}

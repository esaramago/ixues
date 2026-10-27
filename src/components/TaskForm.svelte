<script lang="ts">
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { Project } from '@/types/project'
  import type { Status } from '@/types/status'
  import type { Task, TaskPriority } from '@/types/task'

  export interface TaskFormData {
    error?: string
    title?: string
    description?: string
    priority?: TaskPriority
    status?: string
  }

  interface Props {
    project: Pick<Project, 'id' | 'name'>
    statuses: Status[]
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
  let resolvedCancelHref = $derived(cancelHref ?? `/projects/${project.id}`)
  let resolvedSubmitLabel = $derived(submitLabel ?? (isEdit ? 'Save Changes' : 'Create Task'))

  let priority = $state<TaskPriority>('medium')
  let status = $state('')
  let prevKey = $state('')
  let isConfirmOpen = $state(false)

  $effect(() => {
    const currentKey = task?.id ?? `new-${defaultStatus}`
    if (currentKey !== prevKey) {
      prevKey = currentKey
      priority = task?.priority || 'medium'
      status = task ? (task.status || '') : (defaultStatus || statuses[0]?.id || '')
    }
    if (form?.priority) {
      priority = form.priority
    }
    if (form?.status !== undefined) {
      status = form.status
    }
  })

  function handlePriorityChange(event: Event) {
    priority = (event.target as HTMLInputElement).value as TaskPriority
  }

  function handleStatusChange(event: Event) {
    status = (event.target as HTMLInputElement).value
  }
</script>

<Grid direction="column" gap="xl" align="center">
  <wa-card>
    <Grid direction="column" gap="l">
      <Grid direction="column" gap="xs">
        <h2>{resolvedHeading}</h2>
        <p>{resolvedSubheading}</p>
      </Grid>

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
          </Grid>

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

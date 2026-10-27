<script lang="ts">
  import { enhance } from '$app/forms'
  import Grid from '@/components/Grid.svelte'
  import type { ActionData, PageData } from './$types'
  import type { TaskPriority } from '@/types/task'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let isDialogOpen = $state(false)

  $effect(() => {
    if (form?.error) {
      isDialogOpen = true
    }
  })

  let unassignedTasks = $derived(
    data.tasks.filter((task) => !task.status || !data.statuses.some((s) => s.id === task.status))
  )

  function getPriorityVariant(
    priority?: TaskPriority | null
  ): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' {
    switch (priority) {
      case 'urgent':
        return 'danger'
      case 'high':
        return 'warning'
      case 'medium':
        return 'brand'
      case 'low':
        return 'neutral'
      default:
        return 'neutral'
    }
  }
</script>

<Grid direction="column" gap="xl">
  <Grid align="center" justify="space-between">
    <Grid align="center" gap="s">
      <h2>{data.project.name}</h2>
      {#if data.project.type === 'sync'}
        <wa-badge variant="neutral">
          {#if data.project.provider === 'github'}
            <wa-icon slot="start" family="brands" name="github"></wa-icon>
          {:else if data.project.provider === 'jira'}
            <wa-icon slot="start" family="brands" name="jira"></wa-icon>
          {/if}
          {data.project.provider ?? 'Sync'}
        </wa-badge>
      {:else}
        <wa-badge variant="brand">Local</wa-badge>
      {/if}
    </Grid>

    <Grid align="center" gap="s">
      <wa-button href={`/projects/${data.project.id}/tasks/new`} size="small" variant="brand">
        <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
        New Task
      </wa-button>

      {#if data.project.type === 'local'}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button size="small" variant="neutral" onclick={() => (isDialogOpen = true)}>
          <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
          New Status
        </wa-button>
      {/if}

      <wa-button href="/dashboard" size="small" variant="neutral">
        <wa-icon slot="start" name="arrow-left" variant="solid"></wa-icon>
        Dashboard
      </wa-button>
    </Grid>
  </Grid>

  {#if data.project.repo_url}
    <wa-card>
      <Grid align="center" gap="s">
        <wa-icon name="link" variant="solid"></wa-icon>
        <a href={data.project.repo_url} target="_blank" rel="noreferrer">
          {data.project.repo_url}
        </a>
      </Grid>
    </wa-card>
  {/if}

  {#if data.statuses.length === 0}
    <wa-card>
      <Grid direction="column" align="center" gap="s">
        <p>No statuses found for this project.</p>
        {#if data.project.type === 'local'}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-button variant="brand" onclick={() => (isDialogOpen = true)}>
            <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
            Create Status
          </wa-button>
        {/if}
      </Grid>
    </wa-card>
  {:else}
    <Grid wrap={true} break="small">
      {#each data.statuses as status (status.id)}
        {@const statusTasks = data.tasks.filter((task) => task.status === status.id)}
        <wa-card>
          <Grid direction="column" gap="s">
            <Grid align="center" justify="space-between">
              <strong>{status.name}</strong>
              <wa-badge variant="neutral">{statusTasks.length}</wa-badge>
            </Grid>
            {#if status.color}
              <small>{status.color}</small>
            {/if}

            <Grid direction="column" gap="s">
              {#if statusTasks.length === 0}
                <small>No tasks</small>
              {:else}
                {#each statusTasks as task (task.id)}
                  <wa-card>
                    <Grid direction="column" gap="xs">
                      <strong>{task.title}</strong>
                      {#if task.description}
                        <small>{task.description}</small>
                      {/if}
                      {#if task.priority}
                        <Grid justify="end">
                          <wa-badge size="small" variant={getPriorityVariant(task.priority)}>
                            {task.priority}
                          </wa-badge>
                        </Grid>
                      {/if}
                    </Grid>
                  </wa-card>
                {/each}
              {/if}
            </Grid>

            <wa-button
              href={`/projects/${data.project.id}/tasks/new?status=${status.id}`}
              size="small"
              variant="neutral"
            >
              <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
              New Task
            </wa-button>
          </Grid>
        </wa-card>
      {/each}

      {#if unassignedTasks.length > 0}
        <wa-card>
          <Grid direction="column" gap="s">
            <Grid align="center" justify="space-between">
              <strong>No Status</strong>
              <wa-badge variant="neutral">{unassignedTasks.length}</wa-badge>
            </Grid>

            <Grid direction="column" gap="s">
              {#each unassignedTasks as task (task.id)}
                <wa-card>
                  <Grid direction="column" gap="xs">
                    <strong>{task.title}</strong>
                    {#if task.description}
                      <small>{task.description}</small>
                    {/if}
                    {#if task.priority}
                      <Grid justify="end">
                        <wa-badge size="small" variant={getPriorityVariant(task.priority)}>
                          {task.priority}
                        </wa-badge>
                      </Grid>
                    {/if}
                  </Grid>
                </wa-card>
              {/each}
            </Grid>
          </Grid>
        </wa-card>
      {/if}
    </Grid>
  {/if}
</Grid>

<wa-dialog
  label="New Status"
  open={isDialogOpen}
  onwa-after-hide={() => (isDialogOpen = false)}
>
  <form
    method="POST"
    action="?/createStatus"
    use:enhance={() => {
      return async ({ result, update }) => {
        await update()
        if (result.type === 'success') {
          isDialogOpen = false
        }
      }
    }}
  >
    <Grid direction="column" gap="l">
      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <wa-input
        name="name"
        label="Status Name"
        placeholder="e.g. Backlog, In Progress, Done"
        value={form?.name ?? ''}
        required
      ></wa-input>

      <wa-input
        name="order"
        type="number"
        label="Order"
        placeholder={String(data.statuses.length)}
        hint="Display order on the board (optional)"
        min="0"
        value={form?.order ?? ''}
      ></wa-input>

      <wa-input
        name="color"
        label="Color"
        placeholder="#3b82f6"
        hint="Hex color code (optional)"
        value={form?.color ?? ''}
      ></wa-input>

      <Grid justify="end" gap="s">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button variant="neutral" type="button" onclick={() => (isDialogOpen = false)}>
          Cancel
        </wa-button>
        <wa-button type="submit" variant="brand">Create Status</wa-button>
      </Grid>
    </Grid>
  </form>
</wa-dialog>

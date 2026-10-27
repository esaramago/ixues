<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let priority = $state('medium')
  let status = $state('')
  let prevDefaultStatus = $state('')

  $effect(() => {
    if (data.defaultStatus !== prevDefaultStatus) {
      prevDefaultStatus = data.defaultStatus
      status = data.defaultStatus || ''
    }
    if (form?.priority) {
      priority = form.priority
    }
    if (form?.status) {
      status = form.status
    } else if (!status) {
      status = data.defaultStatus || data.statuses[0]?.id || ''
    }
  })

  function handlePriorityChange(event: Event) {
    priority = (event.target as HTMLInputElement).value
  }

  function handleStatusChange(event: Event) {
    status = (event.target as HTMLInputElement).value
  }
</script>

<Grid direction="column" gap="xl" align="center">
  <wa-card>
    <Grid direction="column" gap="l">
      <Grid direction="column" gap="xs">
        <h2>New Task</h2>
        <p>Add a new task to {data.project.name}.</p>
      </Grid>

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST">
        <Grid direction="column" gap="l">
          <wa-input
            name="title"
            label="Title"
            placeholder="e.g. Implement user authentication"
            value={form?.title ?? ''}
            required
          ></wa-input>

          <wa-textarea
            name="description"
            label="Description"
            placeholder="Provide details about this task..."
            value={form?.description ?? ''}
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

            {#if data.statuses.length > 0}
              <wa-select
                name="status"
                label="Status"
                value={status}
                onchange={handleStatusChange}
              >
                {#each data.statuses as statusItem (statusItem.id)}
                  <wa-option value={statusItem.id}>{statusItem.name}</wa-option>
                {/each}
              </wa-select>
            {/if}
          </Grid>

          <Grid justify="end" gap="s">
            <wa-button variant="neutral" href={`/projects/${data.project.id}`}>Cancel</wa-button>
            <wa-button type="submit" variant="brand">Create Task</wa-button>
          </Grid>
        </Grid>
      </form>
    </Grid>
  </wa-card>
</Grid>

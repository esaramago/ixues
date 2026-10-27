<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { ActionData, PageData } from './$types'
  import type { TaskPriority } from '@/types/task'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let priority = $state<TaskPriority>('medium')
  let status = $state('')
  let prevTaskId = $state('')

  $effect(() => {
    if (data.task.id !== prevTaskId) {
      prevTaskId = data.task.id
      priority = data.task.priority || 'medium'
      status = data.task.status || ''
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
        <h2>Edit Task</h2>
        <p>Edit task in {data.project.name}.</p>
      </Grid>

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST" action="?/update">
        <Grid direction="column" gap="l">
          <wa-input
            name="title"
            label="Title"
            placeholder="e.g. Implement user authentication"
            value={form?.title ?? data.task.title}
            required
          ></wa-input>

          <wa-textarea
            name="description"
            label="Description"
            placeholder="Provide details about this task..."
            value={form?.description ?? data.task.description ?? ''}
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
                <wa-option value="">No Status</wa-option>
                {#each data.statuses as statusItem (statusItem.id)}
                  <wa-option value={statusItem.id}>{statusItem.name}</wa-option>
                {/each}
              </wa-select>
            {/if}
          </Grid>

          <Grid justify="space-between" align="center">
            <wa-button
              type="submit"
              variant="danger"
              formaction="?/delete"
              formnovalidate
            >
              Delete Task
            </wa-button>

            <Grid justify="end" gap="s">
              <wa-button variant="neutral" href={`/projects/${data.project.id}`}>Cancel</wa-button>
              <wa-button type="submit" variant="brand">Save Changes</wa-button>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </Grid>
  </wa-card>
</Grid>

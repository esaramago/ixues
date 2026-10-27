<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import Grid from '@/components/Grid.svelte'
  import StatusForm from '@/components/StatusForm.svelte'
  import Task from '@/components/Task.svelte'
  import type { ActionData, PageData } from './$types'
  import type { Status } from '@/types/status'
  import type { Task as TaskType } from '@/types/task'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let isCreateDialogOpen = $state(false)
  let editingStatus = $state<Status | null>(null)
  let tasks = $state<TaskType[]>([])

  $effect(() => {
    tasks = data.tasks
  })

  $effect(() => {
    if (form?.error) {
      if ('statusId' in form && form.statusId) {
        const found = data.statuses.find((s) => s.id === form.statusId)
        if (found) {
          editingStatus = found
        }
      } else if (data.project.type === 'local' && ('name' in form || 'order' in form)) {
        isCreateDialogOpen = true
      }
    }
  })

  let unassignedTasks = $derived(
    tasks.filter((task) => !task.status || !data.statuses.some((s) => s.id === task.status))
  )

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  async function handleDrop(event: DragEvent, targetStatusId: string | null) {
    event.preventDefault()
    const taskId = event.dataTransfer?.getData('text/plain')
    if (!taskId) return

    const targetTask = tasks.find((t) => t.id === taskId)
    if (!targetTask) return

    const currentStatusId = targetTask.status || null
    if (currentStatusId === targetStatusId) return

    const previousTasks = [...tasks]
    // Optimistic UI update
    tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: targetStatusId || null } : t))

    const formData = new FormData()
    formData.append('taskId', taskId)
    formData.append('statusId', targetStatusId || '')

    try {
      const response = await fetch('?/moveTask', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        tasks = previousTasks
        return
      }

      await invalidateAll()
    } catch {
      tasks = previousTasks
    }
  }
</script>

<Grid direction="column" gap="xl">
  <Grid align="center" justify="space-between">
    <Grid align="center" gap="s">
      <h2>{data.project.name}</h2>
      {#if data.project.type === 'sync'}
        <wa-badge variant="neutral">
          <wa-icon slot="start" family="brands" name={data.project.provider}></wa-icon>
          {data.project.provider ?? 'Sync'}
        </wa-badge>
      {:else}
        <wa-badge variant="brand">Local</wa-badge>
      {/if}
    </Grid>

    <Grid align="center" gap="s">
      <wa-button href={`/projects/${data.project.slug || data.project.id}/tasks/new`} size="small" variant="brand">
        <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
        New Task
      </wa-button>

      {#if data.project.type === 'local'}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button size="small" variant="neutral" onclick={() => (isCreateDialogOpen = true)}>
          <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
          New Status
        </wa-button>
      {/if}

      <wa-button href={`/projects/${data.project.slug || data.project.id}/edit`} size="small" variant="neutral">
        <wa-icon slot="start" name="pen-to-square" variant="solid"></wa-icon>
        Edit Project
      </wa-button>
      
      {#if data.project.repo_url}
        <wa-button href={data.project.repo_url} target="_blank" rel="noreferrer">
          <wa-icon slot="start" name="link" variant="solid"></wa-icon>
          Repository
        </wa-button>
      {/if}
    </Grid>
  </Grid>

  {#if data.syncError}
    <wa-callout variant="danger">
      <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
      {data.syncError}
    </wa-callout>
  {/if}

  {#if form?.error && !('statusId' in form) && !('name' in form)}
    <wa-callout variant="danger">
      <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
      {form.error}
    </wa-callout>
  {/if}

  {#if data.statuses.length === 0}
    <wa-card>
      <Grid direction="column" align="center" gap="s">
        <p>No statuses found for this project.</p>
        {#if data.project.type === 'local'}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-button variant="brand" onclick={() => (isCreateDialogOpen = true)}>
            <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
            Create Status
          </wa-button>
        {/if}
      </Grid>
    </wa-card>
  {:else}
    <div class="panel">
      <Grid break="small">
        {#each data.statuses as status (status.id)}
          {@const statusTasks = tasks.filter((task) => task.status === status.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-card
            class="status"
            ondragover={handleDragOver}
            ondrop={(e: DragEvent) => handleDrop(e, status.id)}
          >
            <Grid direction="column" gap="s">
              <Grid align="center" justify="space-between">
                <Grid align="center" gap="2xs">
                  <wa-icon name="circle" style={`color: ${status.color || 'var(--wa-color-neutral-50)'}`} variant="regular"></wa-icon>
                  <strong>{status.name}</strong>
                </Grid>
                <Grid align="center" gap="xs">
                  <wa-badge variant="neutral">{statusTasks.length}</wa-badge>
                  {#if data.project.type === 'local'}
                    <wa-dropdown
                      placement="bottom-end"
                      onwa-select={(e: CustomEvent<{ item: HTMLElement }>) => {
                        if (e.detail.item.getAttribute('value') === 'edit') {
                          editingStatus = status
                        }
                      }}
                    >
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <wa-button slot="trigger" size="small" variant="neutral" aria-label="Status actions">
                        <wa-icon name="ellipsis-vertical" variant="solid"></wa-icon>
                      </wa-button>
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <wa-dropdown-item value="edit" onclick={() => (editingStatus = status)}>
                        Editar
                      </wa-dropdown-item>
                    </wa-dropdown>
                  {/if}
                </Grid>
              </Grid>

              <Grid direction="column" gap="s">
                {#if statusTasks.length === 0}
                  <small>No tasks</small>
                {:else}
                  {#each statusTasks as task (task.id)}
                    <Task {task} projectId={data.project.slug || data.project.id} />
                  {/each}
                {/if}
              </Grid>

              <wa-button
                href={`/projects/${data.project.slug || data.project.id}/tasks/new?status=${status.id}`}
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
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-card
            ondragover={handleDragOver}
            ondrop={(e: DragEvent) => handleDrop(e, null)}
          >
            <Grid direction="column" gap="s">
              <Grid align="center" justify="space-between">
                <strong>No Status</strong>
                <wa-badge variant="neutral">{unassignedTasks.length}</wa-badge>
              </Grid>

              <Grid direction="column" gap="s">
                {#each unassignedTasks as task (task.id)}
                  <Task {task} projectId={data.project.slug || data.project.id} />
                {/each}
              </Grid>
            </Grid>
          </wa-card>
        {/if}
      </Grid>
    </div>
  {/if}
</Grid>

<wa-dialog
  label="New Status"
  open={isCreateDialogOpen}
  onwa-after-hide={() => (isCreateDialogOpen = false)}
>
  <StatusForm
    defaultOrder={data.statuses.length}
    {form}
    oncancel={() => (isCreateDialogOpen = false)}
    onsuccess={() => (isCreateDialogOpen = false)}
  />
</wa-dialog>

<wa-dialog
  label="Edit Status"
  open={!!editingStatus}
  onwa-after-hide={() => (editingStatus = null)}
>
  {#if editingStatus}
    <StatusForm
      status={editingStatus}
      defaultOrder={editingStatus.order}
      {form}
      oncancel={() => (editingStatus = null)}
      onsuccess={() => (editingStatus = null)}
    />
  {/if}
</wa-dialog>


<style>
.panel {
  
}
.status {
  width: 35rem;
  --spacing: var(--wa-space-s);
}
</style>
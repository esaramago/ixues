<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import Back from '@/components/Back.svelte'
  import Grid from '@/components/Grid.svelte'
  import StatusForm from '@/components/StatusForm.svelte'
  import Task from '@/components/Task.svelte'
  import type { ActionData, PageData } from './$types'
  import type { Status } from '@/types/status'
  import { isTaskAssignedToUser, type Task as TaskType } from '@/types/task'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let isCreateDialogOpen = $state(false)
  let editingStatus = $state<Status | null>(null)
  let tasks = $state<TaskType[]>([])
  let onlyMyTasks = $state(false)

  $effect(() => {
    tasks = data.tasks
  })

  $effect(() => {
    onlyMyTasks = data.project.only_my_tasks ?? false
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

  let displayedTasks = $derived(
    onlyMyTasks ? tasks.filter((task) => isTaskAssignedToUser(task, data.user)) : tasks
  )

  let unassignedTasks = $derived(
    displayedTasks.filter((task) => !task.status || !data.statuses.some((s) => s.id === task.status))
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

  async function handleMoveStatus(statusId: string, direction: 'left' | 'right') {
    const formData = new FormData()
    formData.append('statusId', statusId)
    formData.append('direction', direction)

    try {
      const response = await fetch('?/reorderStatus', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await invalidateAll()
      }
    } catch (err) {
      console.error('Failed to reorder status:', err)
    }
  }
</script>

<Grid direction="column">
  <Grid align="center" justify="space-between">
    <Back href="/dashboard" title={data.project.name}>
      {#if data.project.type === 'sync'}
        <wa-badge variant="neutral">
          <wa-icon slot="start" family="brands" name={data.project.provider}></wa-icon>
          {data.project.provider ?? 'Sync'}
        </wa-badge>
      {:else}
        <wa-badge variant="brand">Local</wa-badge>
      {/if}
    </Back>

    <Grid align="center" gap="s">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <wa-button
        size="s"
        variant={onlyMyTasks ? 'brand' : 'neutral'}
        onclick={() => (onlyMyTasks = !onlyMyTasks)}
      >
        <wa-icon slot="start" name="user" variant={onlyMyTasks ? 'solid' : 'regular'}></wa-icon>
        Only my tasks
      </wa-button>

      <wa-button href={`/projects/${data.project.slug || data.project.id}/tasks/new`} size="s" variant="brand">
        <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
        New Task
      </wa-button>

      <wa-dropdown
        placement="bottom-end"
        onwa-select={(e: CustomEvent<{ item: HTMLElement }>) => {
          if (e.detail.item.getAttribute('value') === 'new-status') {
            isCreateDialogOpen = true
          }
        }}
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button slot="trigger" size="s" variant="neutral" aria-label="Project actions">
          <wa-icon name="ellipsis-vertical" variant="solid"></wa-icon>
        </wa-button>
        <wa-dropdown-item
          value="edit-project"
          href={`/projects/${data.project.slug || data.project.id}/edit`}
        >
          <wa-icon slot="icon" name="pen-to-square" variant="solid"></wa-icon>
          Edit Project
        </wa-dropdown-item>
        {#if data.project.type === 'local' || data.project.provider === 'github'}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-dropdown-item
            value="new-status"
            onclick={() => (isCreateDialogOpen = true)}
          >
            <wa-icon slot="icon" name="plus" variant="solid"></wa-icon>
            New status
          </wa-dropdown-item>
        {/if}
      </wa-dropdown>
      
      {#if data.project.repo_url}
        <wa-button href={data.project.repo_url} target="_blank" rel="noreferrer">
          <wa-icon slot="start" name="link" variant="solid"></wa-icon>
          {data.project.provider === 'jira' ? 'Jira' : 'Repository'}
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
      <Grid>
        {#each data.statuses as status, statusIndex (status.id)}
          {@const statusTasks = displayedTasks.filter((task) => task.status === status.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-card
            class="status"
            ondragover={handleDragOver}
            ondrop={(e: DragEvent) => handleDrop(e, status.id)}
          >
            <Grid direction="column" gap="s">
              <Grid align="center" justify="space-between">
                <Grid align="center" gap="xs">
                  <wa-icon name="circle" style={`color: ${status.color || 'var(--wa-color-neutral-50)'}`} variant="regular"></wa-icon>
                  <strong>{status.name}</strong>
                  <wa-badge variant="neutral" pill appearance="filled-outlined" class="status__counter">{statusTasks.length}</wa-badge>
                </Grid>
                <Grid align="center" gap="xs">
                  <wa-dropdown
                    placement="bottom-end"
                    onwa-select={(e: CustomEvent<{ item: HTMLElement }>) => {
                      const val = e.detail.item.getAttribute('value')
                      if (val === 'edit') {
                        editingStatus = status
                      } else if (val === 'move-left') {
                        handleMoveStatus(status.id, 'left')
                      } else if (val === 'move-right') {
                        handleMoveStatus(status.id, 'right')
                      }
                    }}
                  >
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <wa-button slot="trigger" size="s" variant="neutral" aria-label="Status actions" appearance="plain">
                      <wa-icon name="ellipsis-vertical" variant="solid"></wa-icon>
                    </wa-button>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <wa-dropdown-item
                      value="move-left"
                      disabled={statusIndex === 0}
                      onclick={() => handleMoveStatus(status.id, 'left')}
                    >
                      <wa-icon slot="icon" name="arrow-left" variant="regular"></wa-icon>
                      Move left
                    </wa-dropdown-item>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <wa-dropdown-item
                      value="move-right"
                      disabled={statusIndex === data.statuses.length - 1}
                      onclick={() => handleMoveStatus(status.id, 'right')}
                    >
                      <wa-icon slot="icon" name="arrow-right" variant="regular"></wa-icon>
                      Move right
                    </wa-dropdown-item>
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <wa-dropdown-item value="edit" onclick={() => (editingStatus = status)}>
                      <wa-icon slot="icon" name="pen" variant="regular"></wa-icon>
                      Edit status
                    </wa-dropdown-item>
                  </wa-dropdown>
                </Grid>
              </Grid>

              <Grid direction="column" gap="s">
                {#if statusTasks.length === 0}
                  <div class="empty-state">No tasks</div>
                {:else}
                  {#each statusTasks as task (task.id)}
                    <Task {task} projectId={data.project.slug || data.project.id} />
                  {/each}
                {/if}
              </Grid>

              <wa-button
                href={`/projects/${data.project.slug || data.project.id}/tasks/new?status=${status.id}`}
                size="xs"
                appearance="plain"
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
      isSync={data.project.type === 'sync' && data.project.provider !== 'github'}
      oncancel={() => (editingStatus = null)}
      onsuccess={() => (editingStatus = null)}
    />
  {/if}
</wa-dialog>


<style>
.panel {
  overflow: auto;
  margin-inline-end: calc(var(--wa-space-xl) * -1); /* It removes the right margin */
}
.status {
  --spacing: var(--wa-space-s);
  --width: 35rem;
  max-height: 100%;
  min-width: var(--width);
  max-width: var(--width);
  overflow: auto;
  background-color: var(--wa-color-neutral-05);

  @media (max-width: 1400px) {
    --width: 25rem;
  }
}
.status__counter {
  font-size: var(--wa-font-size-2xs);
  font-weight: 600;
}
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed var(--wa-color-neutral-50);
  font-size: var(--wa-font-size-s);
  color: var(--wa-color-neutral-70);
  padding: var(--wa-space-l) var(--wa-space-xs);
}
</style>
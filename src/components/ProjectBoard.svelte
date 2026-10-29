<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import Back from '@/components/Back.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import StatusForm from '@/components/StatusForm.svelte'
  import Task from '@/components/Task.svelte'
  import type { Project } from '@/types/project'
  import type { Status } from '@/types/status'
  import { isTaskAssignedToUser, type Task as TaskType } from '@/types/task'
  import type { User } from '@/types/user'

  interface Props {
    project: Project
    statuses: Status[]
    tasks: TaskType[]
    user?: User | null
    syncError?: string | null
    isReadOnly?: boolean
    backHref?: string
    taskHrefFn?: (task: TaskType) => string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form?: any
  }

  let {
    project,
    statuses,
    tasks: initialTasks,
    user = null,
    syncError = null,
    isReadOnly = false,
    backHref,
    taskHrefFn,
    form = null
  }: Props = $props()

  let isCreateDialogOpen = $state(false)
  let editingStatus = $state<Status | null>(null)
  let deletingStatus = $state<Status | null>(null)
  let tasks = $state<TaskType[]>([])
  let onlyMyTasks = $state(false)

  let resolvedBackHref = $derived(backHref ?? '/')
  let resolveTaskHref = $derived(
    taskHrefFn ?? ((t: TaskType) => `/projects/${project.slug || project.id}/tasks/${t.number ?? t.id}`)
  )

  function canDeleteStatus(status: Status): boolean {
    if (isReadOnly) return false
    if (project.type === 'local') return true
    if (project.provider === 'github') {
      const key = (status.key || status.id || '').toLowerCase()
      const name = (status.name || '').toLowerCase()
      return key !== 'open' && key !== 'closed' && name !== 'open' && name !== 'closed'
    }
    return false
  }

  $effect(() => {
    tasks = initialTasks
  })

  $effect(() => {
    onlyMyTasks = project.only_my_tasks ?? false
  })

  $effect(() => {
    if (form?.error) {
      if ('statusId' in form && form.statusId) {
        const found = statuses.find((s) => s.id === form.statusId)
        if (found) {
          editingStatus = found
        }
      } else if (project.type === 'local' && ('name' in form || 'order' in form)) {
        isCreateDialogOpen = true
      }
    }
  })

  let displayedTasks = $derived(
    onlyMyTasks ? tasks.filter((task) => isTaskAssignedToUser(task, user)) : tasks
  )

  let unassignedTasks = $derived(
    displayedTasks.filter((task) => !task.status || !statuses.some((s) => s.id === task.status))
  )

  let draggedTaskId = $state<string | null>(null)
  let dropTarget = $state<{
    statusId: string | null
    taskId: string
    position: 'top' | 'bottom'
  } | null>(null)

  function handleDragOver(event: DragEvent) {
    if (isReadOnly) return
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function handleTaskDragOver(
    event: DragEvent,
    statusId: string | null,
    targetTask: TaskType
  ) {
    if (isReadOnly) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }

    if (draggedTaskId === targetTask.id) {
      dropTarget = null
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = event.clientY < midY ? 'top' : 'bottom'

    dropTarget = {
      statusId,
      taskId: targetTask.id,
      position
    }
  }

  function clearDropTarget() {
    dropTarget = null
  }

  async function handleDrop(
    event: DragEvent,
    targetStatusId: string | null,
    targetIndex?: number
  ) {
    if (isReadOnly) return
    event.preventDefault()
    event.stopPropagation()
    clearDropTarget()
    const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId
    if (!taskId) return

    const targetTask = tasks.find((t) => t.id === taskId)
    if (!targetTask) return

    const previousTasks = [...tasks]

    // Determine tasks in current target column (excluding dragged task)
    const currentColumnTasks = tasks.filter(
      (t) => (targetStatusId ? t.status === targetStatusId : !t.status || !statuses.some((s) => s.id === t.status)) && t.id !== taskId
    )

    let finalIndex = currentColumnTasks.length
    if (typeof targetIndex === 'number') {
      finalIndex = Math.max(0, Math.min(targetIndex, currentColumnTasks.length))
    }

    // Check if position actually changed
    const currentStatusId = targetTask.status || null
    const existingIndexInSameStatus = tasks
      .filter((t) => (currentStatusId ? t.status === currentStatusId : !t.status || !statuses.some((s) => s.id === t.status)))
      .findIndex((t) => t.id === taskId)

    if (currentStatusId === targetStatusId && existingIndexInSameStatus === finalIndex) {
      draggedTaskId = null
      return
    }

    // Optimistic UI update
    const updatedTask = { ...targetTask, status: targetStatusId || null }
    currentColumnTasks.splice(finalIndex, 0, updatedTask)
    const otherTasks = tasks.filter(
      (t) => (targetStatusId ? t.status !== targetStatusId : Boolean(t.status) && statuses.some((s) => s.id === t.status)) && t.id !== taskId
    )
    tasks = [...otherTasks, ...currentColumnTasks]

    const formData = new FormData()
    formData.append('taskId', taskId)
    formData.append('statusId', targetStatusId || '')
    formData.append('targetIndex', String(finalIndex))

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
    } finally {
      draggedTaskId = null
    }
  }

  async function handleMoveStatus(statusId: string, direction: 'left' | 'right') {
    if (isReadOnly) return
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
    <Back href={resolvedBackHref} title={project.name}>
      {#if project.type === 'sync'}
        <wa-badge variant="neutral">
          <wa-icon slot="start" family="brands" name={project.provider}></wa-icon>
          {project.provider ?? 'Sync'}
        </wa-badge>
      {:else}
        <wa-badge variant="brand">Local</wa-badge>
      {/if}
      {#if isReadOnly}
        <wa-badge variant="neutral">Read-only</wa-badge>
      {:else if project.privacy === 'public'}
        <wa-badge variant="neutral">Shared</wa-badge>
      {/if}
    </Back>

    <Grid align="center" gap="s">
      {#if !isReadOnly}
        {#if user}
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
        {/if}

        <wa-button href={`/projects/${project.slug || project.id}/tasks/new`} size="s" variant="brand">
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
            href={`/projects/${project.slug || project.id}/edit`}
          >
            <wa-icon slot="icon" name="pen-to-square" variant="solid"></wa-icon>
            Edit Project
          </wa-dropdown-item>
          {#if project.privacy === 'public' && project.share_token}
            <wa-dropdown-item
              value="share-link"
              href={`/share/${project.share_token}`}
              target="_blank"
            >
              <wa-icon slot="icon" name="arrow-up-right-from-square" variant="solid"></wa-icon>
              View Share Link
            </wa-dropdown-item>
          {/if}
          {#if project.type === 'local' || project.provider === 'github'}
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
      {/if}
      
      {#if project.repo_url}
        <wa-button href={project.repo_url} target="_blank" rel="noreferrer">
          <wa-icon slot="start" name="link" variant="solid"></wa-icon>
          {project.provider === 'jira' ? 'Jira' : 'Repository'}
        </wa-button>
      {/if}
    </Grid>
  </Grid>

  {#if syncError}
    <wa-callout variant="danger">
      <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
      {syncError}
    </wa-callout>
  {/if}

  {#if form?.error && !('statusId' in form) && !('name' in form)}
    <wa-callout variant="danger">
      <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
      {form.error}
    </wa-callout>
  {/if}

  {#if statuses.length === 0}
    <wa-card>
      <Grid direction="column" align="center" gap="s">
        <p>No statuses found for this project.</p>
        {#if project.type === 'local' && !isReadOnly}
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
        {#each statuses as status, statusIndex (status.id)}
          {@const statusTasks = displayedTasks.filter((task) => task.status === status.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-card
            class="status"
            ondragover={isReadOnly ? undefined : handleDragOver}
            ondrop={isReadOnly ? undefined : ((e: DragEvent) => handleDrop(e, status.id))}
          >
            <Grid direction="column" gap="s">
              <Grid align="center" justify="space-between">
                <Grid align="center" gap="xs">
                  <wa-icon name="circle" style={`color: ${status.color || 'var(--wa-color-neutral-50)'}`} variant="regular"></wa-icon>
                  <strong>{status.name}</strong>
                  <wa-badge variant="neutral" pill appearance="filled-outlined" class="status__counter">{statusTasks.length}</wa-badge>
                </Grid>
                {#if !isReadOnly}
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
                        } else if (val === 'delete') {
                          deletingStatus = status
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
                        disabled={statusIndex === statuses.length - 1}
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
                      {#if canDeleteStatus(status)}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <wa-dropdown-item
                          value="delete"
                          variant="danger"
                          onclick={() => (deletingStatus = status)}
                        >
                          <wa-icon slot="icon" name="trash" variant="regular"></wa-icon>
                          Delete status
                        </wa-dropdown-item>
                      {/if}
                    </wa-dropdown>
                  </Grid>
                {/if}
              </Grid>

              <Grid direction="column" gap="s">
                {#if statusTasks.length === 0}
                  <div class="empty-state">No tasks</div>
                {:else}
                  {#each statusTasks as task, taskIndex (task.id)}
                    <div
                      class="task-dropzone"
                      class:drop-top={dropTarget?.statusId === status.id &&
                        dropTarget?.taskId === task.id &&
                        dropTarget?.position === 'top'}
                      class:drop-bottom={dropTarget?.statusId === status.id &&
                        dropTarget?.taskId === task.id &&
                        dropTarget?.position === 'bottom'}
                      ondragover={isReadOnly
                        ? undefined
                        : (e) => handleTaskDragOver(e, status.id, task)}
                      ondrop={isReadOnly
                        ? undefined
                        : (e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            const midY = rect.top + rect.height / 2
                            const targetIdx = e.clientY < midY ? taskIndex : taskIndex + 1
                            handleDrop(e, status.id, targetIdx)
                          }}
                    >
                      <Task
                        {task}
                        href={resolveTaskHref(task)}
                        draggable={!isReadOnly}
                        ondragstart={() => (draggedTaskId = task.id)}
                        ondragend={() => {
                          draggedTaskId = null
                          clearDropTarget()
                        }}
                      />
                    </div>
                  {/each}
                {/if}
              </Grid>

              {#if !isReadOnly}
                <wa-button
                  href={`/projects/${project.slug || project.id}/tasks/new?status=${status.id}`}
                  size="xs"
                  appearance="plain"
                  variant="neutral"
                >
                  <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
                  New Task
                </wa-button>
              {/if}
            </Grid>
          </wa-card>
        {/each}

        {#if unassignedTasks.length > 0}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-card
            ondragover={isReadOnly ? undefined : handleDragOver}
            ondrop={isReadOnly ? undefined : ((e: DragEvent) => handleDrop(e, null))}
          >
            <Grid direction="column" gap="s">
              <Grid align="center" justify="space-between">
                <strong>No Status</strong>
                <wa-badge variant="neutral">{unassignedTasks.length}</wa-badge>
              </Grid>

              <Grid direction="column" gap="s">
                {#each unassignedTasks as task, taskIndex (task.id)}
                  <div
                    class="task-dropzone"
                    class:drop-top={dropTarget?.statusId === null &&
                      dropTarget?.taskId === task.id &&
                      dropTarget?.position === 'top'}
                    class:drop-bottom={dropTarget?.statusId === null &&
                      dropTarget?.taskId === task.id &&
                      dropTarget?.position === 'bottom'}
                    ondragover={isReadOnly
                      ? undefined
                      : (e) => handleTaskDragOver(e, null, task)}
                    ondrop={isReadOnly
                      ? undefined
                      : (e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const midY = rect.top + rect.height / 2
                          const targetIdx = e.clientY < midY ? taskIndex : taskIndex + 1
                          handleDrop(e, null, targetIdx)
                        }}
                  >
                    <Task
                      {task}
                      href={resolveTaskHref(task)}
                      draggable={!isReadOnly}
                      ondragstart={() => (draggedTaskId = task.id)}
                      ondragend={() => {
                        draggedTaskId = null
                        clearDropTarget()
                      }}
                    />
                  </div>
                {/each}
              </Grid>
            </Grid>
          </wa-card>
        {/if}
      </Grid>
    </div>
  {/if}
</Grid>

{#if !isReadOnly}
  <wa-dialog
    label="New Status"
    open={isCreateDialogOpen}
    onwa-after-hide={() => (isCreateDialogOpen = false)}
  >
    <StatusForm
      defaultOrder={statuses.length}
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
        isSync={project.type === 'sync' && project.provider !== 'github'}
        oncancel={() => (editingStatus = null)}
        onsuccess={() => (editingStatus = null)}
      />
    {/if}
  </wa-dialog>

  {#if deletingStatus}
    <ConfirmDialog
      open={Boolean(deletingStatus)}
      title="Delete Status"
      message={`Are you sure you want to delete status "${deletingStatus.name}"? Any tasks in this column will become unassigned.`}
      confirmLabel="Delete Status"
      confirmVariant="danger"
      action="?/deleteStatus"
      oncancel={() => {
        deletingStatus = null
      }}
      onconfirm={() => {
        deletingStatus = null
      }}
    >
      <input type="hidden" name="statusId" value={deletingStatus.id} />
    </ConfirmDialog>
  {/if}
{/if}

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
.task-dropzone {
  position: relative;
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    background-color: var(--wa-color-brand-50);
    border-radius: var(--wa-border-radius-pill, 9999px);
    display: none;
    pointer-events: none;
    z-index: 10;
  }
  &.drop-top::before {
    display: block;
    top: calc(var(--wa-space-s) * -0.5);
  }
  &.drop-bottom::after {
    display: block;
    bottom: calc(var(--wa-space-s) * -0.5);
  }
}
</style>

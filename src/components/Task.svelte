<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { Task, TaskPriority } from '@/types/task'

  interface Props {
    task: Task
    projectId?: string
    ondragstart?: (event: DragEvent) => void
    ondragend?: (event: DragEvent) => void
  }

  let { task, projectId, ondragstart, ondragend }: Props = $props()

  let isDragging = $state(false)
  let projectIdentifier = $derived(projectId ?? task.project)

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
        return 'success'
      case 'lowest':
      default:
        return 'neutral'
    }
  }

  function handleDragStart(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', task.id)
      event.dataTransfer.effectAllowed = 'move'
    }
    isDragging = true
    ondragstart?.(event)
  }

  function handleDragEnd(event: DragEvent) {
    setTimeout(() => {
      isDragging = false
    }, 100)
    ondragend?.(event)
  }

  function handleClick(event: MouseEvent) {
    if (isDragging) {
      event.preventDefault()
    }
  }
</script>

<a
  class="task"
  href={`/projects/${projectIdentifier}/tasks/${task.number ?? task.id}`}
  draggable="true"
  ondragstart={handleDragStart}
  ondragend={handleDragEnd}
  onclick={handleClick}
>
  <wa-card>
    <Grid direction="column" gap="xs">
      <Grid justify="space-between" align="center">
        <h3 data-appearance="p">
          {#if task.number}
            <span class="task__number">#{task.number}{' '}</span>
          {/if}
          {task.title}
        </h3>
        {#if task.expand?.assigned}
          {@const initials = (task.expand.assigned.name || task.expand.assigned.email || '?')[0]}
          <wa-avatar initials={initials} title={task.expand.assigned.name || task.expand.assigned.email}></wa-avatar>
        {/if}
      </Grid>
      <Grid gap="xs" wrap={true}>
        {#if task.priority}
          <wa-badge size="s" pill variant={getPriorityVariant(task.priority)}>
            {task.priority}
          </wa-badge>
        {/if}
        {#if task.labels && task.labels.length > 0}
          {#each task.labels as label (label)}
            <wa-badge size="s" pill variant="neutral">
              {label}
            </wa-badge>
          {/each}
        {/if}
        {#if task.branches && task.branches.length > 0}
          <wa-badge size="s" pill variant="neutral" title={`${task.branches.length} branch(es)`}>
            <wa-icon slot="start" name="code-branch" variant="solid"></wa-icon>
            {task.branches.length}
          </wa-badge>
        {/if}
        {#if task.relationships && task.relationships.length > 0}
          <wa-badge size="s" pill variant="neutral" title={`${task.relationships.length} relationship(s)`}>
            <wa-icon slot="start" name="link" variant="solid"></wa-icon>
            {task.relationships.length}
          </wa-badge>
        {/if}
      </Grid>
    </Grid>
  </wa-card>
</a>

<style>
.task {
  text-decoration: none;
  &:hover {
    > wa-card {
      background-color: var(--wa-color-brand-05);
    }
  }
}
wa-card {
  --spacing: var(--wa-space-s);
  transition: background-color .2s ease;
}
h3 {
  font-size: var(--wa-font-size-s);
}
.task__number {
  color: var(--wa-color-neutral-70);
}
wa-avatar {
  --size: 2.4rem;
  font-size: calc(var(--size) * 0.6);
}
</style>

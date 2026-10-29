<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import { getLabelInfo, getPriorityIcon, getPriorityVariant, type Task } from '@/types/task'

  interface Props {
    task: Task
    projectId?: string
    href?: string
    draggable?: boolean
    ondragstart?: (event: DragEvent) => void
    ondragend?: (event: DragEvent) => void
  }

  let { task, projectId, href, draggable = true, ondragstart, ondragend }: Props = $props()

  let isDragging = $state(false)
  let projectIdentifier = $derived(projectId ?? task.project)
  let taskHref = $derived(href ?? `/projects/${projectIdentifier}/tasks/${task.number ?? task.id}`)

  function handleDragStart(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', task.id)
      event.dataTransfer.effectAllowed = 'move'
    }
    isDragging = true
    ondragstart?.(event)
  }

  function handleDragEnd(event: DragEvent) {
    isDragging = false
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
  class:task--dragging={isDragging}
  href={taskHref}
  draggable={draggable ? 'true' : 'false'}
  ondragstart={draggable ? handleDragStart : undefined}
  ondragend={draggable ? handleDragEnd : undefined}
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
          {@const priorityIcon = getPriorityIcon(task.priority)}
          <wa-badge size="s" pill variant={getPriorityVariant(task.priority)} title={task.priority}>
            {#if priorityIcon}
              <wa-icon name={priorityIcon} variant="solid"></wa-icon>
            {/if}
          </wa-badge>
        {/if}
        {#if task.labels && task.labels.length > 0}
          {#each task.labels as item (typeof item === 'string' ? item : item.name)}
            {@const label = getLabelInfo(item)}
            <wa-badge
              size="s"
              pill
              variant="neutral"
              style={label.color ? `--label-color: ${label.color};` : undefined}
            >
              {label.name}
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
.task--dragging {
  opacity: 0.4;
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

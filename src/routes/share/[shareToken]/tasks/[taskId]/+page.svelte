<script lang="ts">
  import Back from '@/components/Back.svelte'
  import Grid from '@/components/Grid.svelte'
  import Markdown from '@/components/Markdown.svelte'
  import type { PageData } from './$types'
  import {
    getLabelInfo,
    getOriginalTaskUrl,
    getPriorityIcon,
    getPriorityLabel,
    getPriorityVariant,
    getRelBadgeVariant,
    getRelationshipLabel,
    getTaskAssignedUser,
    getTaskStatus
  } from '@/types/task'

  let { data }: { data: PageData } = $props()

  let cancelHref = $derived(`/share/${data.shareToken}`)
  let resolvedCancelHref = $derived(cancelHref ?? `/projects/${data.project.slug || data.project.id}`)
  let originalTaskUrl = $derived(getOriginalTaskUrl(data.task, data.project))
</script>

<div class="l-container l-container--s">
  <Grid direction="column">
    <Grid justify="space-between" align="center" wrap={true} gap="s">
      <Back href={resolvedCancelHref} title={`#${data.task.number} ${data.task.title}`} />
      {#if originalTaskUrl}
        <wa-button
          href={originalTaskUrl}
          target="_blank"
          rel="noreferrer"
          variant="neutral"
          size="s"
        >
          <wa-icon slot="start" family="brands" name={data.project.provider}></wa-icon>
          Original Task
          <wa-icon slot="end" name="arrow-up-right-from-square" variant="solid"></wa-icon>
        </wa-button>
      {/if}
    </Grid>

    <wa-card>
      <Grid direction="column" gap="l">
        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Description</h3>
          <wa-card class="markdown">
            <Markdown content={data.task.description} placeholder="No description provided." />
          </wa-card>
        </Grid>

        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Priority</h3>
          {#if data.task.priority}
            {@const icon = getPriorityIcon(data.task.priority)}
            {@const label = getPriorityLabel(data.task.priority)}
            {@const variant = getPriorityVariant(data.task.priority)}
            <Grid align="center" gap="xs">
              <wa-badge size="s" pill {variant}>
                {#if icon}
                  <wa-icon slot="start" name={icon} variant="solid"></wa-icon>
                {/if}
                {label}
              </wa-badge>
            </Grid>
          {:else}
            <p class="u-text-small">No priority</p>
          {/if}
        </Grid>

        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Status</h3>
          {@const status = getTaskStatus(data.task.status, data.statuses)}
          {#if status}
            <Grid align="center" gap="xs">
              <wa-badge size="s" pill variant="neutral">
                <wa-icon slot="start" name="circle-dot" variant="solid"></wa-icon>
                {status.name}
              </wa-badge>
            </Grid>
          {:else}
            <p class="u-text-small">No status</p>
          {/if}
        </Grid>

        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Assigned</h3>
          {@const assignedUser = getTaskAssignedUser(data.task.assigned, data.users, data.task.expand?.assigned)}
          {#if assignedUser}
            <Grid align="center" gap="xs">
              <wa-badge size="s" pill variant="neutral">
                <wa-icon slot="start" name="user" variant="solid"></wa-icon>
                {assignedUser.name}
              </wa-badge>
            </Grid>
          {:else}
            <p class="u-text-small">Not assigned</p>
          {/if}
        </Grid>

        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Labels</h3>
          {#if data.task.labels?.length}
            <Grid gap="xs" wrap={true}>
              {#each data.task.labels as item (typeof item === 'string' ? item : item.name)}
                {@const labelInfo = getLabelInfo(item)}
                <wa-badge size="s" pill variant="neutral">
                  <wa-icon slot="start" name="tag" variant="solid"></wa-icon>
                  {labelInfo.name}
                </wa-badge>
              {/each}
            </Grid>
          {:else}
            <p class="u-text-small">No label</p>
          {/if}
        </Grid>

        <Grid direction="column" gap="xs">
          <h3 data-appearance="h6">Relationships</h3>
          {#if data.task.relationships?.length}
            <Grid direction="column" gap="xs">
              {#each data.task.relationships as relationship (relationship.taskId + relationship.type)}
                {@const targetTask = data.availableTasks.find((t) => t.id === relationship.taskId || String(t.number) === relationship.taskId)}
                {@const taskNum = relationship.taskNumber ?? targetTask?.number}
                {@const taskTitle = relationship.taskTitle ?? targetTask?.title}
                {@const identifier = taskNum ?? relationship.taskId}
                <Grid align="center" gap="xs" wrap={true}>
                  <wa-badge size="s" pill variant={getRelBadgeVariant(relationship.type)}>
                    <wa-icon slot="start" name="link" variant="solid"></wa-icon>
                    {getRelationshipLabel(relationship.type)}
                  </wa-badge>
                  <a href={`/share/${data.shareToken}/tasks/${identifier}`}>
                    {#if taskNum}#{taskNum} {/if}{taskTitle || relationship.taskId}
                  </a>
                </Grid>
              {/each}
            </Grid>
          {:else}
            <p class="u-text-small">No relationship</p>
          {/if}
        </Grid>

        {#if data.task.branches?.length}
          <Grid direction="column" gap="xs">
            <h3 data-appearance="h6">Branches</h3>
            <Grid direction="column" gap="xs">
              {#each data.task.branches as branch (branch.name)}
                <Grid align="center" gap="xs">
                  <wa-icon name="code-branch" variant="solid"></wa-icon>
                  {#if branch.url}
                    <a href={branch.url} target="_blank" rel="noreferrer">
                      {branch.name}
                      <wa-icon name="arrow-up-right-from-square" variant="solid"></wa-icon>
                    </a>
                  {:else}
                    <span>{branch.name}</span>
                  {/if}
                </Grid>
              {/each}
            </Grid>
          </Grid>
        {/if}

        <Grid justify="end">
          <wa-button href={resolvedCancelHref}>
            <wa-icon slot="start" name="chevron-left"></wa-icon>
            Back
          </wa-button>
        </Grid>
      </Grid>
    </wa-card>
  </Grid>
</div>

<style>
.markdown {
  --spacing: var(--wa-space-s);
}
</style>

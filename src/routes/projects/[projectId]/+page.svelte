<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
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

    <wa-button href="/dashboard" size="small" variant="neutral">
      <wa-icon slot="start" name="arrow-left" variant="solid"></wa-icon>
      Dashboard
    </wa-button>
  </Grid>

  <wa-card>
    <Grid direction="column">
      {#if data.project.repo_url}
        <Grid align="center" gap="s">
          <wa-icon name="link" variant="solid"></wa-icon>
          <a href={data.project.repo_url} target="_blank" rel="noreferrer">
            {data.project.repo_url}
          </a>
        </Grid>
      {/if}

      <p>Kanban board coming soon.</p>
    </Grid>
  </wa-card>
</Grid>

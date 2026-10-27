<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Grid align="center" justify="space-between">
  <h2>Projects</h2>
  <wa-button href="/projects/new" variant="brand">
    <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
    Criar projeto
  </wa-button>
</Grid>

{#if data.projects.length === 0}
  <wa-card>
    <Grid direction="column" align="center" gap="s">
      <p>No projects found.</p>
      <wa-button href="/projects/new" variant="brand">
        <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
        Criar projeto
      </wa-button>
    </Grid>
  </wa-card>
{:else}
  <Grid wrap={true} break="small">
    {#each data.projects as project (project.id)}
      <wa-card>
        <Grid direction="column" gap="s">
          <Grid align="center" justify="space-between">
            <a href={`/projects/${project.id}`}>
              <strong>{project.name}</strong>
            </a>
            {#if project.type === 'sync'}
              <wa-badge variant="neutral">
                {#if project.provider === 'github'}
                  <wa-icon slot="start" family="brands" name="github"></wa-icon>
                {:else if project.provider === 'jira'}
                  <wa-icon slot="start" family="brands" name="jira"></wa-icon>
                {/if}
                {project.provider ?? 'Sync'}
              </wa-badge>
            {:else}
              <wa-badge variant="brand">Local</wa-badge>
            {/if}
          </Grid>

          {#if project.repo_url}
            <small>{project.repo_url}</small>
          {/if}

          <Grid justify="end" gap="s">
            <wa-button href={`/projects/${project.id}/edit`} size="small" variant="neutral">
              <wa-icon slot="start" name="pen-to-square" variant="solid"></wa-icon>
              Edit
            </wa-button>
            <wa-button href={`/projects/${project.id}`} size="small" variant="neutral">
              Open
            </wa-button>
          </Grid>
        </Grid>
      </wa-card>
    {/each}
  </Grid>
{/if}

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
      <a href={`/projects/${project.slug || project.id}`}>
        <wa-card>
          <Grid direction="column" gap="s">
            <Grid align="center" justify="space-between">
              <strong>{project.name}</strong>
              {#if project.type === 'sync'}
              <wa-badge variant="neutral">
                <wa-icon slot="start" family="brands" name="jira"></wa-icon>
                {project.provider ?? 'Sync'}
              </wa-badge>
              {:else}
              <wa-badge variant="brand">Local</wa-badge>
              {/if}
            </Grid>
          </Grid>
        </wa-card>
      </a>
    {/each}
  </Grid>
{/if}

<style>
a {
  text-decoration: none;
  &:hover {
    > wa-card {
      background-color: var(--wa-color-brand-05);
    }
  }
}
wa-card {
  width: 30rem;
  transition: background-color .2s ease;
}
</style>
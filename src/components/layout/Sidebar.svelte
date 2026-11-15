<script lang="ts">
import Grid from '@/components/layout/Grid.svelte'
import Logo from './Logo.svelte'
import type { Project } from '@/types/project'

let { projects }: { projects: Project[] } = $props()
</script>

<aside>
  <Grid direction="column">
    <Logo />
    <ul>
      {#if projects.length === 0}
        <p>No projects found.</p>
      {:else}
        <Grid direction="column" gap="none">
          {#each projects as project (project.id)}
            {@const projectHref = `/projects/${project.slug || project.id}`}
            <a href={projectHref}>
              <strong>{project.name}</strong>
              {#if project.type === 'sync'}
                <wa-badge variant="neutral">
                  <wa-icon slot="start" family="brands" name={project.provider}></wa-icon>
                  {project.provider ?? 'Sync'}
                </wa-badge>
              {:else}
                <wa-badge variant="brand">Local</wa-badge>
              {/if}
              {#if project.privacy === 'public'}
                <wa-badge variant="neutral">Shared</wa-badge>
              {/if}
            </a>
          {/each}
        </Grid>
      {/if}
    </ul>
  </Grid>
</aside>


<style>
aside {
  height: 100%;
  padding: var(--wa-space-l);
  background-color: var(--wa-color-surface-lowered);
  @media (max-width: 1024px) {
    display: none;
  }
}
a {
  display: flex;
  gap: var(--wa-space-2xs);
  padding-block: var(--wa-space-xs);
  *:first-child {
    flex: 1;
  }
}
</style>

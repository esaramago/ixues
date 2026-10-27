<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Grid direction="column" gap="xl">
  <Grid direction="column">
    <Grid align="center" gap="s">
      <wa-badge variant="brand">Issues</wa-badge>
      <wa-badge variant="neutral">v0.0.1</wa-badge>
    </Grid>

    <h1>Issues</h1>
    <p>
      An issue and task tracking web application built with SvelteKit, PocketBase, and WebAwesome.
    </p>

    <Grid wrap={true}>
      {#if data.user}
        <wa-button variant="brand" href="/dashboard">
          <wa-icon slot="start" name="gauge" variant="solid"></wa-icon>
          Dashboard
        </wa-button>
      {:else}
        <wa-button variant="brand" href="/login">
          <wa-icon slot="start" name="right-to-bracket" variant="solid"></wa-icon>
          Get Started
        </wa-button>
      {/if}
    </Grid>
  </Grid>

</Grid>

<script lang="ts">
  import Grid from '@/components/Grid.svelte'
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
      <wa-button variant="brand" href="/login">
        <wa-icon slot="start" name="right-to-bracket" variant="solid"></wa-icon>
        Get Started
      </wa-button>
    </Grid>
  </Grid>

  <Grid direction="column">
    <h2>Features & Stack</h2>

    <Grid wrap={true} break="small">
      <wa-card>
        <Grid direction="column" gap="s">
          <Grid align="center" gap="s">
            <wa-icon name="circle-dot" variant="solid"></wa-icon>
            <strong>Issue Tracking</strong>
          </Grid>
          <p>Organize, prioritize, and monitor issues with real-time updates.</p>
        </Grid>
      </wa-card>

      <wa-card>
        <Grid direction="column" gap="s">
          <Grid align="center" gap="s">
            <wa-icon name="bolt" variant="solid"></wa-icon>
            <strong>SvelteKit</strong>
          </Grid>
          <p>Fast and reactive web framework with SSR and server actions.</p>
        </Grid>
      </wa-card>

      <wa-card>
        <Grid direction="column" gap="s">
          <Grid align="center" gap="s">
            <wa-icon name="database" variant="solid"></wa-icon>
            <strong>PocketBase</strong>
          </Grid>
          <p>Lightweight SQLite backend with authentication and realtime subscriptions.</p>
        </Grid>
      </wa-card>

      <wa-card>
        <Grid direction="column" gap="s">
          <Grid align="center" gap="s">
            <wa-icon name="palette" variant="solid"></wa-icon>
            <strong>WebAwesome</strong>
          </Grid>
          <p>Accessible, customizable Web Components for consistent UI.</p>
        </Grid>
      </wa-card>
    </Grid>
  </Grid>
</Grid>

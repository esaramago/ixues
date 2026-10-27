<script lang="ts">
  import { page } from '$app/stores'
  import Grid from '@/components/Grid.svelte'
</script>

<header class="l-container">
  <Grid align="center" justify="space-between">
    <a href="/">
      <Grid align="center" gap="s">
        <wa-icon name="circle-dot" variant="solid"></wa-icon>
        <strong>Issues</strong>
      </Grid>
    </a>

    <Grid align="center" gap="s">
      {#if $page.data.user}
        <span>{$page.data.user.email}</span>
        <form method="POST" action="/logout">
          <wa-button size="small" type="submit" variant="neutral">Sign Out</wa-button>
        </form>
      {:else}
        <wa-button size="small" variant="brand" href="/login">Sign In</wa-button>
      {/if}
    </Grid>
  </Grid>
</header>

<style>
  header {
    padding: var(--wa-space-l) 0;
  }
</style>

<script lang="ts">
  import { page } from '$app/stores'
  import Grid from '@/components/layout/Grid.svelte'
  import Logo from './Logo.svelte'
</script>

<header>
  <Grid align="center" justify="space-between">

    <div class="is-hidden-desktop">
      <Logo />
    </div>

    <Grid align="center" gap="s">
      {#if $page.data.user}
        <wa-button size="s" variant="neutral" href="/tokens">
          <wa-icon slot="start" name="key" variant="solid"></wa-icon>
          Access Tokens
        </wa-button>
        <span>{$page.data.user.email}</span>
        <form method="POST" action="/logout">
          <wa-button size="s" type="submit" variant="neutral">Sign Out</wa-button>
        </form>
      {:else}
        <wa-button size="s" variant="brand" href="/login">Sign In</wa-button>
      {/if}
    </Grid>
  </Grid>
</header>

<style>
header {
  padding-block: var(--wa-space-l);
}
</style>

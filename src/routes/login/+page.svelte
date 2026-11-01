<script lang="ts">
  import Back from '@/components/Back.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
</script>

<div class="l-container l-container--xs">
  <wa-card>
    <Grid direction="column" gap="l">
      <Back href="/" title="Sign in" subtitle="Enter your credentials to access Ixues." />

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST">
        <Grid direction="column" gap="l">
          <Grid direction="column" gap="s">
            <Grid direction="column" gap="none">
              <label for="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form?.email ?? ''}
                required
              />
            </Grid>

            <Grid direction="column" gap="none">
              <label for="password">Password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </Grid>
          </Grid>

          <wa-button type="submit" variant="brand">Sign In</wa-button>
        </Grid>
      </form>
    </Grid>
  </wa-card>
</div>

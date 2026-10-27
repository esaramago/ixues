<script lang="ts">
  import Back from '@/components/Back.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
</script>

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
          <wa-input
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={form?.email ?? ''}
            required
          ></wa-input>

          <wa-input
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            password-toggle
            required
          ></wa-input>
        </Grid>

        <wa-button type="submit" variant="brand">Sign In</wa-button>
      </Grid>
    </form>
  </Grid>
</wa-card>

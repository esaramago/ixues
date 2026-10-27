<script lang="ts">
  import type { Snippet } from 'svelte'
  import Grid from '@/components/Grid.svelte'

  interface Props {
    href: string
    title?: string
    subtitle?: string
    children?: Snippet
  }

  let { href, title, subtitle, children }: Props = $props()
</script>

<a {href} aria-label="Back" class="back">
  <Grid align="center" gap="xs">
      <wa-icon name="arrow-left" variant="solid"></wa-icon>
    {#if subtitle}
      <Grid direction="column" gap="2xs">
        <Grid align="center" gap="s">
          {#if title}
            <h2>{title}</h2>
          {/if}
          {#if children}
            {@render children()}
          {/if}
        </Grid>
        <p>{subtitle}</p>
      </Grid>
    {:else}
      {#if title}
        <h2>{title}</h2>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    {/if}
  </Grid>
</a>


<style>
.back {
  text-decoration: none;
  transition: color .2s;
  &:hover {
    color: var(--wa-color-neutral-80)
  }
}
</style>
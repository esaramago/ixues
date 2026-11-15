<script lang="ts">
import Grid from '@/components/layout/Grid.svelte'
import Logo from './Logo.svelte'
</script>

<aside>
  <Logo />
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
</style>
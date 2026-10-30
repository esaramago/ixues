<script lang="ts">
  import { navigating, page } from '$app/state'
  import '@/css/main.css'
  import '@awesome.me/webawesome/dist/styles/webawesome.css'
  import '@awesome.me/webawesome/dist/components/avatar/avatar.js'
  import '@awesome.me/webawesome/dist/components/badge/badge.js'
  import '@awesome.me/webawesome/dist/components/button/button.js'
  import '@awesome.me/webawesome/dist/components/callout/callout.js'
  import '@awesome.me/webawesome/dist/components/card/card.js'
  import '@awesome.me/webawesome/dist/components/color-picker/color-picker.js'
  import '@awesome.me/webawesome/dist/components/dialog/dialog.js'
  import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js'
  import '@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js'
  import '@awesome.me/webawesome/dist/components/icon/icon.js'
  import '@awesome.me/webawesome/dist/components/input/input.js'
  import '@awesome.me/webawesome/dist/components/option/option.js'
  import '@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js'
  import '@awesome.me/webawesome/dist/components/radio/radio.js'
  import '@awesome.me/webawesome/dist/components/radio-group/radio-group.js'
  import '@awesome.me/webawesome/dist/components/select/select.js'
  import '@awesome.me/webawesome/dist/components/spinner/spinner.js'
  import '@awesome.me/webawesome/dist/components/tab/tab.js'
  import '@awesome.me/webawesome/dist/components/tab-group/tab-group.js'
  import '@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js'
  import '@awesome.me/webawesome/dist/components/markdown/markdown.js'
  import '@awesome.me/webawesome/dist/components/textarea/textarea.js'
  import '@awesome.me/webawesome/dist/components/checkbox/checkbox.js'
  import Header from '@/components/Header.svelte'

  let { children } = $props()
</script>

<svelte:head>
  <title>{page.data.title ?? 'Ixues'}</title>
</svelte:head>

{#if navigating.to}
  <wa-progress-bar indeterminate></wa-progress-bar>
{/if}
<Header />
<main class="l-container">
  {@render children?.()}
</main>
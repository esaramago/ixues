<script lang="ts">
  import type { Spacing, Break, Justify, Align, Direction } from '@/types/grid'

  export let tag: keyof HTMLElementTagNameMap = 'div'
  export let direction: Direction | undefined = undefined
  export let align: Align | undefined = undefined
  export let justify: Justify | undefined = undefined
  export let gap: Spacing | undefined = undefined
  export let wrap: boolean | undefined = undefined
  export let fullWidth: boolean = false

  // 'break' is a reserved keyword in JavaScript/TypeScript.
  // We create an internal variable and export it with the name parent components will use.
  let breakProp: Break | undefined = undefined
  export { breakProp as break }

  // Reactive creation of the inline styles string (equivalent to Vue's computed)
  $: gridStyle = [
    gap ? `--gap: var(--wa-space-${gap})` : '',
    align ? `--align: ${align}` : '',
    justify ? `--justify: ${justify}` : '',
    wrap !== undefined ? `--wrap: ${wrap ? 'wrap' : 'nowrap'}` : '',
    direction ? `--direction: ${direction}` : '',
  ]
    .filter(Boolean)
    .join(';')
</script>

<svelte:element
  this={tag}
  class="l-grid {breakProp ? `break--${breakProp}` : ''}"
  class:l-grid--full-width={fullWidth}
  style={gridStyle || undefined}
>
  <slot />
</svelte:element>

<style>
  .l-grid {
    --gap: var(--wa-space-m);
    --align: initial;
    --justify: initial;
    --wrap: initial;
    --direction: initial;
    display: flex;
    flex-direction: var(--direction);
    gap: var(--gap);
    align-items: var(--align);
    justify-content: var(--justify);
    flex-wrap: var(--wrap);
  }

  .l-grid--full-width > :global(*) {
    width: 100%;
    flex: 1;
  }

  @media (max-width: 767px) {
    .break--mobile {
      flex-direction: column;
      flex-wrap: wrap;
    }
  }

  @media (max-width: 1023px) {
    .break--small {
      flex-direction: column;
      flex-wrap: wrap;
    }
  }

  :global(.l-grid > [data-grow='1']) {
    flex-grow: 1;
  }
</style>

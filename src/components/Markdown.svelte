<script lang="ts">
  interface Props {
    content?: string
    placeholder?: string
  }

  let { content = '', placeholder }: Props = $props()
  let mdEl = $state<HTMLElement | null>(null)
  let trimmed = $derived(content.trim())

  $effect(() => {
    if (trimmed && mdEl) {
      let script = mdEl.querySelector<HTMLScriptElement>('script[type="text/markdown"]')
      if (!script) {
        script = document.createElement('script')
        script.type = 'text/markdown'
        mdEl.appendChild(script)
      }
      script.textContent = content
      const md = mdEl as unknown as { renderMarkdown?: () => void }
      if (md.renderMarkdown) {
        md.renderMarkdown()
      } else if (typeof customElements !== 'undefined') {
        customElements.whenDefined('wa-markdown').then(() => {
          ;(mdEl as unknown as { renderMarkdown?: () => void })?.renderMarkdown?.()
        })
      }
    }
  })
</script>

{#if trimmed}
  <wa-markdown bind:this={mdEl}>
    <script type="text/markdown"></script>
  </wa-markdown>
{:else if placeholder}
  <p class="u-text-small">{placeholder}</p>
{/if}

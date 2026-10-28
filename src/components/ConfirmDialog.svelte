<script lang="ts">
  import { enhance } from '$app/forms'
  import type { Snippet } from 'svelte'
  import Grid from '@/components/Grid.svelte'

  type ButtonVariant = 'brand' | 'neutral' | 'success' | 'warning' | 'danger'

  interface Props {
    open?: boolean
    title?: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    confirmVariant?: ButtonVariant
    action?: string
    loading?: boolean
    onconfirm?: () => void | Promise<void>
    oncancel?: () => void
    children?: Snippet
  }

  let {
    open = $bindable(false),
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'danger',
    action,
    loading = false,
    onconfirm,
    oncancel,
    children
  }: Props = $props()

  let isSubmitting = $state(false)

  function handleCancel() {
    open = false
    oncancel?.()
  }

  function handleConfirm() {
    onconfirm?.()
    if (!action) {
      open = false
    }
  }

  function handleFormSubmit() {
    onconfirm?.()
  }

  function handleAfterHide() {
    if (open) {
      open = false
      oncancel?.()
    }
  }
</script>

<wa-dialog
  label={title}
  {open}
  onwa-after-hide={handleAfterHide}
>
  {#if action}
    <form
      method="POST"
      {action}
      onsubmit={handleFormSubmit}
      use:enhance={() => {
        isSubmitting = true
        return async ({ result, update }) => {
          isSubmitting = false
          await update()
          if (result.type === 'success') {
            open = false
            onconfirm?.()
          }
        }
      }}
    >
      <Grid direction="column" gap="l">
        {#if message}
          <p>{message}</p>
        {/if}
        {#if children}
          {@render children()}
        {/if}

        <Grid justify="end" gap="s">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <wa-button variant="neutral" type="button" onclick={handleCancel}>
            {cancelLabel}
          </wa-button>
          <wa-button variant={confirmVariant} type="submit" loading={loading || isSubmitting}>
            {confirmLabel}
          </wa-button>
        </Grid>
      </Grid>
    </form>
  {:else}
    <Grid direction="column" gap="l">
      {#if message}
        <p>{message}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}

      <Grid justify="end" gap="s">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button variant="neutral" type="button" onclick={handleCancel}>
          {cancelLabel}
        </wa-button>
        <wa-button variant={confirmVariant} type="button" onclick={handleConfirm} loading={loading || isSubmitting}>
          {confirmLabel}
        </wa-button>
      </Grid>
    </Grid>
  {/if}
</wa-dialog>

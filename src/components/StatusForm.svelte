<script lang="ts">
  import { enhance } from '$app/forms'
  import Grid from '@/components/Grid.svelte'
  import type { Status } from '@/types/status'

  export interface StatusFormData {
    error?: string
    statusId?: string
    name?: string
    order?: string | number
    color?: string | null
  }

  interface Props {
    status?: Status | null
    form?: StatusFormData | null
    defaultOrder?: number
    action?: string
    submitLabel?: string
    isSync?: boolean
    oncancel?: () => void
    onsuccess?: () => void
  }

  let {
    status = null,
    form = null,
    defaultOrder = 0,
    action,
    submitLabel,
    isSync = false,
    oncancel,
    onsuccess
  }: Props = $props()

  let isEdit = $derived(!!status)
  let resolvedAction = $derived(action ?? (isEdit ? '?/updateStatus' : '?/createStatus'))
  let resolvedSubmitLabel = $derived(submitLabel ?? (isEdit ? 'Save Changes' : 'Create Status'))

  let isRelevantForm = $derived(
    isEdit ? form?.statusId === status?.id : !form?.statusId
  )
  let currentError = $derived(isRelevantForm ? form?.error : undefined)
  let currentName = $derived(
    isRelevantForm && form?.name !== undefined
      ? form.name
      : (status?.name ?? '')
  )
  let currentOrder = $derived(
    isRelevantForm && form?.order !== undefined
      ? String(form.order)
      : (status?.order !== undefined ? String(status.order) : '')
  )
  let currentColor = $derived(
    isRelevantForm && form?.color !== undefined
      ? (form.color ?? '')
      : (status?.color ?? '')
  )
</script>

<form
  method="POST"
  action={resolvedAction}
  use:enhance={() => {
    return async ({ result, update }) => {
      await update()
      if (result.type === 'success') {
        onsuccess?.()
      }
    }
  }}
>
  {#if status?.id}
    <input type="hidden" name="statusId" value={status.id} />
  {/if}

  <Grid direction="column" gap="l">
    {#if currentError}
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
        {currentError}
      </wa-callout>
    {/if}

    <wa-input
      name="name"
      label="Status Name"
      placeholder="e.g. Backlog, In Progress, Done"
      value={currentName}
      required
      readonly={isSync}
      hint={isSync ? 'Managed by the provider' : undefined}
    ></wa-input>

    <wa-input
      name="order"
      type="number"
      label="Order"
      placeholder={String(defaultOrder)}
      hint="Display order on the board (optional)"
      min="0"
      value={currentOrder}
    ></wa-input>

    <wa-color-picker
      name="color"
      label="Color"
      hint="Hex color code (optional)"
      value={currentColor}
    ></wa-color-picker>

    <Grid justify="end" gap="s">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <wa-button variant="neutral" type="button" onclick={() => oncancel?.()}>
        Cancel
      </wa-button>
      <wa-button type="submit" variant="brand">{resolvedSubmitLabel}</wa-button>
    </Grid>
  </Grid>
</form>

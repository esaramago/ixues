<script lang="ts">
  import { enhance } from '$app/forms'
  import Back from '@/components/Back.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { ProviderType, UserToken } from '@/types/token'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let isModalOpen = $state(false)
  let isDeleteConfirmOpen = $state(false)
  let tokenToDelete = $state<UserToken | null>(null)
  let editingToken = $state<UserToken | null>(null)

  let modalName = $state('')
  let modalProvider = $state<ProviderType>('github')
  let modalToken = $state('')
  let isSubmitting = $state(false)

  function openCreateModal(provider?: ProviderType) {
    editingToken = null
    modalProvider = provider || 'github'
    modalName = provider ? (provider === 'github' ? 'GitHub' : 'Jira') : 'GitHub'
    modalToken = ''
    isModalOpen = true
  }

  function openEditModal(token: UserToken) {
    editingToken = token
    modalProvider = token.provider
    modalName = token.name || (token.provider === 'github' ? 'GitHub' : 'Jira')
    modalToken = ''
    isModalOpen = true
  }

  function openDeleteConfirm(token: UserToken) {
    tokenToDelete = token
    isDeleteConfirmOpen = true
  }

  function handleModalClose() {
    isModalOpen = false
    editingToken = null
    modalToken = ''
  }

  function handleNameInput(event: Event) {
    modalName = (event.target as HTMLInputElement).value
  }

  function handleProviderChange(event: Event) {
    modalProvider = (event.target as HTMLInputElement).value as ProviderType
    if (!modalName || modalName === 'GitHub' || modalName === 'Jira') {
      modalName = modalProvider === 'github' ? 'GitHub' : 'Jira'
    }
  }

  function handleTokenInput(event: Event) {
    modalToken = (event.target as HTMLInputElement).value
  }
</script>

<Grid direction="column" gap="l">
  <Back
    href="/"
    title="Access Tokens"
    subtitle="Configure personal access tokens for external integrations (GitHub, Jira)"
  />

  {#if form?.error}
    <wa-callout variant="danger">
      <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
      {form.error}
    </wa-callout>
  {/if}

  <Grid align="center" justify="space-between">
    <h2>Personal Access Tokens</h2>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <wa-button variant="brand" onclick={() => openCreateModal()}>
      <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
      Add Token
    </wa-button>
  </Grid>

  {#if data.tokens.length === 0}
    <wa-card>
      <Grid direction="column" align="center" gap="s">
        <p>No access tokens configured yet.</p>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button variant="brand" onclick={() => openCreateModal()}>
          <wa-icon slot="start" name="plus" variant="solid"></wa-icon>
          Add Token
        </wa-button>
      </Grid>
    </wa-card>
  {:else}
    <Grid wrap={true} break="small">
      {#each data.tokens as token (token.id)}
        <wa-card>
          <Grid direction="column" gap="s">
            <Grid align="center" justify="space-between">
              <strong>{token.name || (token.provider === 'github' ? 'GitHub' : 'Jira')}</strong>
              <wa-badge variant="neutral">
                <wa-icon slot="start" family="brands" name={token.provider}></wa-icon>
                {token.provider === 'github' ? 'GitHub' : 'Jira'}
              </wa-badge>
            </Grid>

            <p class="u-text-muted">••••••••••••••••</p>

            <Grid align="center" justify="space-between">
              <small>{token.updated ? new Date(token.updated).toLocaleDateString() : ''}</small>
              <Grid align="center" gap="xs">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <wa-button size="s" variant="neutral" onclick={() => openEditModal(token)}>
                  <wa-icon slot="start" name="pen" variant="regular"></wa-icon>
                  Edit
                </wa-button>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <wa-button size="s" variant="danger" onclick={() => openDeleteConfirm(token)}>
                  <wa-icon slot="start" name="trash" variant="regular"></wa-icon>
                  Delete
                </wa-button>
              </Grid>
            </Grid>
          </Grid>
        </wa-card>
      {/each}
    </Grid>
  {/if}
</Grid>

<wa-dialog
  label={editingToken ? 'Update Access Token' : 'Add Access Token'}
  open={isModalOpen}
  onwa-after-hide={handleModalClose}
>
  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      isSubmitting = true
      return async ({ update, result }) => {
        isSubmitting = false
        if (result.type === 'success') {
          handleModalClose()
        }
        await update()
      }
    }}
  >
    <Grid direction="column" gap="s">
      <wa-input
        label="Name"
        name="name"
        value={modalName}
        oninput={handleNameInput}
        placeholder="e.g. Personal GitHub"
      ></wa-input>

      <wa-select
        label="Provider"
        name="provider"
        value={modalProvider}
        onchange={handleProviderChange}
        required
      >
        <wa-option value="github">GitHub</wa-option>
        <wa-option value="jira">Jira</wa-option>
      </wa-select>

      <wa-input
        label="Token"
        name="token"
        type="password"
        password-toggle
        value={modalToken}
        oninput={handleTokenInput}
        placeholder={editingToken ? '•••••••••••••••• (Enter new token to replace)' : 'Enter token value'}
        required
      >
        {#if modalProvider === 'jira'}
          <span slot="hint">
            Enter your Jira API token (or email:token). Generate one at
            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
              Atlassian API Tokens
            </a>.
          </span>
        {:else}
          <span slot="hint">
            Personal access token for GitHub authentication. Generate one at
            <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
              GitHub Personal Access Tokens
            </a>.
          </span>
        {/if}
      </wa-input>

      <Grid justify="end" gap="s">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <wa-button variant="neutral" onclick={handleModalClose}>Cancel</wa-button>
        <wa-button type="submit" variant="brand" disabled={isSubmitting}>
          {editingToken ? 'Update' : 'Save'}
        </wa-button>
      </Grid>
    </Grid>
  </form>
</wa-dialog>

<ConfirmDialog
  open={isDeleteConfirmOpen}
  title="Delete Access Token"
  message="Are you sure you want to delete this access token? Projects relying on it will no longer be able to synchronize without a project-specific token."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  action="?/delete"
  oncancel={() => {
    isDeleteConfirmOpen = false
    tokenToDelete = null
  }}
>
  <input type="hidden" name="tokenId" value={tokenToDelete?.id || ''} />
</ConfirmDialog>

<script lang="ts">
  import { page } from '$app/stores'
  import Back from '@/components/Back.svelte'
  import ConfirmDialog from '@/components/ConfirmDialog.svelte'
  import Grid from '@/components/Grid.svelte'
  import type { Project } from '@/types/project'
  import type { UserToken } from '@/types/token'

  export interface ProjectFormData {
    error?: string
    name?: string
    type?: 'local' | 'sync'
    provider?: string
    repoUrl?: string
    token?: string
    onlyMyTasks?: boolean
    privacy?: 'private' | 'public'
  }

  interface Props {
    project?: Project | null
    form?: ProjectFormData | null
    userTokens?: UserToken[]
    heading?: string
    subheading?: string
    action?: string
    deleteAction?: string
    showDelete?: boolean
    cancelHref?: string
    submitLabel?: string
    oncancel?: () => void
  }

  let {
    project = null,
    form = null,
    userTokens = [],
    heading,
    subheading,
    action,
    deleteAction = '?/delete',
    showDelete = true,
    cancelHref,
    submitLabel,
    oncancel
  }: Props = $props()

  let isEdit = $derived(!!project)
  let resolvedHeading = $derived(
    heading ?? (isEdit ? 'Edit Project' : 'New Project')
  )
  let resolvedSubheading = $derived(
    subheading ??
      (isEdit
        ? 'Update project details or external provider settings.'
        : 'Create a local project or synchronize with an external provider.')
  )
  let resolvedAction = $derived(action ?? (isEdit ? '?/update' : undefined))
  let resolvedCancelHref = $derived(
    cancelHref ?? (isEdit && project?.id ? `/projects/${project.slug || project.id}` : '/')
  )
  let resolvedSubmitLabel = $derived(
    submitLabel ?? (isEdit ? 'Save Changes' : 'Create Project')
  )
  let shareUrl = $derived(
    project?.share_token ? `${$page.url.origin}/share/${project.share_token}` : ''
  )

  let projectName = $state('')
  let projectType = $state<'local' | 'sync'>('local')
  let selectedProvider = $state('github')
  let repoUrl = $state('')
  let token = $state('')
  let onlyMyTasks = $state(false)
  let projectPrivacy = $state<'private' | 'public'>('private')
  let prevKey = $state('')
  let isConfirmOpen = $state(false)

  let matchingUserTokens = $derived(
    userTokens.filter((t) => t.provider === selectedProvider && t.has_token)
  )

  let tokenSource = $state<'user' | 'custom'>('user')
  let selectedUserTokenId = $state<string>('')

  $effect(() => {
    const currentKey = project?.id ?? 'new'
    if (currentKey !== prevKey) {
      prevKey = currentKey
      projectName = project?.name || ''
      projectType = project?.type || 'local'
      selectedProvider = project?.provider || 'github'
      repoUrl = project?.repo_url || ''
      token = ''
      onlyMyTasks = Boolean(project?.only_my_tasks)
      projectPrivacy = project?.privacy || 'private'

      if (project?.user_token) {
        tokenSource = 'user'
        selectedUserTokenId = project.user_token
      } else if (project?.has_token) {
        tokenSource = 'custom'
        selectedUserTokenId = ''
      } else {
        const available = userTokens.filter(
          (t) => t.provider === (project?.provider || 'github') && t.has_token
        )
        if (available.length > 0) {
          tokenSource = 'user'
          selectedUserTokenId = available[0].id
        } else {
          tokenSource = 'custom'
          selectedUserTokenId = ''
        }
      }
    }
    if (form?.name !== undefined) {
      projectName = form.name
    }
    if (form?.type) {
      projectType = form.type
    }
    if (form?.provider !== undefined) {
      selectedProvider = form.provider
    }
    if (form?.repoUrl !== undefined) {
      repoUrl = form.repoUrl
    }
    if (form?.token !== undefined) {
      token = form.token
    }
    if (form?.onlyMyTasks !== undefined) {
      onlyMyTasks = Boolean(form.onlyMyTasks)
    }
    if (form?.privacy !== undefined) {
      projectPrivacy = form.privacy
    }
  })

  function handleNameChange(event: Event) {
    projectName = (event.target as HTMLInputElement).value
  }

  function handleTypeChange(event: Event) {
    projectType = (event.target as HTMLInputElement).value as 'local' | 'sync'
  }

  function handleProviderChange(event: Event) {
    selectedProvider = (event.target as HTMLInputElement).value
    const available = userTokens.filter(
      (t) => t.provider === selectedProvider && t.has_token
    )
    if (available.length > 0) {
      tokenSource = 'user'
      selectedUserTokenId = available[0].id
    } else {
      tokenSource = 'custom'
      selectedUserTokenId = ''
    }
  }

  function handleTokenSelectionChange(event: Event) {
    const val = (event.target as HTMLInputElement).value
    if (val.startsWith('user:')) {
      tokenSource = 'user'
      selectedUserTokenId = val.slice(5)
    } else {
      tokenSource = 'custom'
      selectedUserTokenId = ''
    }
  }

  function handleRepoUrlChange(event: Event) {
    repoUrl = (event.target as HTMLInputElement).value
  }

  function handleTokenChange(event: Event) {
    token = (event.target as HTMLInputElement).value
  }

  function handlePrivacyChange(event: Event) {
    projectPrivacy = (event.target as HTMLInputElement).value as 'private' | 'public'
  }
</script>

<div class="l-container l-container--s">
  <wa-card>
    <Grid direction="column" gap="l">
      <Back href={resolvedCancelHref} title={resolvedHeading} subtitle={resolvedSubheading} />

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST" action={resolvedAction}>
        <Grid direction="column" gap="l">
          <wa-input
            name="name"
            label="Project Name"
            placeholder="e.g. Website Redesign"
            value={projectName}
            oninput={handleNameChange}
            required
          ></wa-input>

          <wa-radio-group
            label="Project Type"
            name="type"
            value={projectType}
            onchange={handleTypeChange}
          >
            <wa-radio value="local" checked={projectType === 'local'}>Local</wa-radio>
            <wa-radio value="sync" checked={projectType === 'sync'}>Synchronization</wa-radio>
          </wa-radio-group>

          <wa-radio-group
            label="Privacy"
            name="privacy"
            value={projectPrivacy}
            onchange={handlePrivacyChange}
          >
            <wa-radio value="private" checked={projectPrivacy === 'private'}>Private (Only you)</wa-radio>
            <wa-radio value="public" checked={projectPrivacy === 'public'}>Share Link (Anyone with secret URL)</wa-radio>
          </wa-radio-group>

          {#if projectPrivacy === 'public'}
            {#if isEdit && project?.share_token}
              <wa-input
                label="Share Link"
                value={shareUrl}
                readonly
                hint="Anyone with this secret link has read-only access to this project."
              >
                <wa-icon slot="start" name="link" variant="solid"></wa-icon>
                <wa-copy-button slot="end" value={shareUrl}></wa-copy-button>
              </wa-input>

              <wa-checkbox name="regenerateShareToken" value="true">
                Regenerate share link (revokes the previous link)
              </wa-checkbox>
            {:else}
              <small>A secret shareable link will be generated upon saving.</small>
            {/if}
          {/if}

          {#if projectType === 'sync'}
            <wa-select
              name="provider"
              label="Provider"
              value={selectedProvider}
              onchange={handleProviderChange}
              required
            >
              <wa-option value="github">
                <wa-icon slot="start" family="brands" name="github"></wa-icon>
                GitHub
              </wa-option>
              <wa-option value="codeberg">
                <wa-icon slot="start" family="brands" name="codeberg"></wa-icon>
                Codeberg
              </wa-option>
              <wa-option value="jira">
                <wa-icon slot="start" family="brands" name="jira"></wa-icon>
                Jira
              </wa-option>
            </wa-select>

            <wa-input
              name="repoUrl"
              type="url"
              label="Repository URL"
              placeholder={selectedProvider === 'jira'
                ? 'https://your-domain.atlassian.net'
                : selectedProvider === 'codeberg'
                  ? 'https://codeberg.org/user/repository'
                  : 'https://github.com/user/repository'}
              hint={selectedProvider === 'jira'
                ? 'Enter your Jira domain URL'
                : selectedProvider === 'codeberg'
                  ? 'Enter the Codeberg repository URL'
                  : 'Enter the GitHub repository URL'}
              value={repoUrl}
              oninput={handleRepoUrlChange}
              required
            ></wa-input>

            {#if matchingUserTokens.length > 0}
              <wa-select
                label="Authentication Token"
                value={tokenSource === 'user' ? `user:${selectedUserTokenId}` : 'custom'}
                onchange={handleTokenSelectionChange}
              >
                {#each matchingUserTokens as ut (ut.id)}
                  <wa-option value={`user:${ut.id}`}>
                    Use saved token ({ut.name || (ut.provider === 'github' ? 'GitHub' : ut.provider === 'codeberg' ? 'Codeberg' : 'Jira')})
                  </wa-option>
                {/each}
                <wa-option value="custom">Custom token for this project</wa-option>
              </wa-select>

              <input type="hidden" name="tokenSource" value={tokenSource} />
              <input type="hidden" name="userTokenId" value={tokenSource === 'user' ? selectedUserTokenId : ''} />

              {#if tokenSource === 'custom'}
                <wa-input
                  name="token"
                  type="password"
                  label="Custom Authentication Token"
                  placeholder={project?.has_token
                    ? '•••••••••••••••• (Leave blank to keep current token)'
                    : (selectedProvider === 'jira'
                      ? 'e.g. Jira API Token'
                      : 'e.g. Personal Access Token')}
                  value={token}
                  oninput={handleTokenChange}
                  password-toggle
                >
                  <span slot="hint">
                    {#if selectedProvider === 'jira'}
                      Enter your Jira API token (or email:token). Generate one at
                      <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                        Atlassian API Tokens
                      </a>.
                    {:else if selectedProvider === 'codeberg'}
                      Personal access token for Codeberg authentication. Generate one at
                      <a href="https://codeberg.org/user/settings/applications" target="_blank" rel="noreferrer">
                        Codeberg Applications Settings
                      </a>.
                    {:else}
                      Personal access token for GitHub authentication. Generate one at
                      <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
                        GitHub Personal Access Tokens
                      </a>.
                    {/if}
                  </span>
                </wa-input>

                {#if isEdit && project?.has_token}
                  <wa-checkbox name="removeToken" value="true">
                    Remove custom authentication token
                  </wa-checkbox>
                {/if}
              {:else}
                <small class="u-text-muted">
                  Using your saved {selectedProvider === 'jira' ? 'Jira' : selectedProvider === 'codeberg' ? 'Codeberg' : 'GitHub'} access token. Manage your tokens in
                  <a href="/tokens">Access Tokens</a>.
                </small>
              {/if}
            {:else}
              <input type="hidden" name="tokenSource" value="custom" />
              <wa-input
                name="token"
                type="password"
                label="Authentication Token"
                placeholder={project?.has_token
                  ? '•••••••••••••••• (Leave blank to keep current token)'
                  : (selectedProvider === 'jira'
                    ? 'e.g. Jira API Token'
                    : 'e.g. Personal Access Token')}
                value={token}
                oninput={handleTokenChange}
                password-toggle
              >
                <span slot="hint">
                  {#if selectedProvider === 'jira'}
                    Enter your Jira API token (or email:token). Generate one at
                    <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer">
                      Atlassian API Tokens
                    </a>, or configure a reusable token in
                    <a href="/tokens">Access Tokens</a>.
                  {:else if selectedProvider === 'codeberg'}
                    Personal access token for Codeberg authentication. Generate one at
                    <a href="https://codeberg.org/user/settings/applications" target="_blank" rel="noreferrer">
                      Codeberg Applications Settings
                    </a>, or configure a reusable token in
                    <a href="/tokens">Access Tokens</a>.
                  {:else}
                    Personal access token for GitHub authentication. Generate one at
                    <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
                      GitHub Personal Access Tokens
                    </a>, or configure a reusable token in
                    <a href="/tokens">Access Tokens</a>.
                  {/if}
                </span>
              </wa-input>

              {#if isEdit && project?.has_token}
                <wa-checkbox name="removeToken" value="true">
                  Remove saved authentication token
                </wa-checkbox>
              {/if}
            {/if}
          {/if}

          <wa-checkbox
            name="onlyMyTasks"
            value="true"
            checked={onlyMyTasks}
            onchange={(e: Event) => (onlyMyTasks = (e.target as HTMLInputElement).checked)}
          >
            Only show tasks assigned to me by default
          </wa-checkbox>

          {#if isEdit && showDelete}
            <Grid justify="space-between" align="center">
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <wa-button
                type="button"
                variant="danger"
                onclick={() => (isConfirmOpen = true)}
              >
                Delete Project
              </wa-button>

              <Grid justify="end" gap="s">
                {#if oncancel}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <wa-button variant="neutral" type="button" onclick={oncancel}>Cancel</wa-button>
                {:else}
                  <wa-button variant="neutral" href={resolvedCancelHref}>Cancel</wa-button>
                {/if}
                <wa-button type="submit" variant="brand">{resolvedSubmitLabel}</wa-button>
              </Grid>
            </Grid>
          {:else}
            <Grid justify="end" gap="s">
              {#if oncancel}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <wa-button variant="neutral" type="button" onclick={oncancel}>Cancel</wa-button>
              {:else}
                <wa-button variant="neutral" href={resolvedCancelHref}>Cancel</wa-button>
              {/if}
              <wa-button type="submit" variant="brand">{resolvedSubmitLabel}</wa-button>
            </Grid>
          {/if}
        </Grid>
      </form>
    </Grid>
  </wa-card>
</div>

{#if isEdit && showDelete}
  <ConfirmDialog
    bind:open={isConfirmOpen}
    title="Delete Project"
    message="Are you sure you want to delete this project? All associated tasks and statuses will also be deleted. This action cannot be undone."
    confirmLabel="Delete Project"
    confirmVariant="danger"
    action={deleteAction}
  />
{/if}

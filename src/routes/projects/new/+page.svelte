<script lang="ts">
  import Grid from '@/components/Grid.svelte'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()

  let projectType = $state<'local' | 'sync'>('local')
  let selectedProvider = $state('github')

  $effect(() => {
    if (form?.type) {
      projectType = form.type
    }
    if (form?.provider) {
      selectedProvider = form.provider
    }
  })

  function handleTypeChange(event: Event) {
    projectType = (event.target as HTMLInputElement).value as 'local' | 'sync'
  }

  function handleProviderChange(event: Event) {
    selectedProvider = (event.target as HTMLInputElement).value
  }
</script>

<Grid direction="column" gap="xl" align="center">
  <wa-card>
    <Grid direction="column" gap="l">
      <Grid direction="column" gap="xs">
        <h2>New Project</h2>
        <p>Create a local project or synchronize with an external provider.</p>
      </Grid>

      {#if form?.error}
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="circle-exclamation" variant="solid"></wa-icon>
          {form.error}
        </wa-callout>
      {/if}

      <form method="POST">
        <Grid direction="column" gap="l">
          <wa-input
            name="name"
            label="Project Name"
            placeholder="e.g. Website Redesign"
            value={form?.name ?? ''}
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
                : 'https://github.com/user/repository'}
              hint={selectedProvider === 'jira'
                ? 'Enter your Jira domain URL'
                : 'Enter the GitHub repository URL'}
              value={form?.repoUrl ?? ''}
              required
            ></wa-input>
          {/if}

          <Grid justify="end" gap="s">
            <wa-button variant="neutral" href="/">Cancel</wa-button>
            <wa-button type="submit" variant="brand">Create Project</wa-button>
          </Grid>
        </Grid>
      </form>
    </Grid>
  </wa-card>
</Grid>

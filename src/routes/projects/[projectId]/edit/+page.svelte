<script lang="ts">
  import ProjectForm from '@/components/ProjectForm.svelte'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<ProjectForm project={data.project} {form} />

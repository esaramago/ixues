<script lang="ts">
  import ProjectForm from '@/components/ProjectForm.svelte'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
</script>

<ProjectForm {form} />

<script lang="ts">
  import TaskForm from '@/components/TaskForm.svelte'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<TaskForm
  project={data.project}
  statuses={data.statuses}
  defaultStatus={data.defaultStatus}
  {form}
/>


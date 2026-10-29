<script lang="ts">
  import TaskForm from '@/components/TaskForm.svelte'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<TaskForm
  project={data.project}
  task={data.task}
  statuses={data.statuses}
  users={data.users}
  availableLabels={data.availableLabels}
  availableTasks={data.availableTasks}
  readonly={data.isReadOnly}
  {form}
/>


<script lang="ts">
  import TaskForm from '@/components/TaskForm.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<TaskForm
  project={data.project}
  task={data.task}
  statuses={data.statuses}
  users={data.users}
  availableLabels={data.availableLabels}
  availableTasks={data.availableTasks}
  cancelHref={`/share/${data.shareToken}`}
  readonly={true}
/>

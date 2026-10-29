<script lang="ts">
  import ProjectBoard from '@/components/ProjectBoard.svelte'
  import type { ActionData, PageData } from './$types'

  let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<ProjectBoard
  project={data.project}
  statuses={data.statuses}
  tasks={data.tasks}
  user={data.user}
  syncError={data.syncError}
  isReadOnly={false}
  {form}
/>

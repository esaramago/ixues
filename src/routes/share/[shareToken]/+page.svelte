<script lang="ts">
  import ProjectBoard from '@/components/ProjectBoard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<ProjectBoard
  project={data.project}
  statuses={data.statuses}
  tasks={data.tasks}
  syncError={data.syncError}
  isReadOnly={true}
  backHref="/"
  taskHrefFn={(task) => `/share/${data.shareToken}/tasks/${task.number ?? task.id}`}
/>

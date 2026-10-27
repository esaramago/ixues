export interface Status {
  id: string
  created?: string
  updated?: string
  name: string
  project: string
  order: number
  color?: string | null
  user: string
}

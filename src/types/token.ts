export type ProviderType = 'github' | 'jira' | 'codeberg'

export interface UserToken {
  id: string
  created?: string
  updated?: string
  name?: string
  provider: ProviderType
  token?: string | null
  has_token?: boolean
  user: string
}

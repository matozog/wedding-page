export type Profile = {
  id: string
  displayName: string | null
  email: string | null
  isAnonymous: boolean
  // Super admin - zarządza wszystkimi wydarzeniami (profiles.is_platform_admin).
  isSuperAdmin: boolean
}

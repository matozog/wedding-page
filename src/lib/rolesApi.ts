import type { AppRole } from '../types/role'
import { supabase } from './supabase'

export const fetchMyRole = async (): Promise<AppRole> => {
  const { data, error } = await supabase.from('user_roles').select('role').maybeSingle()

  if (error) {
    console.error('Role fetch error:', error)
    return 'GUEST'
  }

  return (data?.role as AppRole | undefined) ?? 'GUEST'
}

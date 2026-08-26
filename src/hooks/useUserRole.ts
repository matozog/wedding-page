import { useCallback, useEffect, useState } from 'react'
import { fetchMyRole } from '../lib/rolesApi'
import { supabase } from '../lib/supabase'
import type { AppRole } from '../types/role'

export function useUserRole() {
  const [role, setRole] = useState<AppRole>('GUEST')

  const refreshRole = useCallback(async () => {
    const value = await fetchMyRole()
    setRole(value)
  }, [])

  useEffect(() => {
    refreshRole()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshRole()
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [refreshRole])

  return { role }
}

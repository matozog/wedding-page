import type { Profile } from '../types/profile'
import { supabase } from './supabase'

export const fetchMyProfile = async (): Promise<Profile | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, is_anonymous')
    .eq('id', session.user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    displayName: data.display_name,
    email: data.email,
    isAnonymous: data.is_anonymous,
  }
}

// Nazwa wyświetlana jest globalna (jedna dla wszystkich wydarzeń).
export const setDisplayName = async (displayName: string) => {
  const { error } = await supabase.rpc('set_display_name', {
    p_display_name: displayName,
  })

  if (error) {
    throw error
  }
}

import type { Profile } from '../types/profile'
import { supabase } from './supabase'

export const fetchMyProfile = async (): Promise<Profile | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  // Kolumna email w profiles jest niedostępna dla klientów (prywatność
  // uczestników) - własny e-mail bierzemy z sesji.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, is_anonymous')
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
    email: session.user.email ?? null,
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

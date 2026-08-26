import type { EventSession } from '../types/event'
import { supabase } from './supabase'

export const joinEvent = async (code: string): Promise<EventSession | null> => {
  // Sprawdź, czy klient ma już sesję
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  // Jeśli nie ma sesji, utwórz anonimowego użytkownika
  if (!session) {
    const { error: authError } = await supabase.auth.signInAnonymously()

    if (authError) {
      throw authError
    }
  }

  // Teraz auth.uid() w funkcji PostgreSQL powinno być dostępne
  const { data, error } = await supabase.rpc('join_event', {
    p_input_code: code,
  })

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return null
  }

  const event = data[0]

  return {
    id: event.id,
    name: event.name,
    guest_session_id: event.guest_session_id,
  }
}

export const setNickname = async (nickname: string) => {
  return supabase.rpc('set_nickname', {
    input_nickname: nickname,
  })
}

// Zwykłe logowanie (nie linkIdentity) - dla tego samego konta Google zawsze
// wraca ten sam, stały auth.uid(), więc join_event bezpiecznie odnajduje
// istniejący guest_session zamiast tworzyć duplikat (ON CONFLICT DO NOTHING).
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })

  if (error) {
    throw error
  }
}

// Po nieudanym/anulowanym logowaniu Supabase wraca z parametrami błędu
// w query i/lub hashu URL.
export const readAuthRedirectErrorCode = (): string | null => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)

  return hashParams.get('error_code') ?? searchParams.get('error_code')
}

export const clearAuthRedirectParams = () => {
  window.history.replaceState(null, '', window.location.pathname)
}

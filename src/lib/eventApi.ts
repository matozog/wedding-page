import type { EventSession } from '../types/event'
import type { EventRole } from '../types/role'
import { supabase } from './supabase'

// Kod błędu zwracany przez join_event() po zbyt wielu nieudanych próbach.
export const RATE_LIMIT_ERROR_CODE = 'PT429'

// Błąd przekierowania, gdy konto Google jest już powiązane z innym
// użytkownikiem i nie da się go podpiąć do bieżącego konta anonimowego.
export const IDENTITY_ALREADY_EXISTS_ERROR_CODE = 'identity_already_exists'

export const getErrorCode = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
    ? err.code
    : null

export const getErrorMessage = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
    ? err.message
    : null

const getAuthRedirectUrl = () => window.location.origin + import.meta.env.BASE_URL

// Każdy gość ma konto w Supabase - jeśli nie jest zalogowany, dostaje
// konto anonimowe (profil w public.profiles tworzy trigger w bazie).
const ensureAuthSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  if (session) {
    return
  }

  const { error: authError } = await supabase.auth.signInAnonymously()

  if (authError) {
    throw authError
  }
}

export const joinEvent = async (code: string): Promise<EventSession | null> => {
  await ensureAuthSession()

  const { data, error } = await supabase.rpc('join_event', {
    p_access_code: code,
  })

  if (error) {
    throw error
  }

  const event = data?.[0]

  if (!event) {
    return null
  }

  return {
    id: event.event_id,
    name: event.event_name,
    startsAt: event.starts_at,
    role: event.role,
  }
}

// Aktualna rola zalogowanego użytkownika w wydarzeniu, null gdy nie jest
// (już) jego członkiem.
export const fetchMyEventRole = async (eventId: string): Promise<EventRole | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  const { data, error } = await supabase
    .from('event_members')
    .select('role')
    .eq('event_id', eventId)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.role ?? null
}

// Gość anonimowy: podpinamy Google do jego obecnego konta (linkIdentity),
// więc zachowuje to samo ID, członkostwo w wydarzeniu i zdjęcia.
// Bez sesji anonimowej: zwykłe logowanie.
export const signInWithGoogle = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user.is_anonymous) {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() },
    })

    if (error) {
      throw error
    }

    return
  }

  await signInWithExistingGoogleAccount()
}

// Zwykłe logowanie Google - używane też, gdy konto Google jest już powiązane
// z innym użytkownikiem i linkIdentity się nie udało.
export const signInWithExistingGoogleAccount = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl() },
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

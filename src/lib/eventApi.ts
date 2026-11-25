import type { EventPreview, EventSession } from '../types/event'
import type { EventRole } from '../types/role'
import { supabase } from './supabase'

// Kod błędu zwracany przez join_event() po zbyt wielu nieudanych próbach.
export const RATE_LIMIT_ERROR_CODE = 'PT429'

export const getErrorCode = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
    ? err.code
    : null

export const getErrorMessage = (err: unknown): string | null =>
  typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
    ? err.message
    : null

// path - adres w aplikacji (np. ROUTES.events), na który wraca Google.
const getAuthRedirectUrl = (path = '/') =>
  window.location.origin + import.meta.env.BASE_URL + path.replace(/^\//, '')

// Sesja jest potrzebna już do sprawdzenia kodu (limit prób liczony na
// użytkownika). Konto anonimowe nie ma jeszcze profilu - ten powstaje
// dopiero w join_event() razem z pseudonimem. Porzucone konta bez profilu
// usuwa codzienne zadanie w bazie.
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

// Sprawdza kod bez dołączania do wydarzenia. null dla błędnego kodu.
export const checkEventCode = async (code: string): Promise<EventPreview | null> => {
  await ensureAuthSession()

  const { data, error } = await supabase.rpc('check_event_code', {
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
  }
}

// Dołącza do wydarzenia. Gość bez profilu musi podać pseudonim - profil
// powstaje wtedy w tej samej transakcji co członkostwo. Sesja mogła zniknąć
// od sprawdzenia kodu (wylogowanie w innej karcie, usunięte porzucone
// konto) - wtedy powstaje nowa sesja anonimowa.
export const joinEvent = async (
  code: string,
  displayName?: string
): Promise<EventSession | null> => {
  await ensureAuthSession()

  const { data, error } = await supabase.rpc('join_event', {
    p_access_code: code,
    p_display_name: displayName,
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

// Supabase sam odnajduje istniejące konto po tożsamości Google, a gdy go
// nie ma - zakłada nowe. Jedno przekierowanie do Google.
//
// returnPath - adres powrotu (musi pasować do listy Redirect URLs w Supabase).
// selectAccount - Google zawsze pokazuje wybór konta (np. po zalogowaniu na
// konto bez uprawnień organizatora).
export const signInWithGoogle = async ({
  returnPath,
  selectAccount = false,
}: { returnPath?: string; selectAccount?: boolean } = {}) => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(returnPath),
      queryParams: selectAccount ? { prompt: 'select_account' } : undefined,
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

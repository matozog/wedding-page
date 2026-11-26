import { supabase } from './supabase'

// Parametr adresu z tokenem zaproszenia: https://…/?zaproszenie=<token>
export const INVITE_PARAM = 'zaproszenie'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/

// Token z bieżącego adresu (null, gdy go nie ma albo ma zły format).
export const readInviteTokenFromUrl = (): string | null => {
  const token = new URLSearchParams(window.location.search).get(INVITE_PARAM)
  return token && TOKEN_PATTERN.test(token) ? token : null
}

// Usuwa token z paska adresu (bez nowego wpisu w historii) - nie zostaje
// w zakładkach ani przy kopiowaniu adresu strony.
export const clearInviteParamFromUrl = () => {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(INVITE_PARAM)) return
  url.searchParams.delete(INVITE_PARAM)
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

export const buildInviteUrl = (token: string) => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.searchParams.set(INVITE_PARAM, token)
  return url.toString()
}

// Link zaproszenia zalogowanego użytkownika (token powstaje przy pierwszym
// użyciu). PT403 - użytkownik nie może udostępniać tego wydarzenia.
export const fetchMyInviteUrl = async (eventId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('get_my_invite_token', { p_event_id: eventId })

  if (error) {
    throw error
  }

  return buildInviteUrl(data)
}

// Włącznik udostępniania przez gości (super admin).
export const setEventGuestSharing = async (eventId: string, enabled: boolean) => {
  const { error } = await supabase.rpc('set_event_guest_sharing', {
    p_event_id: eventId,
    p_enabled: enabled,
  })

  if (error) {
    throw error
  }
}

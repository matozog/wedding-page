import { useCallback, useEffect, useState } from 'react'
import {
  clearAuthRedirectParams,
  joinEvent,
  readAuthRedirectErrorCode,
  setNickname as saveNicknameApi,
  signInWithGoogle,
} from '../lib/eventApi'
import { PENDING_GOOGLE_CODE_KEY, SESSION_STORAGE_KEY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import type { EventSession } from '../types/event'

type StoredSession = {
  session: EventSession
  nickname: string
  hasNickname: boolean
}

const loadStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

const saveStoredSession = (value: StoredSession | null) => {
  try {
    if (value) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // localStorage niedostępny (np. prywatna karta) - sesja nie zostanie zapamiętana
  }
}

export function useEventSession() {
  const stored = loadStoredSession()

  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState(stored?.nickname ?? '')
  const [session, setSession] = useState<EventSession | null>(stored?.session ?? null)
  const [hasNickname, setHasNickname] = useState(stored?.hasNickname ?? false)
  const [error, setError] = useState<string | null>(null)

  const checkCode = useCallback(async () => {
    setError(null)

    try {
      const event = await joinEvent(code)

      if (!event) {
        setError('Nieprawidłowy kod.')
        return
      }

      setSession(event)
      saveStoredSession({ session: event, nickname: '', hasNickname: false })
    } catch (err) {
      console.error(err)
      setError('Wystąpił błąd.')
    }
  }, [code])

  const persistNickname = useCallback(async (value: string, currentSession: EventSession) => {
    const { error: apiError } = await saveNicknameApi(value)

    if (apiError) {
      throw apiError
    }

    setNickname(value)
    setHasNickname(true)
    saveStoredSession({ session: currentSession, nickname: value, hasNickname: true })
  }, [])

  const saveNickname = useCallback(async () => {
    const value = nickname.trim()

    if (!value) {
      setError('Wpisz pseudonim.')
      return false
    }

    if (!session) {
      return false
    }

    setError(null)

    try {
      await persistNickname(value, session)
      return true
    } catch (err) {
      console.error(err)
      setError('Nie udało się zapisać pseudonimu.')
      return false
    }
  }, [nickname, session, persistNickname])

  const loginWithGoogle = useCallback(async () => {
    setError(null)

    // Zapamiętaj wpisany kod wydarzenia - logowanie Google to zwykłe
    // (nie-linkujące) logowanie, więc po powrocie trzeba ponownie odpalić
    // join_event pod nową tożsamością, żeby dostać właściwy guest_session.
    try {
      sessionStorage.setItem(PENDING_GOOGLE_CODE_KEY, code)
    } catch {
      // sessionStorage niedostępny - logowanie i tak zadziała, tylko po
      // powrocie trzeba będzie wpisać kod jeszcze raz
    }

    try {
      await signInWithGoogle()
    } catch (err) {
      console.error(err)
      setError('Nie udało się zalogować przez Google.')
    }
  }, [code])

  // Po powrocie z przekierowania Google: jeśli mamy zapamiętany kod
  // wydarzenia, dokończ join_event pod nową (Google) tożsamością zamiast
  // każąc użytkownikowi wpisywać kod jeszcze raz. Działa identycznie za
  // pierwszym logowaniem i po każdym kolejnym wylogowaniu, bo join_event
  // (ON CONFLICT DO NOTHING) zawsze trafia na ten sam guest_session dla
  // tego samego konta Google.
  useEffect(() => {
    let pendingCode: string | null = null

    try {
      pendingCode = sessionStorage.getItem(PENDING_GOOGLE_CODE_KEY)
    } catch {
      pendingCode = null
    }

    if (!pendingCode) {
      return
    }

    try {
      sessionStorage.removeItem(PENDING_GOOGLE_CODE_KEY)
    } catch {
      // ignore
    }

    let cancelled = false

    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (cancelled) {
        return
      }

      const hasGoogleIdentity = authSession?.user?.identities?.some(
        (identity) => identity.provider === 'google'
      )

      if (!hasGoogleIdentity) {
        return
      }

      cancelled = true

      joinEvent(pendingCode as string)
        .then((event) => {
          if (!event) {
            setError('Nie udało się dokończyć logowania - kod wydarzenia jest nieprawidłowy.')
            return
          }

          setSession(event)
          saveStoredSession({ session: event, nickname: '', hasNickname: false })
        })
        .catch((err) => {
          console.error(err)
          setError('Nie udało się dokończyć logowania przez Google.')
        })
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  // Pozostały po nieudanym/anulowanym logowaniu błąd w URL - wyczyść go
  // i pokaż komunikat, zamiast zostawiać go w pasku adresu.
  useEffect(() => {
    const errorCode = readAuthRedirectErrorCode()

    if (!errorCode) {
      return
    }

    clearAuthRedirectParams()
    setError('Logowanie przez Google nie powiodło się.')
  }, [])

  // Logowanie Google to przekierowanie na pełną stronę - po powrocie aplikacja
  // montuje się od nowa, więc dokończenie onboardingu (pseudonim = nazwa z Google)
  // musi wykryć już połączoną tożsamość przez onAuthStateChange.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (hasNickname || !session) {
        return
      }

      const googleIdentity = authSession?.user?.identities?.find(
        (identity) => identity.provider === 'google'
      )

      if (!googleIdentity) {
        return
      }

      const displayName =
        (googleIdentity.identity_data?.full_name as string | undefined) ??
        (googleIdentity.identity_data?.name as string | undefined) ??
        (googleIdentity.identity_data?.email as string | undefined) ??
        'Gość'

      persistNickname(displayName, session).catch((err) => {
        console.error(err)
        setError('Zalogowano przez Google, ale nie udało się dokończyć konfiguracji konta.')
      })
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [hasNickname, session, persistNickname])

  const logout = useCallback(() => {
    saveStoredSession(null)
    setCode('')
    setNickname('')
    setSession(null)
    setHasNickname(false)
    setError(null)
    supabase.auth.signOut().catch((err) => console.error('Sign out error:', err))
  }, [])

  return {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    hasNickname,
    error,
    setError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    logout,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  IDENTITY_ALREADY_EXISTS_ERROR_CODE,
  RATE_LIMIT_ERROR_CODE,
  clearAuthRedirectParams,
  fetchMyEventRole,
  getErrorCode,
  getErrorMessage,
  joinEvent,
  readAuthRedirectErrorCode,
  signInWithExistingGoogleAccount,
  signInWithGoogle,
} from '../lib/eventApi'
import { fetchMyProfile, setDisplayName } from '../lib/profileApi'
import { PENDING_GOOGLE_CODE_KEY, SESSION_STORAGE_KEY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import type { EventSession } from '../types/event'
import type { Profile } from '../types/profile'

// W localStorage trzymamy tylko wybrane wydarzenie i jego kod. Nazwa
// użytkownika i rola zawsze pochodzą z bazy (profiles / event_members).
type StoredSession = {
  session: EventSession
  accessCode: string
}

const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== 'object' || value === null) return false
  const { session, accessCode } = value as Partial<StoredSession>
  return (
    typeof accessCode === 'string' &&
    typeof session?.id === 'string' &&
    typeof session.name === 'string' &&
    typeof session.role === 'string'
  )
}

const loadStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isStoredSession(parsed) ? parsed : null
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

const readPendingGoogleCode = (): string | null => {
  try {
    return sessionStorage.getItem(PENDING_GOOGLE_CODE_KEY)
  } catch {
    return null
  }
}

const writePendingGoogleCode = (code: string | null) => {
  try {
    if (code) {
      sessionStorage.setItem(PENDING_GOOGLE_CODE_KEY, code)
    } else {
      sessionStorage.removeItem(PENDING_GOOGLE_CODE_KEY)
    }
  } catch {
    // sessionStorage niedostępny - po powrocie z Google trzeba będzie
    // wpisać kod jeszcze raz
  }
}

const hasGoogleIdentity = (authSession: Session | null) =>
  authSession?.user.identities?.some((identity) => identity.provider === 'google') ?? false

export function useEventSession() {
  const [stored, setStored] = useState<StoredSession | null>(loadStoredSession)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  // true do pierwszej synchronizacji z bazą - zapobiega mignięciu ekranu
  // pseudonimu, zanim przyjdzie profil
  const [initializing, setInitializing] = useState(true)

  const storedRef = useRef(stored)

  const updateStored = useCallback((value: StoredSession | null) => {
    storedRef.current = value
    saveStoredSession(value)
    setStored(value)
  }, [])

  const refreshProfile = useCallback(async () => {
    const value = await fetchMyProfile()
    setProfile(value)

    if (value?.displayName) {
      setNickname(value.displayName)
    }
  }, [])

  // Synchronizacja z bazą po każdej zmianie sesji Supabase (start aplikacji,
  // powrót z Google, wylogowanie).
  const syncWithAuth = useCallback(
    async (authSession: Session | null) => {
      if (!authSession) {
        setProfile(null)
        if (storedRef.current) {
          updateStored(null)
        }
        setInitializing(false)
        return
      }

      try {
        // Powrót z logowania Google: dokończ dołączenie do wydarzenia.
        // Po linkIdentity to to samo konto (join_event nic nie zmieni), po
        // zwykłym logowaniu to inne konto, które musi dołączyć od nowa.
        const pendingCode = readPendingGoogleCode()

        if (pendingCode && hasGoogleIdentity(authSession)) {
          writePendingGoogleCode(null)

          const event = await joinEvent(pendingCode)

          if (event) {
            updateStored({ session: event, accessCode: pendingCode })
          } else {
            updateStored(null)
            setError('Nie udało się dokończyć logowania - kod wydarzenia jest nieprawidłowy.')
          }
        } else if (storedRef.current) {
          // Rola mogła się zmienić (np. awans na EDITOR) albo użytkownik
          // mógł zostać usunięty z wydarzenia.
          const current = storedRef.current
          const role = await fetchMyEventRole(current.session.id)

          if (role) {
            if (role !== current.session.role) {
              updateStored({ ...current, session: { ...current.session, role } })
            }
          } else {
            updateStored(null)
            setError('Nie masz już dostępu do tego wydarzenia. Wpisz kod ponownie.')
          }
        }

        await refreshProfile()
      } catch (err) {
        console.error(err)
        setError('Nie udało się wczytać danych użytkownika.')
      } finally {
        setInitializing(false)
      }
    },
    [refreshProfile, updateStored]
  )

  useEffect(() => {
    // Nie wołamy Supabase bezpośrednio w callbacku onAuthStateChange
    // (zalecenie supabase-js - grozi zakleszczeniem), tylko w kolejnym ticku.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setTimeout(() => {
        void syncWithAuth(authSession)
      }, 0)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [syncWithAuth])

  // Błąd po powrocie z Google. Jeśli to konto Google jest już przypięte do
  // innego użytkownika, logujemy się na nie zwykłym logowaniem (kod
  // wydarzenia czeka w sessionStorage i zostanie użyty po powrocie).
  useEffect(() => {
    const errorCode = readAuthRedirectErrorCode()

    if (!errorCode) {
      return
    }

    clearAuthRedirectParams()

    if (errorCode === IDENTITY_ALREADY_EXISTS_ERROR_CODE && readPendingGoogleCode()) {
      signInWithExistingGoogleAccount().catch((err) => {
        console.error(err)
        writePendingGoogleCode(null)
        setError('Nie udało się zalogować przez Google.')
      })
      return
    }

    writePendingGoogleCode(null)
    setError('Logowanie przez Google nie powiodło się.')
  }, [])

  const checkCode = useCallback(async () => {
    setError(null)

    try {
      const event = await joinEvent(code)

      if (!event) {
        setError('Nieprawidłowy kod.')
        return
      }

      updateStored({ session: event, accessCode: code })
      await refreshProfile()
    } catch (err) {
      console.error(err)
      setError(
        getErrorCode(err) === RATE_LIMIT_ERROR_CODE
          ? (getErrorMessage(err) ?? 'Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.')
          : 'Wystąpił błąd.'
      )
    }
  }, [code, refreshProfile, updateStored])

  const saveNickname = useCallback(async () => {
    const value = nickname.trim()

    if (!value) {
      setError('Wpisz pseudonim.')
      return false
    }

    setError(null)

    try {
      await setDisplayName(value)
      await refreshProfile()
      return true
    } catch (err) {
      console.error(err)
      setError('Nie udało się zapisać pseudonimu.')
      return false
    }
  }, [nickname, refreshProfile])

  const loginWithGoogle = useCallback(async () => {
    setError(null)

    // Zapamiętaj kod wydarzenia na czas przekierowania do Google.
    writePendingGoogleCode(storedRef.current?.accessCode ?? code)

    try {
      await signInWithGoogle()
    } catch (err) {
      console.error(err)
      writePendingGoogleCode(null)
      setError('Nie udało się zalogować przez Google.')
    }
  }, [code])

  const logout = useCallback(() => {
    updateStored(null)
    setProfile(null)
    setCode('')
    setNickname('')
    setError(null)
    supabase.auth.signOut().catch((err) => console.error('Sign out error:', err))
  }, [updateStored])

  return {
    code,
    setCode,
    nickname,
    setNickname,
    session: stored?.session ?? null,
    initializing,
    userId: profile?.id ?? null,
    hasNickname: Boolean(profile?.displayName),
    error,
    setError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    logout,
  }
}

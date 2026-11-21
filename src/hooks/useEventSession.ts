import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  RATE_LIMIT_ERROR_CODE,
  checkEventCode,
  clearAuthRedirectParams,
  fetchMyEventRole,
  getErrorCode,
  getErrorMessage,
  joinEvent,
  readAuthRedirectErrorCode,
  signInWithGoogle,
} from '../lib/eventApi'
import { fetchMyProfile, setDisplayName } from '../lib/profileApi'
import { PENDING_EVENT_KEY, SESSION_STORAGE_KEY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import type { EventPreview, EventSession } from '../types/event'
import type { Profile } from '../types/profile'

// W localStorage trzymamy tylko wybrane wydarzenie i jego kod. Nazwa
// użytkownika i rola zawsze pochodzą z bazy (profiles / event_members).
type StoredSession = {
  session: EventSession
  accessCode: string
}

// Sprawdzony kod, który czeka na pseudonim albo powrót z Google.
type PendingEvent = {
  event: EventPreview
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

const isPendingEvent = (value: unknown): value is PendingEvent => {
  if (typeof value !== 'object' || value === null) return false
  const { event, accessCode } = value as Partial<PendingEvent>
  return (
    typeof accessCode === 'string' &&
    typeof event?.id === 'string' &&
    typeof event.name === 'string'
  )
}

const loadJson = <T>(
  storage: () => Storage,
  key: string,
  guard: (value: unknown) => value is T
): T | null => {
  try {
    const raw = storage().getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return guard(parsed) ? parsed : null
  } catch {
    return null
  }
}

const saveJson = (storage: () => Storage, key: string, value: unknown) => {
  try {
    if (value) {
      storage().setItem(key, JSON.stringify(value))
    } else {
      storage().removeItem(key)
    }
  } catch {
    // Storage niedostępny (np. prywatna karta) - stan nie zostanie zapamiętany
  }
}

const localStore = () => localStorage
const sessionStore = () => sessionStorage

const hasGoogleIdentity = (authSession: Session | null) =>
  authSession?.user.identities?.some((identity) => identity.provider === 'google') ?? false

const INVALID_CODE_MESSAGE = 'Nieprawidłowy kod.'

const getCodeErrorMessage = (err: unknown) =>
  getErrorCode(err) === RATE_LIMIT_ERROR_CODE
    ? (getErrorMessage(err) ?? 'Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.')
    : 'Wystąpił błąd.'

// Przepływ wejścia:
//   1. Kod - sesja anonimowa (bez profilu) i check_event_code. Błędny kod
//      od razu daje komunikat. Kto ma już profil, od razu dołącza.
//   2. Pseudonim -> join_event(kod, pseudonim) zakłada profil i członkostwo.
//      Google -> osobne konto (istniejące albo nowe), dołączenie po powrocie.
export function useEventSession() {
  const [stored, setStored] = useState<StoredSession | null>(() =>
    loadJson(localStore, SESSION_STORAGE_KEY, isStoredSession)
  )
  const [pending, setPending] = useState<PendingEvent | null>(() =>
    loadJson(sessionStore, PENDING_EVENT_KEY, isPendingEvent)
  )
  const [profile, setProfile] = useState<Profile | null>(null)
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // true do pierwszej synchronizacji z bazą - zapobiega mignięciu ekranu
  // pseudonimu, zanim przyjdzie profil
  const [initializing, setInitializing] = useState(true)

  const storedRef = useRef(stored)
  const pendingRef = useRef(pending)
  // Blokada podwójnego wysłania (stan React aktualizuje się z opóźnieniem).
  const submittingRef = useRef(false)
  // Trwa dołączanie z kodem sprzed logowania Google.
  const joiningPendingRef = useRef(false)

  const updateStored = useCallback((value: StoredSession | null) => {
    storedRef.current = value
    saveJson(localStore, SESSION_STORAGE_KEY, value)
    setStored(value)
  }, [])

  const updatePending = useCallback((value: PendingEvent | null) => {
    pendingRef.current = value
    saveJson(sessionStore, PENDING_EVENT_KEY, value)
    setPending(value)
  }, [])

  const runExclusive = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (submittingRef.current) {
      return undefined
    }

    submittingRef.current = true
    setSubmitting(true)

    try {
      return await action()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const value = await fetchMyProfile()
    setProfile(value)

    if (value?.displayName) {
      setNickname(value.displayName)
    }

    return value
  }, [])

  // Dołączenie do wydarzenia. Zwraca false przy błędnym kodzie (np. kod
  // zmieniony w międzyczasie) - gość wraca wtedy do ekranu kodu.
  const joinWithCode = useCallback(
    async (accessCode: string, displayName?: string) => {
      const event = await joinEvent(accessCode, displayName)

      if (!event) {
        updateStored(null)
        setError(INVALID_CODE_MESSAGE)
        return false
      }

      updateStored({ session: event, accessCode })
      return true
    },
    [updateStored]
  )

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
        // Powrót z logowania Google: dokończ dołączenie do wydarzenia
        // (konto Google zawsze ma profil, więc pseudonim nie jest potrzebny).
        const waiting = pendingRef.current

        if (waiting && hasGoogleIdentity(authSession)) {
          // Kod czyścimy dopiero po odpowiedzi - inaczej na czas żądania
          // mignąłby ekran kodu. Kolejne zdarzenie auth w tym czasie (np.
          // INITIAL_SESSION + SIGNED_IN) nie dołącza drugi raz.
          if (!joiningPendingRef.current) {
            joiningPendingRef.current = true

            try {
              await joinWithCode(waiting.accessCode)
            } finally {
              updatePending(null)
              joiningPendingRef.current = false
            }
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
        setError(
          getErrorCode(err) === RATE_LIMIT_ERROR_CODE
            ? getCodeErrorMessage(err)
            : 'Nie udało się wczytać danych użytkownika.'
        )
      } finally {
        setInitializing(false)
      }
    },
    [joinWithCode, refreshProfile, updatePending, updateStored]
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

  // Błąd lub anulowanie po powrocie z Google. Sprawdzony kod zostaje, więc
  // gość może spróbować ponownie albo podać pseudonim.
  useEffect(() => {
    if (!readAuthRedirectErrorCode()) {
      return
    }

    clearAuthRedirectParams()
    setError('Logowanie przez Google nie powiodło się.')
  }, [])

  const checkCode = useCallback(async () => {
    const accessCode = code.trim()

    if (!accessCode) {
      setError('Wpisz kod dostępu.')
      return
    }

    setError(null)

    await runExclusive(async () => {
      try {
        const event = await checkEventCode(accessCode)

        if (!event) {
          setError(INVALID_CODE_MESSAGE)
          return
        }

        // Ma już profil (wraca na tym urządzeniu, konto Google) - dołącza od razu.
        if (await refreshProfile()) {
          await joinWithCode(accessCode)
          return
        }

        updatePending({ event, accessCode })
      } catch (err) {
        console.error(err)
        setError(getCodeErrorMessage(err))
      }
    })
  }, [code, joinWithCode, refreshProfile, runExclusive, updatePending])

  const saveNickname = useCallback(async () => {
    const value = nickname.trim()

    if (!value) {
      setError('Wpisz pseudonim.')
      return false
    }

    setError(null)

    const result = await runExclusive(async () => {
      const waiting = pendingRef.current

      // Nowy gość: profil i członkostwo powstają razem w join_event.
      if (waiting && !storedRef.current) {
        let joined: boolean

        // Kod zostaje do odpowiedzi z bazy (bez mignięcia ekranu kodu),
        // a przy błędzie gość zostaje na ekranie pseudonimu.
        try {
          joined = await joinWithCode(waiting.accessCode, value)
        } catch (err) {
          console.error(err)
          setError(
            getErrorCode(err) === RATE_LIMIT_ERROR_CODE
              ? getCodeErrorMessage(err)
              : 'Nie udało się zapisać pseudonimu.'
          )
          return false
        }

        // Dołączono albo kod okazał się nieaktualny - w obu razach kod
        // przestaje czekać.
        updatePending(null)

        try {
          await refreshProfile()
        } catch (err) {
          console.error(err)
          setError('Nie udało się wczytać danych użytkownika.')
        }

        return joined
      }

      // Członek wydarzenia bez nazwy (np. konto Google bez imienia).
      try {
        await setDisplayName(value)
        await refreshProfile()
        return true
      } catch (err) {
        console.error(err)
        setError('Nie udało się zapisać pseudonimu.')
        return false
      }
    })

    return result ?? false
  }, [joinWithCode, nickname, refreshProfile, runExclusive, updatePending])

  const loginWithGoogle = useCallback(async () => {
    setError(null)

    await runExclusive(async () => {
      // Sprawdzony kod czeka w sessionStorage na powrót z Google.
      const current = storedRef.current

      if (current) {
        updatePending({ event: current.session, accessCode: current.accessCode })
      }

      try {
        await signInWithGoogle()
      } catch (err) {
        console.error(err)
        // Kod skopiowany z dołączonego wydarzenia nie może zostać, bo
        // późniejsze zdarzenie auth dołączyłoby z nim ponownie. Kod nowego
        // gościa zostaje - nadal jest na ekranie pseudonimu.
        if (current) {
          updatePending(null)
        }
        setError('Nie udało się zalogować przez Google.')
      }
    })
  }, [runExclusive, updatePending])

  // Powrót z ekranu pseudonimu do wpisania kodu.
  const cancelPendingEvent = useCallback(() => {
    updatePending(null)
    setError(null)
  }, [updatePending])

  const logout = useCallback(() => {
    updateStored(null)
    updatePending(null)
    setProfile(null)
    setCode('')
    setNickname('')
    setError(null)
    supabase.auth.signOut().catch((err) => console.error('Sign out error:', err))
  }, [updatePending, updateStored])

  return {
    code,
    setCode,
    nickname,
    setNickname,
    session: stored?.session ?? null,
    pendingEvent: pending?.event ?? null,
    initializing,
    submitting,
    userId: profile?.id ?? null,
    hasNickname: Boolean(profile?.displayName),
    error,
    setError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    cancelPendingEvent,
    logout,
  }
}

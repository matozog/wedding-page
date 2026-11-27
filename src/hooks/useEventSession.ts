import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { adminEventExists } from '../lib/eventsAdminApi'
import { ROUTES } from '../lib/routes'
import {
  IDENTITY_ALREADY_EXISTS_CODE,
  RATE_LIMIT_ERROR_CODE,
  checkEventCode,
  checkInvite,
  clearAuthRedirectParams,
  fetchMyEventRole,
  getErrorCode,
  getErrorMessage,
  joinEvent,
  joinEventByInvite,
  linkGoogleAccount,
  readAuthRedirectErrorCode,
  signInWithGoogle,
} from '../lib/eventApi'
import { clearInviteParamFromUrl, readInviteTokenFromUrl } from '../lib/inviteLink'
import { fetchMyProfile, setDisplayName } from '../lib/profileApi'
import { PENDING_EVENT_KEY, SESSION_STORAGE_KEY } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { writeCachedTheme } from '../lib/themeCache'
import type { EventPreview, EventSession } from '../types/event'
import type { Profile } from '../types/profile'

// Czym użytkownik dołącza do wydarzenia: kodem albo linkiem zaproszenia.
type JoinCredential = { accessCode: string } | { inviteToken: string }

// W localStorage trzymamy tylko wybrane wydarzenie i jego kod (albo token
// linku). Nazwa użytkownika i rola zawsze pochodzą z bazy (profiles /
// event_members).
type StoredSession = {
  session: EventSession
  // null - super admin wybrał wydarzenie z listy, bez kodu, albo wejście
  // z linku zaproszenia (wtedy inviteToken)
  accessCode: string | null
  inviteToken?: string
}

// Sprawdzony kod lub link, który czeka na pseudonim albo powrót z Google.
type PendingEvent = {
  event: EventPreview
  accessCode?: string
  inviteToken?: string
  // Kto udostępnił link (pokazywane na ekranie pseudonimu).
  inviterName?: string | null
}

const credentialOf = (value: {
  accessCode?: string | null
  inviteToken?: string
}): JoinCredential | null =>
  value.inviteToken
    ? { inviteToken: value.inviteToken }
    : value.accessCode
      ? { accessCode: value.accessCode }
      : null

const isStoredSession = (value: unknown): value is StoredSession => {
  if (typeof value !== 'object' || value === null) return false
  const { session, accessCode, inviteToken } = value as Partial<StoredSession>
  return (
    (typeof accessCode === 'string' || accessCode === null) &&
    (inviteToken === undefined || typeof inviteToken === 'string') &&
    typeof session?.id === 'string' &&
    typeof session.name === 'string' &&
    typeof session.role === 'string'
  )
}

const isPendingEvent = (value: unknown): value is PendingEvent => {
  if (typeof value !== 'object' || value === null) return false
  const { event, accessCode, inviteToken, inviterName } = value as Partial<PendingEvent>
  return (
    (typeof accessCode === 'string' || typeof inviteToken === 'string') &&
    (inviterName === undefined || inviterName === null || typeof inviterName === 'string') &&
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
const INVALID_INVITE_MESSAGE =
  'Link zaproszenia jest nieaktualny. Poproś o nowy link albo wpisz kod dostępu.'

const getCodeErrorMessage = (err: unknown) =>
  getErrorCode(err) === RATE_LIMIT_ERROR_CODE
    ? (getErrorMessage(err) ?? 'Zbyt wiele nieudanych prób. Spróbuj ponownie za kilka minut.')
    : 'Wystąpił błąd.'

// Przepływ wejścia:
//   1. Kod - sesja anonimowa (bez profilu) i check_event_code. Błędny kod
//      od razu daje komunikat. Kto ma już profil, od razu dołącza.
//   2. Pseudonim -> join_event(kod, pseudonim) zakłada profil i członkostwo.
//      Google -> osobne konto (istniejące albo nowe), dołączenie po powrocie.
// Link zaproszenia (?zaproszenie=<token>) zastępuje krok 1 - check_invite
// i join_event_by_invite działają jak wersje z kodem.
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
  // Token z adresu, odczytany raz przy starcie aplikacji.
  const [inviteToken] = useState(readInviteTokenFromUrl)
  // true do sprawdzenia linku zaproszenia - bez mignięcia ekranu kodu.
  const [resolvingInvite, setResolvingInvite] = useState(inviteToken !== null)

  const storedRef = useRef(stored)
  const pendingRef = useRef(pending)
  // Blokada podwójnego wysłania (stan React aktualizuje się z opóźnieniem).
  const submittingRef = useRef(false)
  // Trwa dołączanie z kodem sprzed logowania Google.
  const joiningPendingRef = useRef(false)
  const inviteHandledRef = useRef(false)

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

  // Dołączenie do wydarzenia. Zwraca false przy błędnym kodzie lub linku
  // (np. kod zmieniony w międzyczasie) - gość wraca wtedy do ekranu kodu.
  const joinWith = useCallback(
    async (credential: JoinCredential, displayName?: string) => {
      const fromInvite = 'inviteToken' in credential
      const event = fromInvite
        ? await joinEventByInvite(credential.inviteToken, displayName)
        : await joinEvent(credential.accessCode, displayName)

      if (!event) {
        updateStored(null)
        setError(fromInvite ? INVALID_INVITE_MESSAGE : INVALID_CODE_MESSAGE)
        return false
      }

      if (event.theme) writeCachedTheme(event.id, event.theme)
      updateStored(
        fromInvite
          ? { session: event, accessCode: null, inviteToken: credential.inviteToken }
          : { session: event, accessCode: credential.accessCode }
      )
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
        let profileLoaded = false

        // Powrót z logowania Google: dokończ dołączenie do wydarzenia
        // (konto Google zawsze ma profil, więc pseudonim nie jest potrzebny).
        const waiting = pendingRef.current

        const waitingCredential = waiting ? credentialOf(waiting) : null

        if (waitingCredential && hasGoogleIdentity(authSession)) {
          // Kod czyścimy dopiero po odpowiedzi - inaczej na czas żądania
          // mignąłby ekran kodu. Kolejne zdarzenie auth w tym czasie (np.
          // INITIAL_SESSION + SIGNED_IN) nie dołącza drugi raz.
          if (!joiningPendingRef.current) {
            joiningPendingRef.current = true

            try {
              await joinWith(waitingCredential)
            } finally {
              updatePending(null)
              joiningPendingRef.current = false
            }
          }
        } else if (storedRef.current) {
          const current = storedRef.current
          const currentProfile = await refreshProfile()
          profileLoaded = true
          // W czasie zapytań wybrane wydarzenie mogło się zmienić (np. wejście
          // z linku zaproszenia do innego wydarzenia) - wynik sprawdzenia
          // dotyczy wtedy starej sesji i nie może jej nadpisać.
          const stillCurrent = () => storedRef.current === current

          if (currentProfile?.isSuperAdmin) {
            // Super admin ma dostęp bez członkostwa - wystarczy, że
            // wydarzenie nadal istnieje.
            if (!(await adminEventExists(current.session.id)) && stillCurrent()) {
              updateStored(null)
              setError('Wybrane wydarzenie już nie istnieje.')
            }
          } else {
            // Rola mogła się zmienić (np. awans na EDITOR) albo użytkownik
            // mógł zostać usunięty z wydarzenia.
            const role = await fetchMyEventRole(current.session.id)

            if (!stillCurrent()) {
              // Nowa sesja jest już sprawdzona przez bazę przy dołączaniu.
            } else if (role) {
              if (role !== current.session.role) {
                updateStored({ ...current, session: { ...current.session, role } })
              }
            } else {
              updateStored(null)
              setError('Nie masz już dostępu do tego wydarzenia. Wpisz kod ponownie.')
            }
          }
        }

        if (!profileLoaded) {
          await refreshProfile()
        }
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
    [joinWith, refreshProfile, updatePending, updateStored]
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
    const code = readAuthRedirectErrorCode()

    if (!code) {
      return
    }

    clearAuthRedirectParams()
    setError(
      code === IDENTITY_ALREADY_EXISTS_CODE
        ? 'To konto Google jest już używane w aplikacji, więc nie można go połączyć z pseudonimem. Aby z niego korzystać, wybierz „Przełącz konto” → „Zaloguj się kontem Google”.'
        : 'Logowanie przez Google nie powiodło się.'
    )
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

        // Ekran pseudonimu ma już motyw wydarzenia.
        if (event.theme) writeCachedTheme(event.id, event.theme)

        // Ma już profil (wraca na tym urządzeniu, konto Google) - dołącza od razu.
        if (await refreshProfile()) {
          await joinWith({ accessCode })
          return
        }

        updatePending({ event, accessCode })
      } catch (err) {
        console.error(err)
        setError(getCodeErrorMessage(err))
      }
    })
  }, [code, joinWith, refreshProfile, runExclusive, updatePending])

  // Wejście z linku zaproszenia: token znika z adresu, a link jest
  // sprawdzany w bazie. Kto ma profil, od razu dołącza (także gdy był
  // w innym wydarzeniu - przechodzi do tego z linku). Nowy gość trafia na
  // ekran pseudonimu z informacją, kto go zaprosił.
  useEffect(() => {
    if (!inviteToken || inviteHandledRef.current) {
      return
    }

    inviteHandledRef.current = true
    clearInviteParamFromUrl()

    void (async () => {
      try {
        const invite = await checkInvite(inviteToken)

        if (!invite) {
          setError(INVALID_INVITE_MESSAGE)
          return
        }

        // Ekran pseudonimu ma już motyw wydarzenia.
        if (invite.theme) writeCachedTheme(invite.id, invite.theme)

        // Kto ma profil, dołącza od razu. Także gdy zapisana sesja wskazuje
        // to samo wydarzenie: mógł zostać z niego usunięty, a dla obecnego
        // członka join_event_by_invite niczego nie zmienia.
        if (await refreshProfile()) {
          // Równoległe sprawdzenie starej sesji mogło zdążyć pokazać
          // "Nie masz już dostępu" - po dołączeniu z linku jest nieaktualne.
          if (await joinWith({ inviteToken })) {
            setError(null)
          }
          return
        }

        updateStored(null)
        updatePending({
          event: { id: invite.id, name: invite.name, startsAt: invite.startsAt, theme: invite.theme },
          inviteToken,
          inviterName: invite.inviterName,
        })
      } catch (err) {
        console.error(err)
        setError(getCodeErrorMessage(err))
      } finally {
        setResolvingInvite(false)
      }
    })()
  }, [inviteToken, joinWith, refreshProfile, updatePending, updateStored])

  const saveNickname = useCallback(async () => {
    const value = nickname.trim()

    if (!value) {
      setError('Wpisz pseudonim.')
      return false
    }

    setError(null)

    const result = await runExclusive(async () => {
      const waiting = pendingRef.current
      const waitingCredential = waiting ? credentialOf(waiting) : null

      // Nowy gość: profil i członkostwo powstają razem w join_event.
      if (waitingCredential && !storedRef.current) {
        let joined: boolean

        // Kod zostaje do odpowiedzi z bazy (bez mignięcia ekranu kodu),
        // a przy błędzie gość zostaje na ekranie pseudonimu.
        try {
          joined = await joinWith(waitingCredential, value)
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
  }, [joinWith, nickname, refreshProfile, runExclusive, updatePending])

  // selectAccount - Google pokazuje wybór konta (przełączenie z pseudonimu
  // na inne konto Google).
  const startGoogleSignIn = useCallback(async (selectAccount: boolean) => {
    setError(null)

    await runExclusive(async () => {
      // Sprawdzony kod (albo link) czeka w sessionStorage na powrót z Google.
      // Nowy gość ma go już w pending, członek bez nazwy - w stored.
      const stored = storedRef.current
      const current = stored && credentialOf(stored) ? stored : null

      if (current) {
        updatePending({
          event: current.session,
          accessCode: current.accessCode ?? undefined,
          inviteToken: current.inviteToken,
        })
      }

      try {
        await signInWithGoogle({ selectAccount })
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

  const loginWithGoogle = useCallback(() => startGoogleSignIn(false), [startGoogleSignIn])

  // Gość z pseudonimem przechodzi na konto Google (osobne konto). Po powrocie
  // dołącza do tego samego wydarzenia tym samym kodem lub linkiem; wpisy
  // z pseudonimu zostają przy koncie anonimowym.
  const switchToGoogle = useCallback(() => startGoogleSignIn(true), [startGoogleSignIn])

  // Powrót z ekranu pseudonimu do wpisania kodu.
  const cancelPendingEvent = useCallback(() => {
    updatePending(null)
    setError(null)
  }, [updatePending])

  // Panel organizatora (/events) - logowanie Google z powrotem na ten adres.
  // Wybrane wcześniej wydarzenie (np. sesja anonimowego gościa) przestaje
  // obowiązywać, bo po zmianie konta i tak trzeba by je wybrać ponownie.
  const loginAsOrganizer = useCallback(async () => {
    setError(null)

    await runExclusive(async () => {
      updateStored(null)
      updatePending(null)

      try {
        await signInWithGoogle({ returnPath: ROUTES.events, selectAccount: true })
      } catch (err) {
        console.error(err)
        setError('Nie udało się zalogować przez Google.')
      }
    })
  }, [runExclusive, updatePending, updateStored])

  // Konto Google bez uprawnień organizatora - wylogowanie i wybór innego konta.
  const switchOrganizerAccount = useCallback(async () => {
    setError(null)

    await runExclusive(async () => {
      updateStored(null)
      updatePending(null)
      setProfile(null)

      try {
        await supabase.auth.signOut()
        await signInWithGoogle({ returnPath: ROUTES.events, selectAccount: true })
      } catch (err) {
        console.error(err)
        setError('Nie udało się zmienić konta.')
      }
    })
  }, [runExclusive, updatePending, updateStored])

  // Super admin wchodzi do wydarzenia z listy, bez kodu (dostęp daje mu baza).
  const enterEvent = useCallback(
    (event: EventPreview) => {
      setError(null)
      updatePending(null)
      updateStored({ session: { ...event, role: 'ADMIN' }, accessCode: null })
    },
    [updatePending, updateStored]
  )

  // Zmiany wydarzeń w panelu super admina - wybrane wydarzenie nadąża za nimi.
  const syncEventChange = useCallback(
    (eventId: string, event: EventPreview | null) => {
      const current = storedRef.current

      if (current?.session.id !== eventId) {
        return
      }

      updateStored(event ? { ...current, session: { ...current.session, ...event } } : null)
    },
    [updateStored]
  )

  // Zmiana nazwy tego samego konta (bez zakładania nowego profilu).
  // Rzuca błąd z komunikatem dla użytkownika.
  const changeNickname = useCallback(
    async (value: string) => {
      const name = value.trim()

      if (!name) {
        throw new Error('Wpisz pseudonim.')
      }

      await setDisplayName(name)
      await refreshProfile()
    },
    [refreshProfile]
  )

  // Konto anonimowe łączy się z Google (przekierowanie). Po powrocie zdarzenie
  // auth odświeża profil - to samo konto, już nie anonimowe, z nazwą z Google.
  const linkGoogle = useCallback(async () => {
    setError(null)

    await runExclusive(async () => {
      try {
        await linkGoogleAccount()
      } catch (err) {
        console.error(err)
        setError('Nie udało się połączyć z kontem Google.')
      }
    })
  }, [runExclusive])

  // Wyjście z wydarzenia bez wylogowania - konto (i pseudonim) zostaje na
  // tym urządzeniu, ponowne wpisanie kodu od razu otwiera wydarzenie.
  const leaveEvent = useCallback(() => {
    updateStored(null)
    updatePending(null)
    setCode('')
    setError(null)
  }, [updatePending, updateStored])

  // Pełne wylogowanie. Konto anonimowe przepada na tym urządzeniu.
  const logout = useCallback(() => {
    updateStored(null)
    updatePending(null)
    setProfile(null)
    setCode('')
    setNickname('')
    setError(null)
    supabase.auth.signOut().catch((err) => console.error('Sign out error:', err))
  }, [updatePending, updateStored])

  const isSuperAdmin = profile?.isSuperAdmin ?? false
  const storedSession = stored?.session ?? null

  // Super admin jest w każdym wydarzeniu traktowany jak ADMIN - tak samo
  // traktuje go baza (has_event_role), nawet bez członkostwa.
  const session = useMemo(
    () => (storedSession && isSuperAdmin ? { ...storedSession, role: 'ADMIN' as const } : storedSession),
    [isSuperAdmin, storedSession]
  )

  return {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    pendingEvent: pending?.event ?? null,
    // Kto zaprosił - gdy czekające wydarzenie pochodzi z linku zaproszenia.
    pendingInviterName: pending?.inviteToken ? (pending.inviterName ?? null) : null,
    pendingFromInvite: Boolean(pending?.inviteToken),
    initializing,
    resolvingInvite,
    submitting,
    userId: profile?.id ?? null,
    hasNickname: Boolean(profile?.displayName),
    isSuperAdmin,
    isAnonymous: profile?.isAnonymous ?? false,
    // Zalogowane konto Google (nie anonimowe) - panel organizatora.
    hasGoogleAccount: profile !== null && !profile.isAnonymous,
    accountLabel: profile?.displayName ?? profile?.email ?? '',
    error,
    setError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    loginAsOrganizer,
    switchOrganizerAccount,
    enterEvent,
    syncEventChange,
    cancelPendingEvent,
    changeNickname,
    linkGoogle,
    switchToGoogle,
    leaveEvent,
    logout,
  }
}

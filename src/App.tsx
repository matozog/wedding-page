import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router'
import { CalendarCog, Settings } from 'lucide-react'
import type { SectionNavLink } from '@/components/layout/SectionNav'
import { CodeEntryScreen } from '@/components/screens/CodeEntryScreen'
import { EventConfigScreen } from '@/components/screens/EventConfigScreen'
import { EventGalleryScreen } from '@/components/screens/EventGalleryScreen'
import { EventsManagementScreen } from '@/components/screens/EventsManagementScreen'
import { ExpensesManagementScreen } from '@/components/screens/ExpensesManagementScreen'
import { GuestsManagementScreen } from '@/components/screens/GuestsManagementScreen'
import { ManagementScreen } from '@/components/screens/ManagementScreen'
import { NicknameScreen } from '@/components/screens/NicknameScreen'
import type { OrganizerAccess } from '@/components/screens/OrganizerGate'
import { useEventPage } from '@/hooks/useEventPage'
import { useEventSession } from '@/hooks/useEventSession'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { usePhotos } from '@/hooks/usePhotos'
import { deletePhoto } from '@/lib/photosApi'
import { ROUTES } from '@/lib/routes'
import { readCachedTheme, writeCachedTheme } from '@/lib/themeCache'
import type { ThemeKey } from '@/config/themes'
import { canEditGuests, canManageAllPhotos, canManageEvent, canViewManagement } from '@/types/role'
import type { EventPreview } from '@/types/event'
import type { Photo } from '@/types/photo'

// Edytor planu sali (Konva) w osobnym pliku.
const SeatingManagementScreen = lazy(() =>
  import('@/components/screens/SeatingManagementScreen').then((module) => ({
    default: module.SeatingManagementScreen,
  }))
)

const MANAGEMENT_NAV_LINK: SectionNavLink = { to: ROUTES.management, label: 'Zarządzanie', icon: Settings }
// Tylko super admin - panel wszystkich wydarzeń.
const EVENTS_NAV_LINK: SectionNavLink = { to: ROUTES.events, label: 'Wydarzenia', icon: CalendarCog }

function App() {
  const {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    pendingEvent,
    initializing,
    submitting,
    userId,
    hasNickname,
    isSuperAdmin,
    hasGoogleAccount,
    accountLabel,
    error: sessionError,
    setError: setSessionError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    loginAsOrganizer,
    switchOrganizerAccount,
    enterEvent,
    syncEventChange,
    cancelPendingEvent,
    logout,
  } = useEventSession()

  const navigate = useNavigate()
  const isEventsRoute = useMatch(ROUTES.events) !== null
  const configMatch = useMatch(ROUTES.eventConfig)
  const isOrganizerRoute = isEventsRoute || configMatch !== null

  const eventId = session?.id ?? null
  const role = session?.role ?? null

  // Konfiguracja strony wybranego wydarzenia (sekcje, treści, motyw).
  const { page, setPage, error: pageError, notFound: pageNotFound, reload: reloadPage } = useEventPage(eventId)

  // Po powrocie z panelu organizatora (tam konfigurację można zmienić)
  // wczytujemy ją ponownie.
  const wasOrganizerRouteRef = useRef(isOrganizerRoute)
  useEffect(() => {
    if (wasOrganizerRouteRef.current && !isOrganizerRoute) {
      void reloadPage()
    }
    wasOrganizerRouteRef.current = isOrganizerRoute
  }, [isOrganizerRoute, reloadPage])

  // Motyw wybranego wydarzenia na wszystkich stronach (także w zarządzaniu
  // i w panelu organizatora). Do czasu wczytania konfiguracji - ostatni
  // zapamiętany motyw tego wydarzenia (bez mignięcia kolorów domyślnych).
  // Ekrany wejścia (bez wybranego wydarzenia) - motyw domyślny.
  const sessionId = session?.id ?? null
  const pageTheme = sessionId && page?.event.id === sessionId ? page.event.theme : null
  const cachedTheme = useMemo(() => (sessionId ? readCachedTheme(sessionId) : null), [sessionId])
  const theme = pageTheme ?? cachedTheme

  useEffect(() => {
    if (sessionId && pageTheme) writeCachedTheme(sessionId, pageTheme)
  }, [sessionId, pageTheme])

  // useLayoutEffect - motyw jest ustawiony przed narysowaniem strony.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (theme) {
      root.dataset.theme = theme
    } else {
      delete root.dataset.theme
    }
  }, [theme])

  // Tytuł karty przeglądarki - nazwa wybranego wydarzenia.
  const sessionName = session?.name ?? null
  useEffect(() => {
    document.title = sessionName ?? 'Strona wydarzenia'
  }, [sessionName])

  // Zmiana motywu na stronie konfiguracji - od razu widoczna, gdy dotyczy
  // wybranego wydarzenia.
  const handleThemeSaved = useCallback(
    (savedEventId: string, savedTheme: ThemeKey) => {
      writeCachedTheme(savedEventId, savedTheme)
      setPage((current) =>
        current && current.event.id === savedEventId
          ? { ...current, event: { ...current.event, theme: savedTheme } }
          : current
      )
    },
    [setPage]
  )

  const {
    photos,
    loading: loadingPhotos,
    error: photosError,
    loadPhotos,
    getPhotoUrl,
  } = usePhotos(eventId)

  useEffect(() => {
    if (eventId) {
      loadPhotos()
    }
  }, [eventId, loadPhotos])

  const handleUploadError = useCallback(
    (message: string) => {
      setSessionError(message)
    },
    [setSessionError]
  )

  const { uploading, progress: uploadProgress, uploadPhotos } = usePhotoUpload({
    eventId,
    userId,
    onComplete: loadPhotos,
    onError: handleUploadError,
  })

  const handleSaveNickname = async () => {
    const saved = await saveNickname()

    if (saved) {
      await loadPhotos()
    }
  }

  const handleDeletePhoto = useCallback(
    async (photo: Photo) => {
      try {
        await deletePhoto(photo)
        await loadPhotos()
      } catch (err) {
        console.error(err)
        setSessionError('Nie udało się usunąć zdjęcia.')
      }
    },
    [loadPhotos, setSessionError]
  )

  // Autor usuwa własne zdjęcia, EDITOR i ADMIN wszystkie w wydarzeniu.
  const canDeletePhoto = useCallback(
    (photo: Photo) => canManageAllPhotos(role) || (userId !== null && photo.uploaded_by === userId),
    [role, userId]
  )

  const error = sessionError ?? photosError
  const canManage = canManageEvent(role)
  const canEditGuestList = canEditGuests(role)
  const canOpenManagement = canViewManagement(role)
  const navLinks = useMemo(() => {
    const links = [
      ...(canOpenManagement ? [MANAGEMENT_NAV_LINK] : []),
      ...(isSuperAdmin ? [EVENTS_NAV_LINK] : []),
    ]
    return links.length > 0 ? links : undefined
  }, [canOpenManagement, isSuperAdmin])

  const handleEnterEvent = useCallback(
    (event: EventPreview) => {
      enterEvent(event)
      navigate(ROUTES.management)
    },
    [enterEvent, navigate]
  )

  const handleOpenEventPage = useCallback(
    (event: EventPreview) => {
      enterEvent(event)
      navigate(ROUTES.home)
    },
    [enterEvent, navigate]
  )

  const organizerAccess: OrganizerAccess = {
    initializing,
    submitting,
    hasGoogleAccount,
    isSuperAdmin,
    accountLabel,
    error: sessionError,
    onLogin: loginAsOrganizer,
    onSwitchAccount: switchOrganizerAccount,
    onLogout: logout,
  }

  // Panel organizatora działa bez wybranego wydarzenia i bez pseudonimu -
  // obsługujemy go przed ekranami kodu i pseudonimu.
  if (isEventsRoute) {
    return (
      <EventsManagementScreen
        access={organizerAccess}
        currentEventId={eventId}
        onEnter={handleEnterEvent}
        onEventChanged={syncEventChange}
      />
    )
  }

  if (configMatch?.params.eventId) {
    return (
      <EventConfigScreen
        key={configMatch.params.eventId}
        eventId={configMatch.params.eventId}
        access={organizerAccess}
        currentEventId={eventId}
        onOpenPage={handleOpenEventPage}
        onEventChanged={syncEventChange}
        onThemeSaved={handleThemeSaved}
      />
    )
  }

  // Zapisane wydarzenie czeka na profil z bazy, a kod sprzed logowania Google
  // na dołączenie - bez tego mignąłby ekran pseudonimu.
  if (initializing && (session || pendingEvent)) {
    return null
  }

  // Ekrany kodu i pseudonimu nie zmieniają adresu, więc po wejściu do
  // wydarzenia użytkownik trafia na stronę, którą otworzył (np. /management).
  if (hasNickname && session) {
    return (
      <Routes>
        <Route
          path={ROUTES.home}
          element={
            <EventGalleryScreen
              eventName={session.name}
              nickname={nickname}
              page={page?.event.id === session.id ? page : null}
              pageError={pageError}
              pageNotFound={pageNotFound}
              onRetryPage={reloadPage}
              onLeaveEvent={() => syncEventChange(session.id, null)}
              photos={photos}
              loadingPhotos={loadingPhotos}
              uploading={uploading}
              uploadProgress={uploadProgress}
              error={error}
              navLinks={navLinks}
              canDeletePhoto={canDeletePhoto}
              getPhotoUrl={getPhotoUrl}
              onUpload={uploadPhotos}
              onDeletePhoto={handleDeletePhoto}
              onLogout={logout}
            />
          }
        />
        <Route
          path={ROUTES.management}
          element={
            <ManagementScreen
              eventId={session.id}
              eventName={session.name}
              nickname={nickname}
              canView={canOpenManagement}
              canManage={canManage}
              error={sessionError}
              onLogout={logout}
            />
          }
        />
        <Route
          path={ROUTES.managementExpenses}
          element={
            <ExpensesManagementScreen
              eventId={session.id}
              eventName={session.name}
              nickname={nickname}
              canView={canManage}
              error={sessionError}
              onLogout={logout}
            />
          }
        />
        <Route
          path={ROUTES.managementGuests}
          element={
            <GuestsManagementScreen
              eventId={session.id}
              eventName={session.name}
              nickname={nickname}
              canView={canOpenManagement}
              canEdit={canEditGuestList}
              canDelete={canManage}
              error={sessionError}
              onLogout={logout}
            />
          }
        />
        <Route
          path={ROUTES.managementSeating}
          element={
            <Suspense fallback={null}>
              <SeatingManagementScreen
                eventId={session.id}
                eventName={session.name}
                nickname={nickname}
                canView={canEditGuestList}
                error={sessionError}
                onLogout={logout}
              />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    )
  }

  const nicknameEvent = session ?? pendingEvent

  if (nicknameEvent) {
    return (
      <NicknameScreen
        eventName={nicknameEvent.name}
        nickname={nickname}
        error={sessionError}
        submitting={submitting}
        onNicknameChange={setNickname}
        onSubmit={handleSaveNickname}
        onGoogleLogin={loginWithGoogle}
        onChangeCode={session ? undefined : cancelPendingEvent}
      />
    )
  }

  return (
    <CodeEntryScreen
      title="Witaj"
      code={code}
      error={sessionError}
      submitting={submitting}
      onCodeChange={setCode}
      onSubmit={checkCode}
    />
  )
}

export default App

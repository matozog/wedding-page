import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router'
import { CalendarCog, Settings } from 'lucide-react'
import { AccountContext, type AccountContextValue } from '@/components/account/accountContext'
import { ChangeNicknameDialog } from '@/components/account/ChangeNicknameDialog'
import { LeaveEventDialog } from '@/components/account/LeaveEventDialog'
import type { SectionNavLink } from '@/components/layout/SectionNav'
import { CodeEntryScreen } from '@/components/screens/CodeEntryScreen'
import { EventConfigScreen } from '@/components/screens/EventConfigScreen'
import { EventGalleryScreen } from '@/components/screens/EventGalleryScreen'
import { EventsManagementScreen } from '@/components/screens/EventsManagementScreen'
import { ExpensesManagementScreen } from '@/components/screens/ExpensesManagementScreen'
import { GuestsManagementScreen } from '@/components/screens/GuestsManagementScreen'
import { ManagementScreen } from '@/components/screens/ManagementScreen'
import { NicknameScreen } from '@/components/screens/NicknameScreen'
import { ShoppingManagementScreen } from '@/components/screens/ShoppingManagementScreen'
import type { OrganizerAccess } from '@/components/screens/OrganizerGate'
import { useDocumentTheme } from '@/hooks/useDocumentTheme'
import { useEventPage } from '@/hooks/useEventPage'
import { useEventSession } from '@/hooks/useEventSession'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { usePhotos } from '@/hooks/usePhotos'
import { useStartTheme } from '@/hooks/useStartTheme'
import { getErrorCode } from '@/lib/eventApi'
import { fetchMyInviteUrl } from '@/lib/inviteLink'
import { deletePhoto } from '@/lib/photosApi'
import { ROUTES } from '@/lib/routes'
import { readCachedTheme, writeCachedTheme } from '@/lib/themeCache'
import { themeSignature, type AppTheme } from '@/config/themes'
import { canEditGuests, canManageAllPhotos, canManageEvent, canShareEvent, canViewManagement } from '@/types/role'
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

const describeShareError = (err: unknown) =>
  getErrorCode(err) === 'PT403'
    ? 'Organizator wyłączył udostępnianie wydarzenia przez gości.'
    : 'Nie udało się przygotować linku.'

function App() {
  const {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    pendingEvent,
    pendingInviterName,
    pendingFromInvite,
    initializing,
    resolvingInvite,
    submitting,
    userId,
    hasNickname,
    isSuperAdmin,
    isAnonymous,
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
    changeNickname,
    linkGoogle,
    leaveEvent,
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
  // i w panelu organizatora), a po sprawdzeniu kodu już na ekranie pseudonimu.
  // Kolejność: konfiguracja strony z bazy, ostatni zapamiętany motyw (zapisany
  // też przy sprawdzeniu kodu), motyw z check_event_code / join_event.
  // Bez wybranego wydarzenia - motyw ekranu startowego.
  const { theme: startTheme, updateTheme: updateStartTheme } = useStartTheme()
  const sessionId = session?.id ?? null
  const themeEvent = session ?? pendingEvent
  const themeEventId = themeEvent?.id ?? null
  const pageEvent = sessionId && page?.event.id === sessionId ? page.event : null
  const pageTheme: AppTheme | null = pageEvent ? { key: pageEvent.theme, colors: pageEvent.theme_colors } : null
  const pageThemeSignature = themeSignature(pageTheme)
  const cachedTheme = useMemo(() => (themeEventId ? readCachedTheme(themeEventId) : null), [themeEventId])
  const theme = themeEventId ? (pageTheme ?? cachedTheme ?? themeEvent?.theme ?? startTheme) : startTheme

  useEffect(() => {
    if (sessionId && pageTheme) writeCachedTheme(sessionId, pageTheme)
    // pageThemeSignature opisuje pageTheme w całości
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pageThemeSignature])

  useDocumentTheme(theme)

  // Tytuł karty przeglądarki - nazwa wybranego wydarzenia.
  const sessionName = session?.name ?? null
  useEffect(() => {
    document.title = sessionName ?? 'Strona wydarzenia'
  }, [sessionName])

  // Zmiana motywu na stronie konfiguracji - od razu widoczna, gdy dotyczy
  // wybranego wydarzenia.
  const handleThemeSaved = useCallback(
    (savedEventId: string, savedTheme: AppTheme) => {
      writeCachedTheme(savedEventId, savedTheme)
      setPage((current) =>
        current && current.event.id === savedEventId
          ? { ...current, event: { ...current.event, theme: savedTheme.key, theme_colors: savedTheme.colors } }
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

  // Super admin jest traktowany jak ADMIN (rola w sesji), więc też może.
  // Do wczytania konfiguracji strony gość nie widzi opcji udostępniania.
  const currentPage = page?.event.id === eventId ? page : null
  const canShare = canShareEvent(role, currentPage?.event.guest_sharing_enabled ?? false)
  const getShareLink = useCallback(async () => {
    if (!eventId) throw new Error('Brak wybranego wydarzenia.')
    return fetchMyInviteUrl(eventId)
  }, [eventId])

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

  // Gość z kontem anonimowym wychodzi bez wylogowania (konto zostaje na
  // urządzeniu); konto Google wylogowuje się jak dotąd.
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [nicknameOpen, setNicknameOpen] = useState(false)
  // Zwiększany po zmianie pseudonimu - lista zakupów pobiera nowe nazwy.
  const [nicknameVersion, setNicknameVersion] = useState(0)

  const requestLeave = useCallback(() => {
    if (isAnonymous) {
      setLeaveOpen(true)
    } else {
      logout()
    }
  }, [isAnonymous, logout])

  const handleChangeNickname = useCallback(
    async (value: string) => {
      await changeNickname(value)
      setNicknameVersion((current) => current + 1)
      // Nazwy autorów przy zdjęciach.
      await loadPhotos()
    },
    [changeNickname, loadPhotos]
  )

  const account = useMemo<AccountContextValue | null>(
    () =>
      hasNickname
        ? { isAnonymous, onChangeNickname: () => setNicknameOpen(true), onLinkGoogle: () => void linkGoogle() }
        : null,
    [hasNickname, isAnonymous, linkGoogle]
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

  const renderScreen = () => {
    // Panel organizatora działa bez wybranego wydarzenia i bez pseudonimu -
    // obsługujemy go przed ekranami kodu i pseudonimu.
    if (isEventsRoute) {
      return (
        <EventsManagementScreen
          access={organizerAccess}
          currentEventId={eventId}
          startTheme={startTheme}
          onEnter={handleEnterEvent}
          onEventChanged={syncEventChange}
          onStartThemeSaved={updateStartTheme}
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
    // na dołączenie - bez tego mignąłby ekran pseudonimu. Link zaproszenia
    // jest jeszcze sprawdzany - bez mignięcia ekranu kodu.
    if (resolvingInvite || (initializing && (session || pendingEvent))) {
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
                userId={userId}
                isOrganizer={canEditGuestList}
                listRefreshKey={nicknameVersion}
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
                getShareLink={canShare ? getShareLink : undefined}
                describeShareError={describeShareError}
                canDeletePhoto={canDeletePhoto}
                getPhotoUrl={getPhotoUrl}
                onUpload={uploadPhotos}
                onDeletePhoto={handleDeletePhoto}
                onLogout={requestLeave}
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
                onLogout={requestLeave}
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
                onLogout={requestLeave}
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
                onLogout={requestLeave}
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
                  onLogout={requestLeave}
                />
              </Suspense>
            }
          />
          <Route
            path={ROUTES.managementShopping}
            element={
              <ShoppingManagementScreen
                eventId={session.id}
                eventName={session.name}
                nickname={nickname}
                userId={userId}
                canView={canEditGuestList}
                error={sessionError}
                onLogout={requestLeave}
              />
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
          fromInvite={!session && pendingFromInvite}
          inviterName={pendingInviterName}
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

  return (
    <AccountContext.Provider value={account}>
      {renderScreen()}
      <ChangeNicknameDialog
        open={nicknameOpen}
        nickname={nickname}
        onOpenChange={setNicknameOpen}
        onSave={handleChangeNickname}
      />
      <LeaveEventDialog open={leaveOpen} onOpenChange={setLeaveOpen} onLeave={leaveEvent} onSignOut={logout} />
    </AccountContext.Provider>
  )
}

export default App

import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router'
import { CalendarCog, Settings } from 'lucide-react'
import type { SectionNavLink } from '@/components/layout/SectionNav'
import { CodeEntryScreen } from '@/components/screens/CodeEntryScreen'
import { EventGalleryScreen } from '@/components/screens/EventGalleryScreen'
import { EventsManagementScreen } from '@/components/screens/EventsManagementScreen'
import { ExpensesManagementScreen } from '@/components/screens/ExpensesManagementScreen'
import { GuestsManagementScreen } from '@/components/screens/GuestsManagementScreen'
import { ManagementScreen } from '@/components/screens/ManagementScreen'
import { NicknameScreen } from '@/components/screens/NicknameScreen'
import { weddingContent } from '@/config/weddingContent'
import { useEventSession } from '@/hooks/useEventSession'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { usePhotos } from '@/hooks/usePhotos'
import { deletePhoto } from '@/lib/photosApi'
import { ROUTES } from '@/lib/routes'
import { canManageAllPhotos, canManageEvent, canViewManagement } from '@/types/role'
import type { EventPreview } from '@/types/event'
import type { Photo } from '@/types/photo'

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

  const eventId = session?.id ?? null
  const role = session?.role ?? null

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

  // Panel organizatora działa bez wybranego wydarzenia i bez pseudonimu -
  // obsługujemy go przed ekranami kodu i pseudonimu.
  if (isEventsRoute) {
    return (
      <EventsManagementScreen
        initializing={initializing}
        submitting={submitting}
        hasGoogleAccount={hasGoogleAccount}
        isSuperAdmin={isSuperAdmin}
        accountLabel={accountLabel}
        currentEventId={eventId}
        error={sessionError}
        onLogin={loginAsOrganizer}
        onSwitchAccount={switchOrganizerAccount}
        onEnter={handleEnterEvent}
        onEventChanged={syncEventChange}
        onLogout={logout}
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
              canEdit={canManage}
              error={sessionError}
              onLogout={logout}
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
      />
    )
  }

  return (
    <CodeEntryScreen
      title={weddingContent.defaultTitle}
      code={code}
      error={sessionError}
      submitting={submitting}
      onCodeChange={setCode}
      onSubmit={checkCode}
    />
  )
}

export default App

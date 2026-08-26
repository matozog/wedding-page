import { useCallback, useEffect } from 'react'
import { CodeEntryScreen } from '@/components/screens/CodeEntryScreen'
import { EventGalleryScreen } from '@/components/screens/EventGalleryScreen'
import { NicknameScreen } from '@/components/screens/NicknameScreen'
import { weddingContent } from '@/config/weddingContent'
import { useEventSession } from '@/hooks/useEventSession'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { usePhotos } from '@/hooks/usePhotos'
import { useUserRole } from '@/hooks/useUserRole'
import { deletePhoto } from '@/lib/photosApi'
import { canDeletePhotos } from '@/types/role'
import type { Photo } from '@/types/photo'

function App() {
  const {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    hasNickname,
    error: sessionError,
    setError: setSessionError,
    checkCode,
    saveNickname,
    loginWithGoogle,
    logout,
  } = useEventSession()

  const { role } = useUserRole()

  const eventId = session?.id ?? null
  const guestSessionId = session?.guest_session_id ?? null

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
    guestSessionId,
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

  const error = sessionError ?? photosError

  if (hasNickname && session) {
    return (
      <EventGalleryScreen
        eventName={session.name}
        nickname={nickname}
        photos={photos}
        loadingPhotos={loadingPhotos}
        uploading={uploading}
        uploadProgress={uploadProgress}
        error={error}
        canDeletePhotos={canDeletePhotos(role)}
        getPhotoUrl={getPhotoUrl}
        onUpload={uploadPhotos}
        onDeletePhoto={handleDeletePhoto}
        onLogout={logout}
      />
    )
  }

  if (session) {
    return (
      <NicknameScreen
        eventName={session.name}
        nickname={nickname}
        error={sessionError}
        onNicknameChange={setNickname}
        onSubmit={handleSaveNickname}
        onGoogleLogin={loginWithGoogle}
      />
    )
  }

  return (
    <CodeEntryScreen
      title={weddingContent.defaultTitle}
      code={code}
      error={sessionError}
      onCodeChange={setCode}
      onSubmit={checkCode}
    />
  )
}

export default App

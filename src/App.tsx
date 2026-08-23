import { useCallback } from 'react'
import { CodeEntryScreen } from '@/components/screens/CodeEntryScreen'
import { EventGalleryScreen } from '@/components/screens/EventGalleryScreen'
import { NicknameScreen } from '@/components/screens/NicknameScreen'
import { weddingContent } from '@/config/weddingContent'
import { useEventSession } from '@/hooks/useEventSession'
import { usePhotoUpload } from '@/hooks/usePhotoUpload'
import { usePhotos } from '@/hooks/usePhotos'

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
  } = useEventSession()

  const eventId = session?.id ?? null
  const guestSessionId = session?.guest_session_id ?? null

  const {
    photos,
    loading: loadingPhotos,
    error: photosError,
    loadPhotos,
    getPhotoUrl,
  } = usePhotos(eventId)

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
        getPhotoUrl={getPhotoUrl}
        onUpload={uploadPhotos}
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

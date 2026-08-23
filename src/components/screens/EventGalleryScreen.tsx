import { AboutCoupleSection } from '@/components/sections/AboutCoupleSection'
import { ContactSection } from '@/components/sections/ContactSection'
import { NewsSection } from '@/components/sections/NewsSection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { PhotoGallery } from '@/components/photos/PhotoGallery'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import type { Photo } from '@/types/photo'

type EventGalleryScreenProps = {
  eventName: string
  nickname: string
  photos: Photo[]
  loadingPhotos: boolean
  uploading: boolean
  uploadProgress: number
  error: string | null
  getPhotoUrl: (path: string) => Promise<string | null>
  onUpload: (files: File[]) => void
}

export function EventGalleryScreen({
  eventName,
  nickname,
  photos,
  loadingPhotos,
  uploading,
  uploadProgress,
  error,
  getPhotoUrl,
  onUpload,
}: EventGalleryScreenProps) {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader
        eventName={eventName}
        nickname={nickname}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onUpload={onUpload}
      />

      <PhotoGallery photos={photos} loading={loadingPhotos} getPhotoUrl={getPhotoUrl} />

      <AboutCoupleSection />
      <NewsSection />
      <ContactSection />
      <SiteFooter />

      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  )
}

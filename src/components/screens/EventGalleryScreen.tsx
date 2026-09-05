import { AboutCoupleSection } from '@/components/sections/AboutCoupleSection'
import { ContactSection } from '@/components/sections/ContactSection'
import { LocationMapSection } from '@/components/sections/LocationMapSection'
import { SeatingPlanSection } from '@/components/sections/SeatingPlanSection'
import { WeddingScheduleSection } from '@/components/sections/WeddingScheduleSection'
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
  canDeletePhotos: boolean
  getPhotoUrl: (path: string) => Promise<string | null>
  onUpload: (files: File[]) => void
  onDeletePhoto: (photo: Photo) => Promise<void>
  onLogout: () => void
}

export function EventGalleryScreen({
  eventName,
  nickname,
  photos,
  loadingPhotos,
  uploading,
  uploadProgress,
  error,
  canDeletePhotos,
  getPhotoUrl,
  onUpload,
  onDeletePhoto,
  onLogout,
}: EventGalleryScreenProps) {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader
        eventName={eventName}
        nickname={nickname}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onUpload={onUpload}
        onLogout={onLogout}
      />

      <PhotoGallery
        photos={photos}
        loading={loadingPhotos}
        getPhotoUrl={getPhotoUrl}
        canDeletePhotos={canDeletePhotos}
        onDeletePhoto={onDeletePhoto}
      />

      <AboutCoupleSection />
      <WeddingScheduleSection />
      <SeatingPlanSection />
      <LocationMapSection />
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

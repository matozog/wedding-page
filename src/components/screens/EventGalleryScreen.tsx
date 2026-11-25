import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'
import { AboutCoupleSection } from '@/components/sections/AboutCoupleSection'
import { ContactSection } from '@/components/sections/ContactSection'
import { LocationMapSection } from '@/components/sections/LocationMapSection'
import { WeddingScheduleSection } from '@/components/sections/WeddingScheduleSection'
import { SiteFooter } from '@/components/layout/SiteFooter'
import type { SectionNavLink } from '@/components/layout/SectionNav'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { PhotoGallery } from '@/components/photos/PhotoGallery'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SECTION_IDS, SECTION_NAV_ITEMS } from '@/config/navigation'
import { useSeatingPlan } from '@/hooks/useSeatingPlan'
import type { EventPage, EventSectionKey } from '@/types/eventPage'
import type { Photo } from '@/types/photo'

// Plan sali (Konva) w osobnym pliku - pobierany tylko, gdy sekcja jest na stronie.
const SeatingPlanSection = lazy(() =>
  import('@/components/sections/SeatingPlanSection').then((module) => ({ default: module.SeatingPlanSection }))
)

type EventGalleryScreenProps = {
  eventName: string
  nickname: string
  // Konfiguracja strony (sekcje, treści) - null do wczytania.
  page: EventPage | null
  pageError: string | null
  // Wydarzenie nie istnieje albo użytkownik stracił do niego dostęp.
  pageNotFound: boolean
  onRetryPage: () => void
  onLeaveEvent: () => void
  photos: Photo[]
  loadingPhotos: boolean
  uploading: boolean
  uploadProgress: number
  error: string | null
  navLinks?: readonly SectionNavLink[]
  canDeletePhoto: (photo: Photo) => boolean
  getPhotoUrl: (path: string) => Promise<string | null>
  onUpload: (files: File[]) => void
  onDeletePhoto: (photo: Photo) => Promise<void>
  onLogout: () => void
}

// Sekcja jest na stronie, gdy jest włączona w konfiguracji i ma treść
// (np. plan bez punktów nie jest pokazywany). Plan sali - gdy jest
// opublikowany i ma stoły (organizator widzi też nieopublikowany podgląd).
const visibleSections = (page: EventPage | null, hasSeatingPlan: boolean): ReadonlySet<EventSectionKey> => {
  if (!page) return new Set()

  const about = page.sections.couple
  const hasContent: Record<EventSectionKey, boolean> = {
    gallery: true,
    couple: Boolean(about?.content_title || about?.content_body || page.facts.length > 0 || page.photos.length > 0),
    seating: hasSeatingPlan,
    schedule: page.schedule.length > 0,
    location: page.locations.length > 0,
    contact: page.contacts.length > 0,
    footer: true,
  }

  const keys = Object.keys(hasContent) as EventSectionKey[]
  return new Set(keys.filter((key) => page.sections[key]?.is_visible && hasContent[key]))
}

export function EventGalleryScreen({
  eventName,
  nickname,
  page,
  pageError,
  pageNotFound,
  onRetryPage,
  onLeaveEvent,
  photos,
  loadingPhotos,
  uploading,
  uploadProgress,
  error,
  navLinks,
  canDeletePhoto,
  getPhotoUrl,
  onUpload,
  onDeletePhoto,
  onLogout,
}: EventGalleryScreenProps) {
  const seatingEnabled = page?.sections.seating?.is_visible ? page.event.id : null
  const { plan: seatingPlan, failed: seatingFailed, retry: retrySeating } = useSeatingPlan(seatingEnabled)
  // Błąd pobrania też pokazuje sekcję (z komunikatem) - inaczej wyglądałby
  // jak brak planu.
  const hasSeatingPlan = (seatingPlan !== null && seatingPlan.tables.length > 0) || seatingFailed
  const visible = useMemo(() => visibleSections(page, hasSeatingPlan), [page, hasSeatingPlan])
  const aboutPhotos = useMemo(() => page?.photos.filter((photo) => photo.section === 'couple') ?? [], [page])
  const navItems = useMemo(
    () =>
      SECTION_NAV_ITEMS.filter((item) => visible.has(item.key)).map((item) => ({
        ...item,
        label: page?.sections[item.key]?.nav_label ?? item.label,
      })),
    [page, visible]
  )

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader
        eventName={eventName}
        nickname={nickname}
        uploading={uploading}
        uploadProgress={uploadProgress}
        navItems={navItems}
        canUpload={visible.has('gallery')}
        navLinks={navLinks}
        onUpload={onUpload}
        onLogout={onLogout}
      />

      {page ? (
        <>
          {visible.has('gallery') && (
            <PhotoGallery
              header={page.sections.gallery}
              emptyText={page.sections.gallery.content_body}
              photos={photos}
              loading={loadingPhotos}
              getPhotoUrl={getPhotoUrl}
              canDeletePhoto={canDeletePhoto}
              onDeletePhoto={onDeletePhoto}
            />
          )}
          {visible.has('couple') && (
            <AboutCoupleSection
              config={page.sections.couple}
              facts={page.facts}
              photos={aboutPhotos}
            />
          )}
          {visible.has('schedule') && (
            <WeddingScheduleSection header={page.sections.schedule} items={page.schedule} />
          )}
          {visible.has('seating') && seatingFailed && (
            <section id={SECTION_IDS.seating} className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-14" role="alert">
              <ErrorMessage message="Nie udało się wczytać planu sali." />
              <Button type="button" variant="outline" onClick={retrySeating}>
                Spróbuj ponownie
              </Button>
            </section>
          )}
          {visible.has('seating') && seatingPlan && (
            <Suspense fallback={null}>
              <SeatingPlanSection
                header={page.sections.seating}
                hint={page.sections.seating.content_body}
                plan={seatingPlan}
              />
            </Suspense>
          )}
          {visible.has('location') && <LocationMapSection header={page.sections.location} locations={page.locations} />}
          {visible.has('contact') && <ContactSection header={page.sections.contact} contacts={page.contacts} />}
        </>
      ) : pageNotFound ? (
        <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
          <p className="font-serif text-2xl text-foreground">Nie masz dostępu do tego wydarzenia</p>
          <p className="text-sm text-muted-foreground">Mogło zostać usunięte albo usunięto Cię z listy uczestników.</p>
          <Button type="button" onClick={onLeaveEvent}>
            Wpisz kod ponownie
          </Button>
        </div>
      ) : pageError ? (
        <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24">
          <ErrorMessage message={pageError} />
          <Button type="button" variant="outline" onClick={onRetryPage}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Wczytywanie strony…
        </div>
      )}

      {visible.has('footer') && <SiteFooter eventName={eventName} message={page?.sections.footer.content_body ?? null} />}

      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  )
}

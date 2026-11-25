import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { describeSaveError } from '@/components/events/eventFormat'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { usePagePhotoUrls } from '@/hooks/usePagePhotoUrls'
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_SIZE_BYTES, PHOTO_INPUT_ACCEPT } from '@/lib/constants'
import { deleteEventPagePhoto, saveEventPagePhotos, uploadEventPagePhoto } from '@/lib/eventPageApi'
import { EVENT_PAGE_LIMITS, type PagePhoto } from '@/types/eventPage'

type PagePhotosManagerProps = {
  eventId: string
  photos: readonly PagePhoto[]
  onChange: (photos: PagePhoto[]) => void
}

const isAllowedType = (type: string) => (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(type)

// Opis tak, jak zapisze go baza: puste pole i brak opisu to to samo.
const altValue = (value: string | null | undefined) => value?.trim() ?? ''

// Zdjęcia karuzeli "O nas". Dodawanie i usuwanie zapisują się od razu,
// kolejność i opisy - przyciskiem "Zapisz kolejność i opisy".
export function PagePhotosManager({ eventId, photos, onChange }: PagePhotosManagerProps) {
  const id = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<PagePhoto[]>(() => [...photos])
  const [busy, setBusy] = useState<'upload' | 'order' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedOrder, setSavedOrder] = useState(false)
  const [toDelete, setToDelete] = useState<PagePhoto | null>(null)
  // Najnowsza zapisana lista - przesyłanie kilku plików i usuwanie budują
  // kolejny stan z niej, a nie z wartości z chwili rozpoczęcia operacji.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  // Miniatury z zapisanej listy - zmiana opisu w szkicu nie tworzy nowych adresów.
  const thumbnails = usePagePhotoUrls(photos, 'thumbnail')
  const srcById = new Map(thumbnails.map((photo) => [photo.id, photo.src]))

  const freeSlots = EVENT_PAGE_LIMITS.photos - draft.length
  const orderChanged =
    draft.length !== photos.length ||
    draft.some(
      (photo, index) =>
        photo.id !== photos[index]?.id || altValue(photo.alt_text) !== altValue(photos[index]?.alt_text)
    )

  // Rodzic dostaje tylko zapisany stan - niezapisane opisy i kolejność
  // zostają w szkicu.
  const commit = (saved: PagePhoto[], nextDraft: (current: PagePhoto[]) => PagePhoto[]) => {
    photosRef.current = saved
    setDraft(nextDraft)
    onChange(saved)
  }

  const upload = async (files: File[]) => {
    if (busy) return
    setError(null)
    setSavedOrder(false)

    const rejected = files.filter((file) => !isAllowedType(file.type) || file.size > MAX_PHOTO_SIZE_BYTES)
    const accepted = files.filter((file) => !rejected.includes(file)).slice(0, freeSlots)

    if (rejected.length > 0) {
      setError('Pominięto pliki o nieobsługiwanym typie lub większe niż 20 MB.')
    } else if (files.length > freeSlots) {
      setError(`Można dodać jeszcze ${freeSlots} zdjęć - pozostałe pominięto.`)
    }

    if (accepted.length === 0) return
    setBusy('upload')

    try {
      for (const file of accepted) {
        const photo = await uploadEventPagePhoto(eventId, file, null)
        commit([...photosRef.current, photo], (current) => [...current, photo])
      }
    } catch (err) {
      console.error(err)
      setError(describeSaveError(err, 'Nie udało się dodać zdjęcia.'))
    } finally {
      setBusy(null)
    }
  }

  const move = (from: number, to: number) => {
    setSavedOrder(false)
    setDraft((current) => {
      const next = [...current]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const saveOrder = async () => {
    if (busy) return
    setBusy('order')
    setError(null)

    const items = draft.map((photo) => ({ id: photo.id, alt_text: photo.alt_text?.trim() || null }))

    try {
      await saveEventPagePhotos(eventId, items)
      const saved = draft.map((photo, index) => ({ ...photo, alt_text: items[index].alt_text }))
      commit(saved, () => saved)
      setSavedOrder(true)
    } catch (err) {
      console.error(err)
      setError(describeSaveError(err, 'Nie udało się zapisać kolejności zdjęć.'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (photo: PagePhoto) => {
    // Usuwanie w trakcie przesyłania lub zapisu kolejności rozjechałoby listy.
    if (busy) throw new Error('Poczekaj na zakończenie trwającej operacji.')
    await deleteEventPagePhoto(photo.id)
    commit(
      photosRef.current.filter((item) => item.id !== photo.id),
      (current) => current.filter((item) => item.id !== photo.id)
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-sm font-medium text-foreground">
          Zdjęcia ({draft.length}/{EVENT_PAGE_LIMITS.photos})
        </h3>
        <input
          ref={fileInputRef}
          id={`${id}-files`}
          type="file"
          accept={PHOTO_INPUT_ACCEPT}
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void upload(files)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={freeSlots <= 0}
          aria-busy={busy === 'upload'}
          onClick={() => busy === null && fileInputRef.current?.click()}
        >
          {busy === 'upload' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4" aria-hidden="true" />
          )}
          {busy === 'upload' ? 'Wysyłanie…' : 'Dodaj zdjęcia'}
        </Button>
      </div>

      {draft.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zdjęć - karuzela nie jest pokazywana.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {draft.map((photo, index) => {
            const src = srcById.get(photo.id)
            const altId = `${id}-alt-${photo.id}`

            return (
              <li key={photo.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-2">
                {src ? (
                  <img src={src} alt="" className="size-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="size-16 shrink-0 rounded-md bg-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1 basis-48">
                  <label htmlFor={altId} className="text-xs text-muted-foreground">
                    Opis zdjęcia {index + 1} (dla czytników ekranu)
                  </label>
                  <Input
                    id={altId}
                    value={photo.alt_text ?? ''}
                    maxLength={EVENT_PAGE_LIMITS.photoAlt}
                    placeholder="np. Para na spacerze"
                    onChange={(e) => {
                      const value = e.target.value
                      setSavedOrder(false)
                      setDraft((current) => current.map((item) => (item.id === photo.id ? { ...item, alt_text: value } : item)))
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === 0}
                    aria-label={`Przesuń wyżej: zdjęcie ${index + 1}`}
                    title="Przesuń wyżej"
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === draft.length - 1}
                    aria-label={`Przesuń niżej: zdjęcie ${index + 1}`}
                    title="Przesuń niżej"
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    disabled={busy !== null}
                    aria-label={`Usuń zdjęcie ${index + 1}`}
                    title="Usuń"
                    onClick={() => setToDelete(photo)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {error && (
        <div role="alert">
          <ErrorMessage message={error} />
        </div>
      )}

      {draft.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            {savedOrder && !orderChanged ? 'Zapisano zmiany.' : ''}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!orderChanged}
            aria-busy={busy === 'order'}
            onClick={() => void saveOrder()}
          >
            {busy === 'order' ? 'Zapisywanie…' : 'Zapisz kolejność i opisy'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Usunąć zdjęcie?"
        description="Zdjęcie zniknie z karuzeli i zostanie trwale usunięte."
        confirmLabel="Usuń"
        destructive
        errorMessage="Nie udało się usunąć zdjęcia."
        onOpenChange={(open) => !open && setToDelete(null)}
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
      />
    </div>
  )
}

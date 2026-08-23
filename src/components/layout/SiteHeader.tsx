import { Camera, Loader2 } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { weddingContent } from '@/config/weddingContent'
import { ALLOWED_PHOTO_MIME_TYPES } from '@/lib/constants'

type SiteHeaderProps = {
  eventName: string
  nickname: string
  uploading: boolean
  uploadProgress: number
  onUpload: (files: File[]) => void
}

export function SiteHeader({
  eventName,
  nickname,
  uploading,
  uploadProgress,
  onUpload,
}: SiteHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="text-center sm:text-left">
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-primary">
            {weddingContent.couple.names}
          </p>
          {/* <h1 className="font-serif text-3xl text-foreground md:text-4xl">{eventName}</h1> */}
          <p className="mt-1 text-sm text-muted-foreground">
            Witaj, <span className="font-medium text-foreground">{nickname}</span> — miło, że jesteś z nami
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 sm:items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_PHOTO_MIME_TYPES.join(',')}
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) {
                onUpload(files)
              }
              e.target.value = ''
            }}
          />

          <Button
            size="lg"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="min-w-[180px] shadow-sm"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploading ? 'Wysyłanie…' : 'Dodaj zdjęcia'}
          </Button>

          {uploading && (
            <div className="w-full min-w-[180px] space-y-1 sm:w-48">
              <Progress value={uploadProgress} />
              <p className="text-center text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

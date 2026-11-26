import { Camera, LogOut, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import {
  SectionNavBar,
  SectionNavMenu,
  type SectionNavAction,
  type SectionNavLink,
} from '@/components/layout/SectionNav'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { SectionNavItem } from '@/components/layout/SectionNav'
import { useActiveSection } from '@/hooks/useActiveSection'
import { PHOTO_INPUT_ACCEPT } from '@/lib/constants'

type SiteHeaderProps = {
  eventName: string
  nickname: string
  uploading: boolean
  uploadProgress: number
  // Widoczne sekcje strony (ukryte w konfiguracji wydarzenia nie trafiają do menu).
  navItems: readonly SectionNavItem[]
  // Przycisk dodawania zdjęć - tylko gdy galeria jest widoczna.
  canUpload: boolean
  navLinks?: readonly SectionNavLink[]
  // Akcje na końcu menu (np. udostępnienie wydarzenia).
  navActions?: readonly SectionNavAction[]
  onUpload: (files: File[]) => void
  onLogout: () => void
}

export function SiteHeader({
  eventName,
  nickname,
  uploading,
  uploadProgress,
  navItems,
  canUpload,
  navLinks,
  navActions,
  onUpload,
  onLogout,
}: SiteHeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sectionIds = useMemo(() => navItems.map((item) => item.id), [navItems])
  const activeSectionId = useActiveSection(sectionIds)

  // Wysokość przyklejonego nagłówka trafia do CSS (scroll-margin-top sekcji).
  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--site-header-height', `${header.offsetHeight}px`)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)

    return () => {
      observer.disconnect()
      root.style.removeProperty('--site-header-height')
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="min-w-0">
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-primary">
            {eventName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Witaj, <span className="font-medium text-foreground">{nickname}</span>
            <span className="hidden sm:inline"> — miło, że jesteś z nami</span>
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-3" />
            Zmień pseudonim / wyloguj
          </button>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {canUpload && (
            <div className="flex flex-col items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={PHOTO_INPUT_ACCEPT}
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
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="shadow-sm sm:h-11 sm:min-w-[180px] sm:px-8"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                {uploading ? (
                  'Wysyłanie…'
                ) : (
                  <>
                    <span className="sm:hidden">Dodaj</span>
                    <span className="hidden sm:inline">Dodaj zdjęcia</span>
                  </>
                )}
              </Button>

              {uploading && (
                <div className="w-full space-y-1">
                  <Progress value={uploadProgress} aria-label="Postęp wysyłania zdjęć" />
                  <p className="text-center text-xs text-muted-foreground">{uploadProgress}%</p>
                </div>
              )}
            </div>
          )}

          <SectionNavMenu
            items={navItems}
            activeId={activeSectionId}
            links={navLinks}
            actions={navActions}
            className="lg:hidden sm:size-11"
          />
        </div>
      </div>

      <SectionNavBar
        items={navItems}
        activeId={activeSectionId}
        links={navLinks}
        actions={navActions}
        className="hidden border-t border-border/50 px-4 py-2 lg:block"
      />
    </header>
  )
}

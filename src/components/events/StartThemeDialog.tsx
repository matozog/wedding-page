import { StartThemePreview } from '@/components/eventConfig/ThemePreviews'
import { ThemeSettings } from '@/components/eventConfig/ThemeSettings'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AppTheme } from '@/config/themes'
import { setStartTheme } from '@/lib/appSettingsApi'

type StartThemeDialogProps = {
  theme: AppTheme
  onClose: () => void
  onSaved: (theme: AppTheme) => void
}

// Motyw ekranu startowego (wpisywanie kodu) - widzą go wszyscy przed
// wejściem do wydarzenia. Tylko super admin (set_start_theme sprawdza to w bazie).
export function StartThemeDialog({ theme, onClose, onSaved }: StartThemeDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Motyw ekranu startowego</DialogTitle>
          <DialogDescription>
            Kolory ekranu wpisywania kodu. Po wpisaniu kodu goście widzą już motyw wybranego wydarzenia.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <ThemeSettings theme={theme} preview={<StartThemePreview />} onSave={setStartTheme} onSaved={onSaved} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

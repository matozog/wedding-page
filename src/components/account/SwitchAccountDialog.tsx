import { ArrowRightLeft, Link2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SwitchAccountDialogProps = {
  open: boolean
  // Akcja w toku (przekierowanie do Google) - przyciski wyłączone.
  busy: boolean
  onOpenChange: (open: boolean) => void
  // To samo konto dostaje tożsamość Google - wpisy zostają.
  onLink: () => void
  // Logowanie innym kontem Google - wpisy zostają przy pseudonimie.
  onSwitch: () => void
}

// Gość z pseudonimem (konto anonimowe) przechodzi na konto Google.
export function SwitchAccountDialog({ open, busy, onOpenChange, onLink, onSwitch }: SwitchAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Przełącz konto</DialogTitle>
          <DialogDescription>Korzystasz z wydarzenia pod pseudonimem. Wybierz, jak przejść na konto Google.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          <SwitchOption
            icon={<Link2 className="size-5" aria-hidden="true" />}
            title="Połącz pseudonim z kontem Google"
            disabled={busy}
            onClick={onLink}
          >
            Twoje zdjęcia i wpisy zostają. Wszyscy w wydarzeniu zobaczą imię z konta Google zamiast pseudonimu. Tylko dla
            konta Google, którego nie używasz jeszcze w tej aplikacji.
          </SwitchOption>
          <SwitchOption
            icon={<ArrowRightLeft className="size-5" aria-hidden="true" />}
            title="Zaloguj się kontem Google"
            disabled={busy}
            onClick={onSwitch}
          >
            Wejdziesz do wydarzenia jako inne konto. Zdjęcia i wpisy dodane pod pseudonimem zostaną przy nim i nie
            będzie można ich już edytować z tego urządzenia.
          </SwitchOption>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type SwitchOptionProps = {
  icon: ReactNode
  title: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

function SwitchOption({ icon, title, disabled, onClick, children }: SwitchOptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg border border-border/80 p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="mt-0.5 text-primary">{icon}</span>
      <span className="flex flex-col gap-1">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{children}</span>
      </span>
    </button>
  )
}

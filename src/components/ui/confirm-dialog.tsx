import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  // Np. dopóki użytkownik nie przepisze nazwy usuwanego elementu.
  confirmDisabled?: boolean
  errorMessage?: string
  children?: ReactNode
  onOpenChange: (open: boolean) => void
  // Okno zamyka się po udanym wykonaniu; błąd zostaje w oknie.
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  errorMessage = 'Operacja nie powiodła się. Spróbuj ponownie.',
  children,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (pending) return
    if (!next) setError(null)
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (pending) return
    setPending(true)
    setError(null)

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      setError(errorMessage)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        {error && (
          <div className="mt-4" role="alert">
            <ErrorMessage message={error} />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Anuluj
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending || confirmDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

// Odświeżenie wczytanej wcześniej listy się nie udało - lista na ekranie
// może być nieaktualna.
export function ShoppingRefreshError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="alert">
      <div className="min-w-0 flex-1">
        <ErrorMessage message="Nie udało się odświeżyć listy - może być nieaktualna." />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Spróbuj ponownie
      </Button>
    </div>
  )
}

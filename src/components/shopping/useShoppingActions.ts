import { useCallback, useRef, useState } from 'react'
import { describeShoppingError } from '@/lib/shoppingApi'
import type { ShoppingItem } from '@/types/shopping'

// Stan akcji na pozycjach listy (strona i panel): która pozycja jest w toku,
// ostatni błąd, okna edycji i usuwania.
export function useShoppingActions() {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [deleting, setDeleting] = useState<ShoppingItem | null>(null)
  // Blokada podwójnego kliknięcia (stan React aktualizuje się z opóźnieniem).
  const busyRef = useRef(false)

  const run = useCallback(async (itemId: string, action: () => Promise<void>, fallback: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setPendingId(itemId)
    setError(null)

    try {
      await action()
    } catch (err) {
      console.error(err)
      setError(describeShoppingError(err, fallback))
    } finally {
      busyRef.current = false
      setPendingId(null)
    }
  }, [])

  return { pendingId, error, setError, editing, setEditing, deleting, setDeleting, run }
}

import { useEffect, useState } from 'react'
import type { FieldValues, UseFormWatch } from 'react-hook-form'

// "Zapisano zmiany" po udanym zapisie, do pierwszej zmiany w formularzu.
// Wywołaj markSaved() po reset() - reset też powiadamia watch.
export function useSavedFlag<T extends FieldValues>(watch: UseFormWatch<T>) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const subscription = watch(() => setSaved(false))
    return () => subscription.unsubscribe()
  }, [watch])

  return { saved, markSaved: () => setSaved(true) }
}

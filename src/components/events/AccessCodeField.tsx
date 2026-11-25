import { Shuffle } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/components/expenses/formField'
import { fieldAria } from '@/components/expenses/formFieldProps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AccessCodeFieldProps = {
  id: string
  label: string
  error?: string
  registration: UseFormRegisterReturn
  onGenerate: () => void
}

// Pole kodu dostępu z przyciskiem losowania. Kod widać tylko tutaj - baza
// przechowuje jego hash, więc później nie da się go odczytać.
export function AccessCodeField({ id, label, error, registration, onGenerate }: AccessCodeFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      error={error}
      hint="Wielkość liter i spacje na końcach nie mają znaczenia. Zapisz kod - po zapisaniu nie da się go odczytać."
    >
      <div className="flex gap-2">
        <Input
          id={id}
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase aria-invalid:border-destructive"
          {...fieldAria(id, error, true)}
          {...registration}
        />
        <Button type="button" variant="outline" onClick={onGenerate} title="Wylosuj kod">
          <Shuffle className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Wylosuj</span>
          <span className="sr-only sm:hidden">Wylosuj kod</span>
        </Button>
      </div>
    </FormField>
  )
}

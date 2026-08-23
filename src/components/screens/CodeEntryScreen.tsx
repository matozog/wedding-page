import type { FormEvent } from 'react'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'

type CodeEntryScreenProps = {
  title: string
  code: string
  error: string | null
  onCodeChange: (value: string) => void
  onSubmit: () => void
}

export function CodeEntryScreen({
  title,
  code,
  error,
  onCodeChange,
  onSubmit,
}: CodeEntryScreenProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <OnboardingLayout
      step={1}
      title={title}
      subtitle="Wpisz kod dostępu, aby wejść na stronę weselną."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="access-code">Kod dostępu</Label>
          <Input
            id="access-code"
            type="text"
            placeholder="np. WESELE2026"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            className="text-center uppercase tracking-widest"
            autoComplete="off"
          />
        </div>

        <Button type="submit" className="w-full" size="lg">
          Wejdź na stronę
        </Button>

        <ErrorMessage message={error} />
      </form>
    </OnboardingLayout>
  )
}

import type { FormEvent } from 'react'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { GoogleIcon } from '@/components/icons/GoogleIcon'

type NicknameScreenProps = {
  eventName: string
  nickname: string
  error: string | null
  submitting: boolean
  onNicknameChange: (value: string) => void
  onSubmit: () => void
  onGoogleLogin: () => void
  // Powrót do wpisania kodu - tylko gdy kod nie został jeszcze sprawdzony.
  onChangeCode?: () => void
}

export function NicknameScreen({
  eventName,
  nickname,
  error,
  submitting,
  onNicknameChange,
  onSubmit,
  onGoogleLogin,
  onChangeCode,
}: NicknameScreenProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!submitting) {
      onSubmit()
    }
  }

  return (
    <OnboardingLayout
      step={2}
      title={eventName}
      subtitle="Jak mamy Cię podpisać przy zdjęciach?"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nickname">Twój pseudonim</Label>
          <Input
            id="nickname"
            type="text"
            placeholder="np. Kasia z Warszawy"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          Przejdź do strony
        </Button>

        <ErrorMessage message={error} />
      </form>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">lub</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={onGoogleLogin}
        disabled={submitting}
      >
        <GoogleIcon />
        Zaloguj się przez Google
      </Button>

      {onChangeCode && (
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full text-muted-foreground"
          onClick={onChangeCode}
          disabled={submitting}
        >
          Zmień kod dostępu
        </Button>
      )}
    </OnboardingLayout>
  )
}

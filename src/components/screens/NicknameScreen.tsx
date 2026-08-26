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
  onNicknameChange: (value: string) => void
  onSubmit: () => void
  onGoogleLogin: () => void
}

export function NicknameScreen({
  eventName,
  nickname,
  error,
  onNicknameChange,
  onSubmit,
  onGoogleLogin,
}: NicknameScreenProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
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
            maxLength={30}
            autoFocus
          />
        </div>

        <Button type="submit" className="w-full" size="lg">
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
      >
        <GoogleIcon />
        Zaloguj się przez Google
      </Button>
    </OnboardingLayout>
  )
}

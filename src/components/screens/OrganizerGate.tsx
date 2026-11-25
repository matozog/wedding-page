import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { GoogleIcon } from '@/components/icons/GoogleIcon'
import { OnboardingLayout } from '@/components/layout/OnboardingLayout'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ROUTES } from '@/lib/routes'

// Stan konta potrzebny stronom organizatora (/events, /events/:id).
export type OrganizerAccess = {
  initializing: boolean
  submitting: boolean
  hasGoogleAccount: boolean
  isSuperAdmin: boolean
  accountLabel: string
  error: string | null
  onLogin: () => void
  onSwitchAccount: () => void
  onLogout: () => void
}

const homeLinkClassName =
  'self-center rounded-sm text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Wejście na strony organizatora: logowanie Google, "Brak dostępu" albo
// treść dla super admina. Tylko UI - dane i operacje autoryzuje baza (PT403
// dla każdego, kto nie jest super adminem).
export function OrganizerGate({ access, children }: { access: OrganizerAccess; children: ReactNode }) {
  const { initializing, submitting, hasGoogleAccount, isSuperAdmin, accountLabel, error, onLogin, onSwitchAccount } =
    access

  if (initializing) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Wczytywanie…</span>
      </div>
    )
  }

  if (!hasGoogleAccount) {
    return (
      <OnboardingLayout title="Panel organizatora" subtitle="Zaloguj się kontem Google z uprawnieniami organizatora.">
        <div className="flex flex-col gap-5">
          <Button type="button" size="lg" variant="outline" className="w-full gap-2" disabled={submitting} onClick={onLogin}>
            <GoogleIcon className="size-4" />
            Zaloguj się przez Google
          </Button>
          <ErrorMessage message={error} />
          <Link to={ROUTES.home} className={homeLinkClassName}>
            Masz kod zaproszenia? Przejdź do strony wydarzenia
          </Link>
        </div>
      </OnboardingLayout>
    )
  }

  if (!isSuperAdmin) {
    return (
      <OnboardingLayout title="Brak dostępu" subtitle={`Konto ${accountLabel} nie ma uprawnień organizatora.`}>
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full gap-2"
            disabled={submitting}
            onClick={onSwitchAccount}
          >
            <GoogleIcon className="size-4" />
            Zaloguj się innym kontem
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Zmiana konta wyloguje Cię także ze strony wydarzenia.
          </p>
          <ErrorMessage message={error} />
          <Button asChild size="lg">
            <Link to={ROUTES.home}>Wróć do strony głównej</Link>
          </Button>
        </div>
      </OnboardingLayout>
    )
  }

  return children
}

import { ArrowLeft, LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { weddingContent } from '@/config/weddingContent'
import { ROUTES } from '@/lib/routes'

type ManagementScreenProps = {
  eventName: string
  nickname: string
  canManage: boolean
  error: string | null
  onLogout: () => void
}

// Panel zarządzania wydarzeniem. Ukrycie ekranu przed innymi rolami to tylko
// warstwa UI - każda operacja panelu musi być autoryzowana w bazie.
export function ManagementScreen({
  eventName,
  nickname,
  canManage,
  error,
  onLogout,
}: ManagementScreenProps) {
  // Router nie resetuje przewinięcia - po przejściu ze strony wydarzenia
  // panel otwierałby się w połowie.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border/70 bg-background/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="font-serif text-xs uppercase tracking-[0.3em] text-primary">
              {weddingContent.couple.names}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Zalogowano jako <span className="font-medium text-foreground">{nickname}</span>
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-1 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="size-3" />
              Wyloguj
            </button>
          </div>

          <Button asChild variant="outline">
            <Link to={ROUTES.home}>
              <ArrowLeft className="size-4" />
              Wróć do strony wydarzenia
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {canManage ? (
          <>
            <div className="mb-8">
              <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">
                Zarządzanie
              </p>
              <h1 className="mt-2 font-serif text-4xl text-foreground">{eventName}</h1>
            </div>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutDashboard className="size-5 text-primary" aria-hidden="true" />
                  Panele zarządzania
                </CardTitle>
                <CardDescription>
                  Tutaj pojawią się narzędzia do zarządzania wydarzeniem.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Brak dostępnych paneli.
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <ShieldAlert className="mx-auto size-8 text-primary" aria-hidden="true" />
              <h1 className="font-serif text-2xl text-foreground">Brak dostępu</h1>
              <CardDescription>
                Panel zarządzania jest dostępny tylko dla administratorów wydarzenia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={ROUTES.home}>Wróć do strony wydarzenia</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <SiteFooter />

      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  )
}

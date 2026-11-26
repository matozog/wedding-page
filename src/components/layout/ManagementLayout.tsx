import { ArrowLeft, ChevronRight, LogOut, ShieldAlert, UserPen } from 'lucide-react'
import { Fragment, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAccount } from '@/components/account/accountContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

export type BreadcrumbItem = { label: string; to?: string }

type ManagementLayoutProps = {
  // Nazwa wydarzenia albo tytuł strony spoza wydarzenia (panel organizatora).
  eventName: string
  nickname: string
  // ADMIN i EDITOR (podgląd). Ukrycie ekranu to tylko UI - operacje panelu
  // autoryzuje baza.
  canView: boolean
  error: string | null
  breadcrumbs: readonly BreadcrumbItem[]
  // Na desktopie strona zajmuje dokładnie wysokość okna, a przewija się
  // zawartość (np. tabela gości).
  fillViewport?: boolean
  // Przycisk powrotu do strony wydarzenia - ukryty, gdy nie wybrano wydarzenia.
  showEventLink?: boolean
  onLogout: () => void
  children: ReactNode
}

// Wspólny układ podstron zarządzania. Niezależny od rodzaju wydarzenia -
// bez treści strony wydarzenia.
export function ManagementLayout({
  eventName,
  nickname,
  canView,
  error,
  breadcrumbs,
  fillViewport = false,
  showEventLink = true,
  onLogout,
  children,
}: ManagementLayoutProps) {
  const account = useAccount()
  const logoutLabel = account?.isAnonymous ? 'Wyjdź' : 'Wyloguj'

  // Router nie resetuje przewinięcia - podstrona otwierałaby się w połowie.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className={cn('flex min-h-svh flex-col bg-background', fillViewport && 'lg:h-svh')}>
      <header className="border-b border-border/70 bg-background">
        <div className="mx-auto flex w-full max-w-[96rem] items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <nav aria-label="Ścieżka" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <li className="min-w-0 truncate font-serif text-base text-foreground">{eventName}</li>
              {breadcrumbs.map((item, index) => {
                const last = index === breadcrumbs.length - 1

                return (
                  <Fragment key={item.label}>
                    <li aria-hidden="true">
                      <ChevronRight className="size-3.5" />
                    </li>
                    <li className="shrink-0">
                      {item.to && !last ? (
                        <Link
                          to={item.to}
                          className="rounded-sm underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span aria-current={last ? 'page' : undefined} className={cn(last && 'text-foreground')}>
                          {item.label}
                        </span>
                      )}
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </nav>

          <p className="hidden shrink-0 text-sm text-muted-foreground md:block">
            Zalogowano jako <span className="font-medium text-foreground">{nickname}</span>
          </p>
          {account && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={account.onChangeNickname}
              aria-label="Zmień nazwę"
              title="Zmień nazwę"
            >
              <UserPen className="size-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onLogout} aria-label={logoutLabel} title={logoutLabel}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">{logoutLabel}</span>
          </Button>
          {showEventLink && (
            <Button asChild variant="outline" size="sm">
              <Link to={ROUTES.home} aria-label="Wróć do strony wydarzenia" title="Wróć do strony wydarzenia">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Strona wydarzenia</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <main
        className={cn(
          'mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8',
          fillViewport && 'lg:min-h-0 lg:py-4'
        )}
      >
        {canView ? (
          children
        ) : (
          <Card className="mx-auto mt-10 max-w-md text-center">
            <CardHeader>
              <ShieldAlert className="mx-auto size-8 text-primary" aria-hidden="true" />
              <h1 className="font-serif text-2xl text-foreground">Brak dostępu</h1>
              <CardDescription>
                Panel zarządzania jest dostępny tylko dla organizatorów wydarzenia.
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

      {error && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  )
}

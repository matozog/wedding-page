import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Menu, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export type SectionNavItem = {
  id: string
  label: string
}

// Dodatkowy link do innej podstrony (np. panel zarządzania).
export type SectionNavLink = {
  to: string
  label: string
  icon?: LucideIcon
}

type SectionNavProps = {
  items: readonly SectionNavItem[]
  activeId: string | null
  links?: readonly SectionNavLink[]
}

// Przewija do sekcji (płynność i odstęp od nagłówka wynikają z CSS),
// przenosi na nią fokus i zapisuje kotwicę w adresie bez nowego wpisu w historii.
function useScrollToSection() {
  const navigate = useNavigate()

  return useCallback(
    (id: string) => {
      const section = document.getElementById(id)
      if (!section) return

      section.scrollIntoView({ block: 'start' })

      if (!section.hasAttribute('tabindex')) {
        section.setAttribute('tabindex', '-1')
      }
      section.focus({ preventScroll: true })

      navigate({ hash: id }, { replace: true })
    },
    [navigate]
  )
}

const isModifiedClick = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

const itemClassName = (active: boolean) =>
  cn(
    'rounded-md px-3 py-2 text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-secondary font-medium text-foreground'
      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
  )

// Poziomy pasek sekcji - widoczny od breakpointu lg.
export function SectionNavBar({ items, activeId, links = [], className }: SectionNavProps & { className?: string }) {
  const scrollToSection = useScrollToSection()

  return (
    <nav aria-label="Sekcje strony" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={activeId === item.id ? 'true' : undefined}
              className={itemClassName(activeId === item.id)}
              onClick={(event) => {
                if (isModifiedClick(event)) return
                event.preventDefault()
                scrollToSection(item.id)
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn(itemClassName(false), 'inline-flex items-center gap-1.5 text-primary')}
            >
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Przycisk z panelem bocznym - na węższych ekranach.
export function SectionNavMenu({ items, activeId, links = [], className }: SectionNavProps & { className?: string }) {
  const scrollToSection = useScrollToSection()
  const [open, setOpen] = useState(false)
  // Sekcja wybrana w panelu - przewijamy po jego zamknięciu, gdy Radix
  // zdejmie blokadę przewijania strony.
  const pendingSectionRef = useRef<string | null>(null)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Otwórz menu" className={className}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        onCloseAutoFocus={(event) => {
          const id = pendingSectionRef.current
          if (!id) return

          // Fokus trafia na wybraną sekcję zamiast na przycisk menu.
          event.preventDefault()
          pendingSectionRef.current = null
          scrollToSection(id)
        }}
      >
        <SheetTitle>Menu</SheetTitle>
        <SheetDescription className="sr-only">Przejdź do wybranej sekcji strony.</SheetDescription>

        <nav aria-label="Sekcje strony" className="mt-6">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={activeId === item.id ? 'true' : undefined}
                  className={cn(itemClassName(activeId === item.id), 'block py-3 text-base')}
                  onClick={(event) => {
                    if (isModifiedClick(event)) return
                    event.preventDefault()
                    pendingSectionRef.current = item.id
                    setOpen(false)
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {links.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1 border-t border-border/70 pt-4">
              {links.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      itemClassName(false),
                      'flex items-center gap-2 py-3 text-base text-primary'
                    )}
                  >
                    {Icon && <Icon className="size-4" aria-hidden="true" />}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

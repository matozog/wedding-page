import { Check, Copy, Loader2, MessageCircle, MessageSquareText, Send, Share2 } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMediaQuery } from '@/hooks/useMediaQuery'

type ShareEventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventName: string
  // Link do udostępnienia (np. osobisty link zaproszenia). Wołane przy
  // każdym otwarciu okna, dopóki nie zwróci linku.
  getLink: () => Promise<string>
  // Komunikat błędu pobrania linku (domyślnie ogólny).
  describeError?: (err: unknown) => string
}

// Messenger na komputerze wymaga identyfikatora aplikacji Facebooka
// (Send Dialog). Bez niego przycisk jest tylko na telefonach (aplikacja).
const FACEBOOK_APP_ID: string | undefined = import.meta.env.VITE_FACEBOOK_APP_ID || undefined

const shareText = (eventName: string) => `Zapraszam na stronę wydarzenia „${eventName}”:`

type ShareTarget = {
  key: string
  label: string
  icon: ReactNode
  href: string
}

const buildTargets = (link: string, eventName: string, isMobile: boolean): ShareTarget[] => {
  const text = shareText(eventName)
  const message = `${text} ${link}`
  const targets: ShareTarget[] = [
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <MessageCircle className="size-4 text-[#25D366]" aria-hidden="true" />,
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
    },
  ]

  if (isMobile) {
    targets.push({
      key: 'messenger',
      label: 'Messenger',
      icon: <Send className="size-4 text-[#0084FF]" aria-hidden="true" />,
      href: `fb-messenger://share/?link=${encodeURIComponent(link)}`,
    })
  } else if (FACEBOOK_APP_ID) {
    targets.push({
      key: 'messenger',
      label: 'Messenger',
      icon: <Send className="size-4 text-[#0084FF]" aria-hidden="true" />,
      href:
        'https://www.facebook.com/dialog/send?' +
        new URLSearchParams({ app_id: FACEBOOK_APP_ID, link, redirect_uri: link }).toString(),
    })
  }

  // sms: działa na telefonach; na komputerze zwykle nie ma czym go otworzyć.
  if (isMobile) {
    targets.push({
      key: 'sms',
      label: 'SMS',
      icon: <MessageSquareText className="size-4" aria-hidden="true" />,
      // "?&body=" - działa i na iOS, i na Androidzie.
      href: `sms:?&body=${encodeURIComponent(message)}`,
    })
  }

  return targets
}

const copyToClipboard = async (text: string, fallbackInput: HTMLInputElement | null) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Brak Clipboard API (np. stara przeglądarka) - zaznaczamy pole, żeby
    // można było skopiować ręcznie.
    fallbackInput?.focus()
    fallbackInput?.select()
    return false
  }
}

// Okno udostępniania: link do skopiowania, systemowe "Udostępnij…"
// (telefony) oraz WhatsApp, Messenger i SMS.
export function ShareEventDialog({ open, onOpenChange, eventName, getLink, describeError }: ShareEventDialogProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const isMobile = useMediaQuery('(pointer: coarse)')
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const load = useCallback(async () => {
    setError(null)

    try {
      setLink(await getLink())
    } catch (err) {
      console.error(err)
      setError(describeError?.(err) ?? 'Nie udało się przygotować linku.')
    }
  }, [describeError, getLink])

  useEffect(() => {
    if (open && !link) {
      void load()
    }
  }, [link, load, open])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    if (!link) return
    const ok = await copyToClipboard(link, inputRef.current)
    setCopied(ok)
    setCopyFailed(!ok)
  }

  const handleNativeShare = async () => {
    if (!link) return

    try {
      await navigator.share({ title: eventName, text: shareText(eventName), url: link })
    } catch (err) {
      // AbortError - użytkownik zamknął panel udostępniania.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error(err)
      }
    }
  }

  const targets = link ? buildTargets(link, eventName, isMobile) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Udostępnij wydarzenie</DialogTitle>
          <DialogDescription>
            Wyślij swój link znajomym. Po wejściu zobaczą, że zaproszenie jest od Ciebie.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div role="alert" className="mt-4 flex flex-col gap-3">
            <ErrorMessage message={error} />
            <Button type="button" variant="outline" onClick={() => void load()}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : !link ? (
          <p className="mt-4 flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Przygotowywanie linku…
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-link`}>Twój link</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id={`${id}-link`}
                  value={link}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <Button type="button" variant="outline" onClick={() => void handleCopy()} className="shrink-0">
                  {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                  {copied ? 'Skopiowano' : 'Kopiuj'}
                </Button>
              </div>
              <p className="sr-only" aria-live="polite">
                {copied ? 'Link skopiowany do schowka.' : ''}
              </p>
              {copyFailed && (
                <p className="text-xs text-muted-foreground">
                  Nie udało się skopiować automatycznie - link jest zaznaczony, skopiuj go ręcznie.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {canNativeShare && (
                <Button type="button" onClick={() => void handleNativeShare()} className="col-span-2">
                  <Share2 className="size-4" aria-hidden="true" />
                  Udostępnij…
                </Button>
              )}
              {targets.map((target, index) => (
                <Button
                  key={target.key}
                  asChild
                  variant="outline"
                  // Nieparzysta liczba przycisków - ostatni na całą szerokość.
                  className={targets.length % 2 === 1 && index === targets.length - 1 ? 'col-span-2' : undefined}
                >
                  {/* Schematy aplikacji (fb-messenger:, sms:) w tej samej karcie -
                      nowa zostałaby pusta. */}
                  <a
                    href={target.href}
                    target={target.href.startsWith('https:') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                  >
                    {target.icon}
                    {target.label}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

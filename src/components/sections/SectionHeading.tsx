import type { SectionHeader } from '@/types/eventPage'

// Nagłówek sekcji strony wydarzenia - treść z konfiguracji wydarzenia.
// Puste pola się nie wyświetlają.
export function SectionHeading({ eyebrow, title, description }: SectionHeader) {
  if (!eyebrow && !title && !description) {
    return null
  }

  return (
    <div className="mb-10 text-center">
      {eyebrow && <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">{eyebrow}</p>}
      {title && <h2 className="mt-2 font-serif text-4xl text-foreground">{title}</h2>}
      {description && (
        <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

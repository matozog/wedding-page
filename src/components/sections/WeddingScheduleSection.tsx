import { Card, CardContent } from '@/components/ui/card'
import { SECTION_IDS } from '@/config/navigation'
import type { ScheduleItem, SectionHeader } from '@/types/eventPage'
import { SectionHeading } from './SectionHeading'

type WeddingScheduleSectionProps = {
  header: SectionHeader
  items: readonly ScheduleItem[]
}

// Plan wydarzenia - punkty z konfiguracji wydarzenia.
export function WeddingScheduleSection({ header, items }: WeddingScheduleSectionProps) {
  return (
    <section id={SECTION_IDS.schedule} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading {...header} />

      <Card className="border-border/80 bg-card/80">
        <CardContent className="pt-6">
          <ol className="relative mx-auto max-w-md space-y-8 border-l border-border/80 pl-6">
            {items.map((item, index) => (
              <li key={index} className="relative">
                <span className="absolute -left-[1.95rem] top-1 size-3 rounded-full border-2 border-primary bg-card" />
                {item.time_label && (
                  <p className="font-serif text-sm uppercase tracking-[0.2em] text-primary">{item.time_label}</p>
                )}
                <p className="mt-1 font-medium text-foreground">{item.title}</p>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  )
}

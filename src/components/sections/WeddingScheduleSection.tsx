import { weddingContent } from '@/config/weddingContent'
import { Card, CardContent } from '@/components/ui/card'

const { schedule } = weddingContent

export function WeddingScheduleSection() {
  return (
    <section
      id="plan-dnia"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8"
    >
      <div className="mb-10 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">Informacje</p>
        <h2 className="mt-2 font-serif text-4xl text-foreground">Plan dnia weselnego</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{schedule.note}</p>
      </div>

      <Card className="border-border/80 bg-card/80">
        <CardContent className="pt-6">
          <ol className="relative mx-auto max-w-md space-y-8 border-l border-border/80 pl-6">
            {schedule.items.map((item) => (
              <li key={`${item.time}-${item.title}`} className="relative">
                <span className="absolute -left-[1.95rem] top-1 size-3 rounded-full border-2 border-primary bg-card" />
                <p className="font-serif text-sm uppercase tracking-[0.2em] text-primary">
                  {item.time}
                </p>
                <p className="mt-1 font-medium text-foreground">{item.title}</p>
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  )
}

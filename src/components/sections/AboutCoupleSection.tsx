import { CalendarDays, Heart, MapPin } from 'lucide-react'
import { weddingContent } from '@/config/weddingContent'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function AboutCoupleSection() {
  const { couple } = weddingContent

  return (
    <section id="para" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">O nas</p>
        <h2 className="mt-2 font-serif text-4xl text-foreground">Para młoda</h2>
      </div>

      <Card className="overflow-hidden border-border/80 bg-card/80">
        <CardHeader className="border-b border-border/60 bg-secondary/30 pb-6 text-center">
          <CardTitle className="text-3xl md:text-4xl">{couple.names}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-8">
          <p className="mx-auto max-w-2xl text-center leading-relaxed text-muted-foreground">
            {couple.story}
          </p>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg bg-background/70 p-4">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Data</p>
                <p className="text-sm text-muted-foreground">{couple.date}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-background/70 p-4">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">Miejsce</p>
                <p className="text-sm text-muted-foreground">{couple.venue}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Heart className="size-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

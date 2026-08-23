import { weddingContent } from '@/config/weddingContent'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function NewsSection() {
  return (
    <section id="aktualnosci" className="bg-secondary/40 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="font-serif text-sm uppercase tracking-[0.3em] text-primary">Informacje</p>
          <h2 className="mt-2 font-serif text-4xl text-foreground">Aktualności</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {weddingContent.news.map((item) => (
            <Card key={item.id} className="border-border/80 bg-card/90">
              <CardHeader>
                <p className="text-xs uppercase tracking-wider text-primary">{item.date}</p>
                <CardTitle className="text-xl">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

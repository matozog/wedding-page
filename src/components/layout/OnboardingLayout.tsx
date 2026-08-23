import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type OnboardingLayoutProps = {
  step: 1 | 2
  title: string
  subtitle: string
  children: ReactNode
}

export function OnboardingLayout({ step, title, subtitle, children }: OnboardingLayoutProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-[#faf7f2] via-background to-[#f3ebe0] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="mb-3 font-serif text-sm uppercase tracking-[0.35em] text-primary">
            Krok {step} z 2
          </p>
          <div className="mx-auto mb-6 flex w-48 items-center gap-2">
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                step >= 1 ? 'bg-primary' : 'bg-border'
              )}
            />
            <div
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                step >= 2 ? 'bg-primary' : 'bg-border'
              )}
            />
          </div>
          <h1 className="font-serif text-4xl text-foreground md:text-5xl">{title}</h1>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-lg backdrop-blur-sm md:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

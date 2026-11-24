import type { GuestStats as Stats, HeadCount } from '@/lib/guestList'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { ATTENDANCE_OPTIONS, JOINT_INVITER, NO_INVITER, type Attendance } from '@/types/guest'
import { ATTENDANCE_TONES } from './attendanceTones'
import { useInviterOptions } from './inviterOptionsContext'

type GuestStatsProps = {
  stats: Stats
  activeAttendance: Attendance | ''
  activeInviter: string
  onSelectAttendance: (value: Attendance | '') => void
  onSelectInviter: (value: string) => void
}

const describeChildren = (count: HeadCount) =>
  [
    count.CHILD > 0 && countPl(count.CHILD, 'dziecko', 'dzieci', 'dzieci'),
    count.INFANT > 0 && countPl(count.INFANT, 'niemowlę', 'niemowlęta', 'niemowląt'),
  ]
    .filter(Boolean)
    .join(', ')

const rowClass =
  '-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0'

const chipClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-sm'

// Licznik w jednej linii - liczy osoby (nie wiersze). Kliknięcie statusu
// filtruje listę; podział na dzieci / niemowlęta w podpowiedzi.
export function GuestStats({
  stats,
  activeAttendance,
  activeInviter,
  onSelectAttendance,
  onSelectInviter,
}: GuestStatsProps) {
  const inviters = useInviterOptions()
  const expectedChildren = describeChildren(stats.expected)
  const allChildren = describeChildren(stats.all)

  return (
    <div className="flex flex-col gap-2">
      {/* Wąski ekran: jedna linia przewijana w poziomie zamiast kilku wierszy chipów. */}
      <section
        aria-label="Licznik gości"
        className={rowClass}
      >
        {ATTENDANCE_OPTIONS.map(({ value, label }) => {
          const count = stats.byAttendance[value]
          const children = describeChildren(count)
          const pressed = activeAttendance === value

          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              title={[
                children && `W tym ${children}.`,
                pressed ? 'Kliknij, aby pokazać wszystkich.' : `Pokaż tylko: ${label}.`,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectAttendance(pressed ? '' : value)}
              className={cn(
                chipClass,
                'transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pressed && 'border-primary ring-1 ring-primary'
              )}
            >
              <span className={cn('size-2 rounded-full', ATTENDANCE_TONES[value].dot)} aria-hidden="true" />
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold tabular-nums text-foreground">{count.total}</span>
            </button>
          )
        })}

        <span className={cn(chipClass, 'border-primary/50 bg-primary/5')} title="Pewna obecność + całkiem możliwe">
          <span className="text-muted-foreground">Spodziewani</span>
          <span className="font-semibold tabular-nums text-foreground">{stats.expected.total}</span>
          {expectedChildren && (
            <span className="text-xs text-muted-foreground">(w tym {expectedChildren})</span>
          )}
        </span>

        <span className={chipClass} title={allChildren ? `W tym ${allChildren}` : undefined}>
          <span className="text-muted-foreground">Wszyscy</span>
          <span className="font-semibold tabular-nums text-foreground">{stats.all.total}</span>
        </span>
      </section>

      {inviters.enabled && (
        <section aria-label="Od kogo" className={rowClass}>
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Od kogo</span>
          {[
            ...inviters.options.filter(({ value, count }) => value !== JOINT_INVITER || count > 0),
            { value: NO_INVITER, label: 'Bez przypisania', count: inviters.unassignedCount },
          ].map(({ value, label, count }) => {
            const pressed = activeInviter === value

            return (
              <button
                key={value}
                type="button"
                aria-pressed={pressed}
                title={pressed ? 'Kliknij, aby pokazać wszystkich.' : `Pokaż tylko: ${label}.`}
                onClick={() => onSelectInviter(pressed ? '' : value)}
                className={cn(
                  chipClass,
                  'transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  pressed && 'border-primary ring-1 ring-primary'
                )}
              >
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums text-foreground">{count}</span>
              </button>
            )
          })}
        </section>
      )}
    </div>
  )
}

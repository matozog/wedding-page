import type { GuestStats as Stats, HeadCount } from '@/lib/guestList'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import { ATTENDANCE_OPTIONS, type Attendance } from '@/types/guest'
import { ATTENDANCE_TONES } from './attendanceTones'

type GuestStatsProps = {
  stats: Stats
  activeAttendance: Attendance | ''
  onSelectAttendance: (value: Attendance | '') => void
}

const describeChildren = (count: HeadCount) => {
  const parts = [
    count.CHILD > 0 && countPl(count.CHILD, 'dziecko', 'dzieci', 'dzieci'),
    count.INFANT > 0 && countPl(count.INFANT, 'niemowlę', 'niemowlęta', 'niemowląt'),
  ].filter(Boolean)

  return parts.length > 0 ? `w tym ${parts.join(', ')}` : ' '
}

function Tile({
  label,
  count,
  dotClass,
  pressed,
  highlight,
  hint,
  onClick,
}: {
  label: string
  count: HeadCount
  dotClass?: string
  pressed?: boolean
  highlight?: boolean
  hint?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {dotClass && <span className={cn('size-2 rounded-full', dotClass)} aria-hidden="true" />}
        {label}
      </span>
      <span className="mt-1 text-2xl font-semibold leading-none tabular-nums text-foreground">{count.total}</span>
      <span className="mt-1 text-xs text-muted-foreground">{describeChildren(count)}</span>
    </>
  )

  const className = cn(
    'flex flex-col rounded-xl border bg-card p-3 text-left',
    highlight && 'border-primary/50 bg-primary/5'
  )

  if (!onClick) {
    return (
      <div className={className} title={hint}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      title={pressed ? 'Pokaż wszystkich' : `Pokaż tylko: ${label}`}
      className={cn(
        className,
        'transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed && 'border-primary ring-1 ring-primary'
      )}
    >
      {content}
    </button>
  )
}

// Liczy osoby (nie wiersze). Kliknięcie kafelka statusu filtruje tabelę.
export function GuestStats({ stats, activeAttendance, onSelectAttendance }: GuestStatsProps) {
  return (
    <section aria-label="Licznik gości" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {ATTENDANCE_OPTIONS.map(({ value, label }) => (
        <Tile
          key={value}
          label={label}
          count={stats.byAttendance[value]}
          dotClass={ATTENDANCE_TONES[value].dot}
          pressed={activeAttendance === value}
          onClick={() => onSelectAttendance(activeAttendance === value ? '' : value)}
        />
      ))}
      <Tile
        label="Spodziewani"
        count={stats.expected}
        hint="Pewna obecność + całkiem możliwe"
        highlight
      />
      <Tile label="Wszyscy na liście" count={stats.all} />
    </section>
  )
}

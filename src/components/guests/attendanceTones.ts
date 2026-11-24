import type { Attendance } from '@/types/guest'

// Kolory statusów obecności (znacznik w tabeli, kafelki licznika).
export const ATTENDANCE_TONES: Record<Attendance, { badge: string; dot: string }> = {
  CONFIRMED: { badge: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-600' },
  LIKELY: { badge: 'bg-lime-100 text-lime-900', dot: 'bg-lime-600' },
  UNLIKELY: { badge: 'bg-amber-100 text-amber-900', dot: 'bg-amber-600' },
  DECLINED: { badge: 'bg-rose-100 text-rose-900', dot: 'bg-rose-600' },
  UNKNOWN: { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/60' },
}

import { cn } from '@/lib/utils'
import { ATTENDANCE_LABELS, type Attendance } from '@/types/guest'
import { ATTENDANCE_TONES } from './attendanceTones'

export function AttendanceBadge({ value, className }: { value: Attendance; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        ATTENDANCE_TONES[value].badge,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', ATTENDANCE_TONES[value].dot)} aria-hidden="true" />
      {ATTENDANCE_LABELS[value]}
    </span>
  )
}

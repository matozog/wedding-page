import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Search, UserPlus, X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  EMPTY_FILTERS,
  SORT_LABELS,
  type GuestFilters,
  type GuestSort,
  type GuestSortKey,
} from '@/lib/guestList'
import { cn } from '@/lib/utils'
import { ATTENDANCE_OPTIONS, NO_INVITER, type Attendance } from '@/types/guest'
import { useInviterOptions } from './inviterOptionsContext'

export function GuestSearch({
  value,
  className,
  onChange,
}: {
  value: string
  className?: string
  onChange: (value: string) => void
}) {
  const id = useId()

  return (
    <div className={cn('relative min-w-0', className)}>
      <label htmlFor={id} className="sr-only">
        Szukaj gościa
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        placeholder="Szukaj: imię, nazwisko, telefon, grupa…"
        className="pl-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

type GuestToolbarProps = {
  filters: GuestFilters
  groupView: boolean
  // Bez żadnej grupy przełącznik widoku grup nie ma sensu.
  hasGroups: boolean
  sort: GuestSort
  // Desktop: wszystko w jednej linii razem z wyszukiwarką. Wąski ekran:
  // wyszukiwarka osobno (przyklejona), sortowanie z listy (brak nagłówków).
  compact: boolean
  canEdit: boolean
  shownCount: number
  totalCount: number
  onFiltersChange: (filters: GuestFilters) => void
  onGroupViewChange: (value: boolean) => void
  onSortChange: (sort: GuestSort) => void
  onCollapseAll: () => void
  onExpandAll: () => void
  onAddGuest: () => void
  onAddGroup: () => void
}

export function GuestToolbar({
  filters,
  groupView,
  hasGroups,
  sort,
  compact,
  canEdit,
  shownCount,
  totalCount,
  onFiltersChange,
  onGroupViewChange,
  onSortChange,
  onCollapseAll,
  onExpandAll,
  onAddGuest,
  onAddGroup,
}: GuestToolbarProps) {
  const id = useId()
  const inviters = useInviterOptions()
  const hasFilters = filters.search !== '' || filters.attendance !== '' || filters.inviter !== ''
  const selectWidth = compact ? 'w-[calc(50%-0.25rem)]' : 'w-44'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <GuestSearch
          value={filters.search}
          className="flex-[1_1_16rem]"
          onChange={(search) => onFiltersChange({ ...filters, search })}
        />
      )}

      <div className={selectWidth}>
        <label htmlFor={`${id}-attendance`} className="sr-only">
          Filtr obecności
        </label>
        <NativeSelect
          id={`${id}-attendance`}
          value={filters.attendance}
          onChange={(event) =>
            onFiltersChange({ ...filters, attendance: event.target.value as Attendance | '' })
          }
        >
          <option value="">Każda obecność</option>
          {ATTENDANCE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {inviters.enabled && (
        <div className={selectWidth}>
          <label htmlFor={`${id}-inviter`} className="sr-only">
            Filtr: od kogo
          </label>
          <NativeSelect
            id={`${id}-inviter`}
            value={filters.inviter}
            onChange={(event) => onFiltersChange({ ...filters, inviter: event.target.value })}
          >
            <option value="">Od wszystkich</option>
            {inviters.options.map(({ value, label }) => (
              <option key={value} value={value}>
                Od: {label}
              </option>
            ))}
            <option value={NO_INVITER}>Bez przypisania</option>
          </NativeSelect>
        </div>
      )}

      {compact && (
        <div className={inviters.enabled ? 'w-full' : selectWidth}>
          <label htmlFor={`${id}-sort`} className="sr-only">
            Sortowanie
          </label>
          <NativeSelect
            id={`${id}-sort`}
            value={`${sort.key}:${sort.direction}`}
            onChange={(event) => {
              const [key, direction] = event.target.value.split(':') as [
                GuestSortKey,
                GuestSort['direction'],
              ]
              onSortChange({ key, direction })
            }}
          >
            {(Object.keys(SORT_LABELS) as GuestSortKey[])
              .filter((key) => (key !== 'inviter' || inviters.enabled) && (key !== 'group' || hasGroups))
              .flatMap((key) => [
                <option key={`${key}:asc`} value={`${key}:asc`}>
                  Sortuj: {SORT_LABELS[key]} ↑
                </option>,
                <option key={`${key}:desc`} value={`${key}:desc`}>
                  Sortuj: {SORT_LABELS[key]} ↓
                </option>,
              ])}
          </NativeSelect>
        </div>
      )}

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
          <X className="size-4" />
          Wyczyść
        </Button>
      )}

      {hasGroups && (
        <div className="flex items-center gap-2 px-1 text-sm">
          <button
            id={`${id}-group-view`}
            type="button"
            role="switch"
            aria-checked={groupView}
            aria-labelledby={`${id}-group-view-label`}
            onClick={() => onGroupViewChange(!groupView)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              groupView ? 'bg-primary' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'block size-5 rounded-full bg-background shadow transition-transform',
                groupView ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
          <label
            id={`${id}-group-view-label`}
            htmlFor={`${id}-group-view`}
            className="cursor-pointer whitespace-nowrap"
          >
            Widok grup
          </label>
        </div>
      )}

      {groupView && hasGroups && (
        <div className="flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Rozwiń wszystkie grupy"
            title="Rozwiń wszystkie grupy"
            onClick={onExpandAll}
          >
            <ChevronsUpDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Zwiń wszystkie grupy"
            title="Zwiń wszystkie grupy"
            onClick={onCollapseAll}
          >
            <ChevronsDownUp className="size-4" />
          </Button>
        </div>
      )}

      <p className="whitespace-nowrap px-1 text-sm text-muted-foreground" aria-live="polite">
        {hasFilters ? `${shownCount} z ${totalCount}` : `${totalCount} na liście`}
      </p>

      {canEdit && (
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onAddGroup}>
            <FolderPlus className="size-4" />
            Dodaj grupę
          </Button>
          <Button type="button" className="flex-1 sm:flex-none" onClick={onAddGuest}>
            <UserPlus className="size-4" />
            Dodaj gościa
          </Button>
        </div>
      )}
    </div>
  )
}

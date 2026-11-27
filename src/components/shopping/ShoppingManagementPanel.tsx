import { ArrowDown, ArrowUp, ArrowUpDown, EyeOff, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useShoppingSummary } from '@/hooks/useShoppingSummary'
import { describeShoppingError } from '@/lib/shoppingApi'
import { countPl } from '@/lib/plural'
import { cn } from '@/lib/utils'
import type { ShoppingItem } from '@/types/shopping'
import { ShoppingItemActions, ShoppingItemCard } from './ShoppingItemCard'
import { ShoppingItemDialogs } from './ShoppingItemDialogs'
import { ShoppingItemForm } from './ShoppingItemForm'
import { ShoppingRefreshError } from './ShoppingRefreshError'
import { formatQuantity, personName } from './shoppingFormat'
import { useShoppingActions } from './useShoppingActions'

type ShoppingManagementPanelProps = {
  eventId: string
  userId: string | null
}

type AssignFilter = 'all' | 'free' | 'taken'
type SortKey = 'name' | 'quantity' | 'author' | 'assignee' | 'createdAt'
type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const collator = new Intl.Collator('pl', { sensitivity: 'base' })
const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const compare = (a: ShoppingItem, b: ShoppingItem, key: SortKey) => {
  switch (key) {
    case 'name':
      return collator.compare(a.name, b.name)
    case 'quantity':
      return (a.quantity ?? 0) - (b.quantity ?? 0)
    case 'author':
      return collator.compare(personName(a.author), personName(b.author))
    case 'assignee':
      // wolne pozycje na początku
      return (a.assignee ? 1 : 0) - (b.assignee ? 1 : 0) || collator.compare(personName(a.assignee), personName(b.assignee))
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt)
  }
}

// Panel organizatora (ADMIN / EDITOR): wszystkie pozycje i pola, filtry,
// sortowanie, zestawienie osób. Te same uprawnienia co na stronie.
export function ShoppingManagementPanel({ eventId, userId }: ShoppingManagementPanelProps) {
  const id = useId()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const list = useShoppingList(eventId)
  const { summary } = useShoppingSummary(eventId, true)
  const actions = useShoppingActions()
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all')
  const [personFilter, setPersonFilter] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', dir: 'asc' })
  const { items, settings } = list

  const people = useMemo(() => {
    const byId = new Map<string, { name: string; items: ShoppingItem[] }>()

    for (const item of items) {
      if (!item.assignee) continue
      const entry = byId.get(item.assignee.id) ?? { name: personName(item.assignee), items: [] }
      entry.items.push(item)
      byId.set(item.assignee.id, entry)
    }

    return [...byId.entries()]
      .map(([personId, entry]) => ({ id: personId, ...entry }))
      .sort((a, b) => collator.compare(a.name, b.name))
  }, [items])

  const freeCount = items.filter((item) => item.assignee === null).length
  // Osoba mogła zrezygnować z ostatniej pozycji i zniknąć z listy wyboru -
  // wtedy filtr przestaje działać zamiast ukrywać wszystko.
  const activePersonFilter = people.some((person) => person.id === personFilter) ? personFilter : ''

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl')
    const filtered = items.filter((item) => {
      if (assignFilter === 'free' && item.assignee) return false
      if (assignFilter === 'taken' && !item.assignee) return false
      if (activePersonFilter && item.assignee?.id !== activePersonFilter) return false
      if (!query) return true
      return (
        item.name.toLocaleLowerCase('pl').includes(query) || (item.note?.toLocaleLowerCase('pl').includes(query) ?? false)
      )
    })
    const direction = sort.dir === 'asc' ? 1 : -1
    return filtered.sort((a, b) => compare(a, b, sort.key) * direction)
  }, [items, search, assignFilter, activePersonFilter, sort])

  const toggleSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const hiddenLabel = (shown: boolean) =>
    shown ? null : <span className="ml-1 normal-case tracking-normal text-muted-foreground/80">(ukryte na stronie)</span>

  const sortHead = (key: SortKey, label: string, extra?: ReactNode) => {
    const active = sort.key === key
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown

    return (
      <TableHead aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => toggleSort(key)}
        >
          {label}
          <Icon className={cn('size-3.5', !active && 'opacity-50')} aria-hidden="true" />
        </button>
        {extra}
      </TableHead>
    )
  }

  const itemActions = (item: ShoppingItem) => ({
    item,
    settings,
    userId,
    isOrganizer: true,
    pending: actions.pendingId === item.id,
    onAssign: () => void actions.run(item.id, () => list.assign(item.id), 'Nie udało się przypisać.'),
    onUnassign: () => void actions.run(item.id, () => list.unassign(item.id), 'Nie udało się zwolnić przypisania.'),
    onEdit: () => actions.setEditing(item),
    onDelete: () => actions.setDeleting(item),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Lista zakupów</h1>
          {list.loaded && (
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {countPl(items.length, 'pozycja', 'pozycje', 'pozycji')} · {freeCount} bez osoby
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={list.reload} aria-label="Odśwież listę" title="Odśwież listę">
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Odśwież</span>
          </Button>
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Dodaj pozycję
          </Button>
        </div>
      </div>

      {summary && !summary.sectionVisible && (
        <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm text-muted-foreground" role="note">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Sekcja jest ukryta na stronie wydarzenia - goście jej nie widzą. Możesz przygotować listę wcześniej; włącza ją
            super admin w konfiguracji wydarzenia.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_14rem]">
        <div className="relative">
          <Label htmlFor={`${id}-search`} className="sr-only">
            Szukaj
          </Label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={`${id}-search`}
            type="search"
            placeholder="Szukaj po nazwie lub opisie"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-assign`} className="sr-only">
            Przypisanie
          </Label>
          <NativeSelect id={`${id}-assign`} value={assignFilter} onChange={(e) => setAssignFilter(e.target.value as AssignFilter)}>
            <option value="all">Wszystkie</option>
            <option value="free">Bez osoby</option>
            <option value="taken">Z osobą</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor={`${id}-person`} className="sr-only">
            Osoba
          </Label>
          <NativeSelect id={`${id}-person`} value={activePersonFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">Każda osoba</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {list.failed && items.length > 0 && <ShoppingRefreshError onRetry={list.reload} />}

      {actions.error && (
        <div role="alert">
          <ErrorMessage message={actions.error} />
        </div>
      )}

      {list.failed && items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10" role="alert">
          <ErrorMessage message="Nie udało się wczytać listy." />
          <Button type="button" variant="outline" onClick={list.reload}>
            Spróbuj ponownie
          </Button>
        </div>
      ) : list.loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Wczytywanie listy…
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Lista jest pusta. Dodaj pierwszą pozycję.</p>
      ) : visibleItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Brak pozycji spełniających filtry.</p>
      ) : isDesktop ? (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {sortHead('name', 'Nazwa')}
                {sortHead('quantity', 'Ilość', hiddenLabel(settings.showQuantity))}
                <TableHead>
                  Opis
                  {hiddenLabel(settings.showNote)}
                </TableHead>
                {sortHead('author', 'Dodał(a)', hiddenLabel(settings.showAuthor))}
                {sortHead('assignee', 'Zajmuje się', hiddenLabel(settings.allowAssign))}
                {sortHead('createdAt', 'Dodano')}
                <TableHead>
                  <span className="sr-only">Akcje</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-56 break-words font-medium text-foreground">{item.name}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatQuantity(item) ?? '-'}</TableCell>
                  <TableCell className="max-w-72 whitespace-pre-line break-words text-muted-foreground">
                    {item.note ?? '-'}
                  </TableCell>
                  <TableCell>{personName(item.author)}</TableCell>
                  <TableCell>
                    {item.assignee ? personName(item.assignee) : <span className="text-muted-foreground">nikt</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {dateFormat.format(new Date(item.createdAt))}
                  </TableCell>
                  <TableCell>
                    <ShoppingItemActions className="justify-end" {...itemActions(item)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleItems.map((item) => (
            <ShoppingItemCard key={item.id} showAllFields {...itemActions(item)} />
          ))}
        </ul>
      )}

      {people.length > 0 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer rounded-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Kto czym się zajmuje ({people.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {people.map((person) => (
              <li key={person.id} className="text-sm">
                <p className="font-medium text-foreground">
                  {person.name} <span className="font-normal text-muted-foreground">· {person.items.length}</span>
                </p>
                <p className="text-muted-foreground">
                  {person.items.map((item) => [item.name, formatQuantity(item)].filter(Boolean).join(' ')).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj pozycję</DialogTitle>
            <DialogDescription>Pozycja pojawi się na liście na stronie wydarzenia.</DialogDescription>
          </DialogHeader>
          <ShoppingItemForm
            className="mt-4"
            settings={settings}
            showAssignToMe={settings.allowAssign}
            submitLabel="Dodaj"
            describeError={(err) => describeShoppingError(err, 'Nie udało się dodać pozycji.')}
            onCancel={() => setAdding(false)}
            onSubmit={async (input, assignToMe) => {
              await list.add(input, assignToMe ? userId : null)
              setAdding(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <ShoppingItemDialogs
        settings={settings}
        editing={actions.editing}
        deleting={actions.deleting}
        onEditingChange={actions.setEditing}
        onDeletingChange={actions.setDeleting}
        onUpdate={list.update}
        onDelete={(item) => list.remove(item.id)}
      />
    </div>
  )
}

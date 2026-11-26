import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ShoppingItemCard } from '@/components/shopping/ShoppingItemCard'
import { ShoppingItemDialogs } from '@/components/shopping/ShoppingItemDialogs'
import { ShoppingItemForm } from '@/components/shopping/ShoppingItemForm'
import { ShoppingRefreshError } from '@/components/shopping/ShoppingRefreshError'
import { useShoppingActions } from '@/components/shopping/useShoppingActions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SECTION_IDS } from '@/config/navigation'
import { useShoppingList } from '@/hooks/useShoppingList'
import { describeShoppingError } from '@/lib/shoppingApi'
import { countPl } from '@/lib/plural'
import type { SectionHeader } from '@/types/eventPage'
import { SectionHeading } from './SectionHeading'

type ShoppingListSectionProps = {
  eventId: string
  header: SectionHeader
  emptyText: string | null
  userId: string | null
  isOrganizer: boolean
  // Zmiana (np. nowy pseudonim) odświeża listę.
  refreshKey?: unknown
}

// Lista zakupów na stronie wydarzenia - każdy uczestnik dodaje pozycje
// i deklaruje, czym się zajmie.
export function ShoppingListSection({
  eventId,
  header,
  emptyText,
  userId,
  isOrganizer,
  refreshKey,
}: ShoppingListSectionProps) {
  const list = useShoppingList(eventId, refreshKey)
  const actions = useShoppingActions()
  const [onlyFree, setOnlyFree] = useState(false)
  const { settings, items } = list

  const freeCount = useMemo(() => items.filter((item) => item.assignee === null).length, [items])
  const visibleItems = useMemo(
    () => (onlyFree && settings.allowAssign ? items.filter((item) => item.assignee === null) : items),
    [items, onlyFree, settings.allowAssign]
  )

  return (
    <section id={SECTION_IDS.shopping} className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading {...header} />

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Card className="border-border/80 bg-card/80">
          <CardContent className="pt-6">
            <ShoppingItemForm
              settings={settings}
              showAssignToMe={settings.allowAssign}
              submitLabel="Dodaj do listy"
              describeError={(err) => describeShoppingError(err, 'Nie udało się dodać pozycji.')}
              onSubmit={(input, assignToMe) => list.add(input, assignToMe ? userId : null)}
            />
          </CardContent>
        </Card>

        {list.failed && items.length === 0 ? (
          <div className="flex flex-col items-center gap-4" role="alert">
            <ErrorMessage message="Nie udało się wczytać listy." />
            <Button type="button" variant="outline" onClick={list.reload}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : list.loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            Wczytywanie listy…
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText ?? 'Lista jest pusta.'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p aria-live="polite">
                {countPl(items.length, 'pozycja', 'pozycje', 'pozycji')}
                {settings.allowAssign && ` · ${freeCount} bez osoby`}
              </p>
              {settings.allowAssign && (
                <label className="flex items-center gap-2 text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={onlyFree}
                    onChange={(e) => setOnlyFree(e.target.checked)}
                  />
                  Tylko wolne
                </label>
              )}
            </div>

            {list.failed && <ShoppingRefreshError onRetry={list.reload} />}

            {actions.error && (
              <div role="alert">
                <ErrorMessage message={actions.error} />
              </div>
            )}

            {visibleItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Wszystkim ktoś już się zajmuje.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visibleItems.map((item) => (
                  <ShoppingItemCard
                    key={item.id}
                    item={item}
                    settings={settings}
                    userId={userId}
                    isOrganizer={isOrganizer}
                    pending={actions.pendingId === item.id}
                    onAssign={() => void actions.run(item.id, () => list.assign(item.id), 'Nie udało się przypisać.')}
                    onUnassign={() =>
                      void actions.run(item.id, () => list.unassign(item.id), 'Nie udało się zrezygnować.')
                    }
                    onEdit={() => actions.setEditing(item)}
                    onDelete={() => actions.setDeleting(item)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <ShoppingItemDialogs
        settings={settings}
        editing={actions.editing}
        deleting={actions.deleting}
        onEditingChange={actions.setEditing}
        onDeletingChange={actions.setDeleting}
        onUpdate={list.update}
        onDelete={(item) => list.remove(item.id)}
      />
    </section>
  )
}

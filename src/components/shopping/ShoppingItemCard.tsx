import { Check, Hand, Pencil, Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ShoppingItem, ShoppingSettings } from '@/types/shopping'
import { canEditShoppingItem, formatQuantity, personName } from './shoppingFormat'

type ShoppingItemCardProps = {
  item: ShoppingItem
  settings: ShoppingSettings
  userId: string | null
  // ADMIN / EDITOR / super admin - edytuje wszystko, zwalnia przypisania.
  isOrganizer: boolean
  // Panel organizatora - wszystkie pola niezależnie od ustawień strony.
  showAllFields?: boolean
  pending: boolean
  onAssign: () => void
  onUnassign: () => void
  onEdit: () => void
  onDelete: () => void
}

// Jedna pozycja listy zakupów: nazwa, ilość, opis, autor, kto się zajmuje.
export function ShoppingItemCard({
  item,
  settings,
  userId,
  isOrganizer,
  showAllFields = false,
  pending,
  onAssign,
  onUnassign,
  onEdit,
  onDelete,
}: ShoppingItemCardProps) {
  const quantity = showAllFields || settings.showQuantity ? formatQuantity(item) : null
  const note = showAllFields || settings.showNote ? item.note : null
  const showAuthor = showAllFields || settings.showAuthor
  const mine = userId !== null && item.assignee?.id === userId
  // Przypisanie widać, gdy jest włączone (i zawsze w panelu organizatora).
  // Po wyłączeniu osoba widzi tylko własne wcześniejsze przypisanie, żeby
  // móc z niego zrezygnować.
  const showAssignment = settings.allowAssign || showAllFields || mine

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card/80 p-4 sm:flex-row sm:items-start',
        mine && 'border-primary/50'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium text-foreground">
          {item.name}
          {quantity && <span className="ml-2 text-sm font-normal text-muted-foreground">· {quantity}</span>}
        </p>
        {note && <p className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">{note}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {showAuthor && (
            <span>
              Dodał(a):{' '}
              <span className="font-medium text-foreground">
                {userId !== null && item.author?.id === userId ? 'Ty' : personName(item.author)}
              </span>
            </span>
          )}
          {showAssignment && (
            <span>
              {item.assignee ? (
                mine ? (
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    <Check className="size-3.5" aria-hidden="true" />
                    Zajmujesz się tym
                  </span>
                ) : (
                  <>
                    Zajmuje się: <span className="font-medium text-foreground">{personName(item.assignee)}</span>
                  </>
                )
              ) : (
                'Nikt się jeszcze tym nie zajął'
              )}
            </span>
          )}
        </div>
      </div>

      <ShoppingItemActions
        className="sm:justify-end"
        item={item}
        settings={settings}
        userId={userId}
        isOrganizer={isOrganizer}
        pending={pending}
        onAssign={onAssign}
        onUnassign={onUnassign}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </li>
  )
}

type ShoppingItemActionsProps = Omit<ShoppingItemCardProps, 'showAllFields'> & { className?: string }

// Przyciski pozycji: przypisanie, rezygnacja, zwolnienie (organizator),
// edycja i usuwanie (autor / organizator).
export function ShoppingItemActions({
  item,
  settings,
  userId,
  isOrganizer,
  pending,
  onAssign,
  onUnassign,
  onEdit,
  onDelete,
  className,
}: ShoppingItemActionsProps) {
  const mine = userId !== null && item.assignee?.id === userId
  const canEdit = canEditShoppingItem(item, userId, isOrganizer)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {settings.allowAssign && !item.assignee && (
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onAssign}
          aria-label={`Biorę to: ${item.name}`}
        >
          <Hand className="size-4" aria-hidden="true" />
          Biorę to
        </Button>
      )}
      {mine && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={onUnassign}
          aria-label={`Rezygnuję: ${item.name}`}
        >
          Rezygnuję
        </Button>
      )}
      {!mine && item.assignee && isOrganizer && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onUnassign}
          aria-label={`Zwolnij przypisanie: ${item.name}`}
          title="Zwolnij przypisanie"
        >
          <UserX className="size-4" aria-hidden="true" />
          <span className="sm:sr-only">Zwolnij</span>
        </Button>
      )}
      {canEdit && (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={pending}
            onClick={onEdit}
            aria-label={`Edytuj: ${item.name}`}
            title="Edytuj"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={onDelete}
            aria-label={`Usuń: ${item.name}`}
            title="Usuń"
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  )
}

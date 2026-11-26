import { getErrorCode } from '@/lib/eventApi'
import { describeShoppingError, STALE_ITEM_CODE } from '@/lib/shoppingApi'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ShoppingItem, ShoppingItemInput, ShoppingSettings } from '@/types/shopping'
import { ShoppingItemForm } from './ShoppingItemForm'

type ShoppingItemDialogsProps = {
  settings: ShoppingSettings
  showAllFields?: boolean
  editing: ShoppingItem | null
  deleting: ShoppingItem | null
  onEditingChange: (item: ShoppingItem | null) => void
  onDeletingChange: (item: ShoppingItem | null) => void
  // Rzucają błąd - okno zostaje otwarte z komunikatem.
  onUpdate: (item: ShoppingItem, input: ShoppingItemInput) => Promise<void>
  onDelete: (item: ShoppingItem) => Promise<void>
}

// Okna edycji i usuwania pozycji - wspólne dla strony i panelu.
export function ShoppingItemDialogs({
  settings,
  showAllFields = false,
  editing,
  deleting,
  onEditingChange,
  onDeletingChange,
  onUpdate,
  onDelete,
}: ShoppingItemDialogsProps) {
  return (
    <>
      <Dialog open={editing !== null} onOpenChange={(open) => !open && onEditingChange(null)}>
        <DialogContent className="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj pozycję</DialogTitle>
            <DialogDescription>Zmiany zobaczą wszyscy uczestnicy.</DialogDescription>
          </DialogHeader>
          {editing && (
            <ShoppingItemForm
              key={editing.id}
              className="mt-4"
              settings={settings}
              showAllFields={showAllFields}
              item={editing}
              submitLabel="Zapisz"
              describeError={(err) =>
                getErrorCode(err) === STALE_ITEM_CODE
                  ? 'Ktoś zmienił tę pozycję w międzyczasie (albo ją usunął). Lista jest już odświeżona - zamknij okno i otwórz edycję ponownie.'
                  : describeShoppingError(err, 'Nie udało się zapisać pozycji.')
              }
              onCancel={() => onEditingChange(null)}
              onSubmit={async (input) => {
                await onUpdate(editing, input)
                onEditingChange(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Usunąć pozycję?"
        description={deleting ? `„${deleting.name}” zniknie z listy dla wszystkich.` : ''}
        confirmLabel="Usuń"
        destructive
        errorMessage="Nie udało się usunąć pozycji. Odśwież listę i spróbuj ponownie."
        onOpenChange={(open) => !open && onDeletingChange(null)}
        onConfirm={async () => {
          if (deleting) await onDelete(deleting)
        }}
      />
    </>
  )
}

import type { ShoppingItem, ShoppingPerson } from '@/types/shopping'

// Nazwa osoby przy pozycji. Profil bez nazwy albo usunięte konto - "Gość".
export const personName = (person: ShoppingPerson | null) => person?.displayName?.trim() || 'Gość'

// "2 kg", "3" - null, gdy pozycja nie ma ilości.
export const formatQuantity = (item: Pick<ShoppingItem, 'quantity' | 'unit'>) =>
  item.quantity === null ? null : item.unit ? `${item.quantity} ${item.unit}` : String(item.quantity)

// Uprawnienia w UI odpowiadają polityce bazy: autor albo organizator
// (ADMIN / EDITOR, super admin ma w sesji rolę ADMIN). Baza i tak sprawdza.
export const canEditShoppingItem = (item: ShoppingItem, userId: string | null, isOrganizer: boolean) =>
  isOrganizer || (userId !== null && item.author?.id === userId)

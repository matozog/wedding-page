// Lista zakupów (sekcja "shopping") - rzeczy do kupienia lub przyniesienia.

// Pola widoczne na liście - ustawia super admin (event_shopping_settings).
export type ShoppingSettings = {
  showNote: boolean
  showQuantity: boolean
  showAuthor: boolean
  // Przypisywanie osób ("Biorę to"). Wyłączone - baza też odmawia.
  allowAssign: boolean
}

// Wartości domyślne - takie same jak w bazie.
export const DEFAULT_SHOPPING_SETTINGS: ShoppingSettings = {
  showNote: true,
  showQuantity: false,
  showAuthor: true,
  allowAssign: true,
}

export type ShoppingPerson = {
  id: string
  // null - osoba bez nazwy albo profil niewidoczny
  displayName: string | null
}

export type ShoppingItem = {
  id: string
  name: string
  note: string | null
  quantity: number | null
  unit: string | null
  createdAt: string
  // Wersja treści - wykrywanie równoczesnej edycji.
  updatedAt: string
  // null - konto autora zostało usunięte
  author: ShoppingPerson | null
  // null - nikt się jeszcze nie zajął
  assignee: ShoppingPerson | null
}

// Treść wpisu z formularza. Pominięte pole - bez zmian (np. ilość, gdy
// jest wyłączona w ustawieniach).
export type ShoppingItemInput = {
  name: string
  note?: string | null
  quantity?: number | null
  unit?: string | null
}

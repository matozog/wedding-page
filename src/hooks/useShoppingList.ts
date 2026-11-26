import { useCallback, useEffect, useState } from 'react'
import {
  addShoppingItem,
  assignShoppingItem,
  deleteShoppingItem,
  fetchShoppingItems,
  fetchShoppingSettings,
  unassignShoppingItem,
  updateShoppingItem,
} from '../lib/shoppingApi'
import { DEFAULT_SHOPPING_SETTINGS, type ShoppingItem, type ShoppingItemInput, type ShoppingSettings } from '../types/shopping'

type State = {
  eventId: string | null
  items: ShoppingItem[]
  settings: ShoppingSettings
  loaded: boolean
  failed: boolean
}

const EMPTY: State = { eventId: null, items: [], settings: DEFAULT_SHOPPING_SETTINGS, loaded: false, failed: false }

// Lista zakupów wydarzenia (strona i panel zarządzania). eventId null - nie
// pobieramy (sekcja wyłączona). Bez realtime - lista odświeża się po każdej
// zmianie i po powrocie do karty. refreshKey - zmiana wymusza pobranie
// (np. nowy pseudonim przy własnych wpisach).
// Akcje rzucają błędy - komunikat pokazuje wywołujący.
export function useShoppingList(eventId: string | null, refreshKey?: unknown) {
  const [state, setState] = useState<State>(EMPTY)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    Promise.all([fetchShoppingItems(eventId), fetchShoppingSettings(eventId)])
      .then(([items, settings]) => {
        if (!cancelled) setState({ eventId, items, settings, loaded: true, failed: false })
      })
      .catch((err: unknown) => {
        console.error('Shopping list error:', err)
        if (!cancelled) {
          setState((current) =>
            current.eventId === eventId ? { ...current, failed: true } : { ...EMPTY, eventId, failed: true }
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventId, attempt, refreshKey])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  // Powrót do karty - zmiany innych osób.
  useEffect(() => {
    if (!eventId) return

    const onVisibility = () => {
      if (document.visibilityState === 'visible') reload()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [eventId, reload])

  const replaceItem = useCallback((item: ShoppingItem) => {
    setState((current) => ({
      ...current,
      items: current.items.map((existing) => (existing.id === item.id ? item : existing)),
    }))
  }, [])

  // Zmiana nieudana z powodu cudzej zmiany - lista od razu się odświeża.
  const withReloadOnError = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action()
      } catch (err) {
        reload()
        throw err
      }
    },
    [reload]
  )

  const add = useCallback(
    async (input: ShoppingItemInput, assignTo: string | null) => {
      const id = eventId
      if (!id) return

      const item = await addShoppingItem(id, input, assignTo)
      setState((current) => (current.eventId === id ? { ...current, items: [...current.items, item] } : current))
      // Odświeżenie trwające w chwili dodawania przyniosłoby listę bez nowej
      // pozycji - nowe pobranie anuluje je i jest ostatnim słowem.
      reload()
    },
    [eventId, reload]
  )

  const update = useCallback(
    (item: ShoppingItem, input: ShoppingItemInput) =>
      withReloadOnError(async () => replaceItem(await updateShoppingItem(item.id, input, item.updatedAt))),
    [replaceItem, withReloadOnError]
  )

  const remove = useCallback(
    (itemId: string) =>
      withReloadOnError(async () => {
        await deleteShoppingItem(itemId)
        setState((current) => ({ ...current, items: current.items.filter((item) => item.id !== itemId) }))
      }),
    [withReloadOnError]
  )

  // Przypisanie zmienia też nazwę osoby - pobieramy całą listę.
  const assign = useCallback(
    (itemId: string) =>
      withReloadOnError(async () => {
        await assignShoppingItem(itemId)
        reload()
      }),
    [reload, withReloadOnError]
  )

  const unassign = useCallback(
    (itemId: string) =>
      withReloadOnError(async () => {
        await unassignShoppingItem(itemId)
        reload()
      }),
    [reload, withReloadOnError]
  )

  const current = state.eventId === eventId ? state : EMPTY

  return {
    items: current.items,
    settings: current.settings,
    loaded: current.loaded,
    loading: Boolean(eventId) && !current.loaded && !current.failed,
    failed: current.failed,
    reload,
    add,
    update,
    remove,
    assign,
    unassign,
  }
}

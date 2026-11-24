import { useCallback, useEffect, useState } from 'react'
import {
  deleteGuest,
  deleteGuestGroup,
  fetchGuestList,
  insertGuest,
  insertGuestGroup,
  updateGuest,
  updateGuestGroup,
} from '../lib/guestsApi'
import type { Guest, GuestGroup, GuestGroupInput, GuestInput } from '../types/guest'

// Lista gości i grup wydarzenia. Zapis aktualizuje stan lokalny wierszem
// zwróconym przez bazę (bez ponownego pobierania całej listy). Błędy zapisu
// są rzucane dalej - obsługuje je formularz / okno, w którym zaszły.
export function useGuests(eventId: string | null) {
  const [guests, setGuests] = useState<Guest[]>([])
  const [groups, setGroups] = useState<GuestGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!eventId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await fetchGuestList(eventId)
      setGuests(data.guests)
      setGroups(data.groups)
    } catch (err) {
      console.error('Guest list error:', err)
      setError('Nie udało się pobrać listy gości.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const requireEventId = useCallback(() => {
    if (!eventId) {
      throw new Error('Brak wydarzenia.')
    }
    return eventId
  }, [eventId])

  const addGuest = useCallback(
    async (input: GuestInput) => {
      const guest = await insertGuest(requireEventId(), input)
      setGuests((current) => [...current, guest])
      return guest
    },
    [requireEventId]
  )

  const editGuest = useCallback(async (id: string, input: GuestInput) => {
    const guest = await updateGuest(id, input)
    setGuests((current) => current.map((item) => (item.id === id ? guest : item)))
    return guest
  }, [])

  const removeGuest = useCallback(async (id: string) => {
    await deleteGuest(id)
    setGuests((current) => current.filter((item) => item.id !== id))
  }, [])

  const addGroup = useCallback(
    async (input: GuestGroupInput) => {
      const group = await insertGuestGroup(requireEventId(), input)
      setGroups((current) => [...current, group])
      return group
    },
    [requireEventId]
  )

  const editGroup = useCallback(async (id: string, input: GuestGroupInput) => {
    const group = await updateGuestGroup(id, input)
    setGroups((current) => current.map((item) => (item.id === id ? group : item)))
    return group
  }, [])

  const removeGroup = useCallback(async (id: string, withGuests: boolean) => {
    await deleteGuestGroup(id, withGuests)
    setGroups((current) => current.filter((item) => item.id !== id))
    setGuests((current) =>
      withGuests
        ? current.filter((item) => item.group_id !== id)
        : current.map((item) => (item.group_id === id ? { ...item, group_id: null } : item))
    )
  }, [])

  return {
    guests,
    groups,
    loading,
    error,
    reload: load,
    addGuest,
    editGuest,
    removeGuest,
    addGroup,
    editGroup,
    removeGroup,
  }
}

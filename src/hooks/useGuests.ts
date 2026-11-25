import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteGuest,
  deleteGuestGroup,
  fetchGroupMembers,
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
  // Numer ostatniego pobrania - odpowiedź starszego (np. dla poprzedniego
  // wydarzenia) nie nadpisuje stanu.
  const loadIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!eventId) {
      return
    }

    const loadId = ++loadIdRef.current
    setLoading(true)
    setError(null)

    try {
      const data = await fetchGuestList(eventId)
      if (loadId !== loadIdRef.current) return
      setGuests(data.guests)
      setGroups(data.groups)
    } catch (err) {
      if (loadId !== loadIdRef.current) return
      console.error('Guest list error:', err)
      setError('Nie udało się pobrać listy gości.')
    } finally {
      if (loadId === loadIdRef.current) setLoading(false)
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

  // Osoba przestała być zapraszającą albo zniknęła - baza zdjęła odwołania
  // do niej (goście i domyślne "od kogo" grup), lokalnie robimy to samo.
  const releaseInviter = useCallback((id: string) => {
    setGuests((current) =>
      current.map((item) =>
        item.invited_by_guest_id === id ? { ...item, invited_by_guest_id: null } : item
      )
    )
    setGroups((current) =>
      current.map((item) =>
        item.default_inviter_id === id ? { ...item, default_inviter_id: null } : item
      )
    )
  }, [])

  const editGuest = useCallback(
    async (id: string, input: GuestInput) => {
      const guest = await updateGuest(id, input)
      setGuests((current) => current.map((item) => (item.id === id ? guest : item)))
      if (!guest.is_inviter) releaseInviter(id)
      return guest
    },
    [releaseInviter]
  )

  const removeGuest = useCallback(
    async (id: string) => {
      await deleteGuest(id)
      setGuests((current) => current.filter((item) => item.id !== id))
      releaseInviter(id)
    },
    [releaseInviter]
  )

  const addGroup = useCallback(
    async (input: GuestGroupInput) => {
      const group = await insertGuestGroup(requireEventId(), input)
      setGroups((current) => [...current, group])
      return group
    },
    [requireEventId]
  )

  // applyToMembers: "od kogo" grupy trafia też do osób, które już w niej są
  // (baza robi to w tej samej transakcji co zapis grupy).
  const editGroup = useCallback(
    async (id: string, input: GuestGroupInput, applyToMembers = false) => {
      const group = await updateGuestGroup(id, input, applyToMembers)
      setGroups((current) => current.map((item) => (item.id === id ? group : item)))

      if (applyToMembers) {
        // Zapis już się udał - nieudany odczyt osób nie jest błędem zapisu,
        // wtedy po prostu pobieramy całą listę od nowa.
        try {
          const members = await fetchGroupMembers(id)
          const byId = new Map(members.map((guest) => [guest.id, guest]))
          setGuests((current) => current.map((item) => byId.get(item.id) ?? item))
        } catch (err) {
          console.error('Group members refresh error:', err)
          void load()
        }
      }

      return group
    },
    [load]
  )

  // Usunięte razem z grupą osoby zapraszające - baza zdjęła odwołania do
  // nich (FK on delete set null), lokalnie robimy to samo.
  const removeGroup = useCallback(
    async (id: string, withGuests: boolean) => {
      const removedInviters = withGuests
        ? guests.filter((item) => item.group_id === id && item.is_inviter).map((item) => item.id)
        : []

      await deleteGuestGroup(id, withGuests)
      setGroups((current) => current.filter((item) => item.id !== id))
      setGuests((current) =>
        withGuests
          ? current.filter((item) => item.group_id !== id)
          : current.map((item) => (item.group_id === id ? { ...item, group_id: null } : item))
      )
      removedInviters.forEach(releaseInviter)
    },
    [guests, releaseInviter]
  )

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

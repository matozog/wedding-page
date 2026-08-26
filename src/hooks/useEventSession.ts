import { useCallback, useState } from 'react'
import { joinEvent, setNickname as saveNicknameApi } from '../lib/eventApi'
import { SESSION_STORAGE_KEY } from '../lib/constants'
import type { EventSession } from '../types/event'

type StoredSession = {
  session: EventSession
  nickname: string
  hasNickname: boolean
}

const loadStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

const saveStoredSession = (value: StoredSession | null) => {
  try {
    if (value) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // localStorage niedostępny (np. prywatna karta) - sesja nie zostanie zapamiętana
  }
}

export function useEventSession() {
  const stored = loadStoredSession()

  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState(stored?.nickname ?? '')
  const [session, setSession] = useState<EventSession | null>(stored?.session ?? null)
  const [hasNickname, setHasNickname] = useState(stored?.hasNickname ?? false)
  const [error, setError] = useState<string | null>(null)

  const checkCode = useCallback(async () => {
    setError(null)

    try {
      const event = await joinEvent(code)

      if (!event) {
        setError('Nieprawidłowy kod.')
        return
      }

      setSession(event)
      saveStoredSession({ session: event, nickname: '', hasNickname: false })
    } catch (err) {
      console.error(err)
      setError('Wystąpił błąd.')
    }
  }, [code])

  const saveNickname = useCallback(async () => {
    const value = nickname.trim()

    if (!value) {
      setError('Wpisz pseudonim.')
      return false
    }

    setError(null)

    try {
      const { error: apiError } = await saveNicknameApi(value)

      if (apiError) {
        throw apiError
      }

      setHasNickname(true)

      if (session) {
        saveStoredSession({ session, nickname: value, hasNickname: true })
      }

      return true
    } catch (err) {
      console.error(err)
      setError('Nie udało się zapisać pseudonimu.')
      return false
    }
  }, [nickname, session])

  const logout = useCallback(() => {
    saveStoredSession(null)
    setCode('')
    setNickname('')
    setSession(null)
    setHasNickname(false)
    setError(null)
  }, [])

  return {
    code,
    setCode,
    nickname,
    setNickname,
    session,
    hasNickname,
    error,
    setError,
    checkCode,
    saveNickname,
    logout,
  }
}

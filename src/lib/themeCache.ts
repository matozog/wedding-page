import { isThemeKey, type ThemeKey } from '../config/themes'

// Ostatni znany motyw wydarzenia - ustawiany od razu, zanim przyjdzie
// konfiguracja z bazy (bez mignięcia kolorów domyślnych).
const key = (eventId: string) => `wedding-page:theme:${eventId}`

export const readCachedTheme = (eventId: string): ThemeKey | null => {
  try {
    const value = localStorage.getItem(key(eventId))
    return isThemeKey(value) ? value : null
  } catch {
    return null
  }
}

export const writeCachedTheme = (eventId: string, theme: ThemeKey) => {
  try {
    localStorage.setItem(key(eventId), theme)
  } catch {
    // Storage niedostępny (np. prywatna karta) - motyw przyjdzie z bazy.
  }
}

import { isThemeKey, toAppTheme, type AppTheme } from '../config/themes'

// Ostatni znany motyw wydarzenia (albo ekranu startowego) - ustawiany od
// razu, zanim przyjdzie konfiguracja z bazy (bez mignięcia kolorów domyślnych).
export const START_THEME_SCOPE = 'start'

const key = (scope: string) => `wedding-page:theme:${scope}`

// scope - id wydarzenia albo START_THEME_SCOPE.
export const readCachedTheme = (scope: string): AppTheme | null => {
  try {
    const value = localStorage.getItem(key(scope))
    if (!value) return null
    // Starszy zapis - sam klucz palety.
    if (isThemeKey(value)) return { key: value, colors: null }

    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { key: themeKey, colors } = parsed as Record<string, unknown>
    return isThemeKey(themeKey) ? toAppTheme(themeKey, colors) : null
  } catch {
    return null
  }
}

export const writeCachedTheme = (scope: string, theme: AppTheme) => {
  try {
    localStorage.setItem(key(scope), JSON.stringify(theme))
  } catch {
    // Storage niedostępny (np. prywatna karta) - motyw przyjdzie z bazy.
  }
}

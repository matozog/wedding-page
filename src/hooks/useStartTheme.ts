import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_APP_THEME, type AppTheme } from '../config/themes'
import { fetchStartTheme } from '../lib/appSettingsApi'
import { START_THEME_SCOPE, readCachedTheme, writeCachedTheme } from '../lib/themeCache'

// Motyw ekranu startowego: od razu ostatni zapamiętany, potem z bazy.
// Błąd odczytu nie blokuje ekranu - zostaje motyw zapamiętany / domyślny.
export function useStartTheme() {
  const [theme, setTheme] = useState<AppTheme>(() => readCachedTheme(START_THEME_SCOPE) ?? DEFAULT_APP_THEME)

  useEffect(() => {
    let active = true

    fetchStartTheme()
      .then((value) => {
        if (!active) return
        writeCachedTheme(START_THEME_SCOPE, value)
        setTheme(value)
      })
      .catch((err) => console.error('Start theme error:', err))

    return () => {
      active = false
    }
  }, [])

  // Po zapisie w panelu organizatora.
  const updateTheme = useCallback((value: AppTheme) => {
    writeCachedTheme(START_THEME_SCOPE, value)
    setTheme(value)
  }, [])

  return { theme, updateTheme }
}

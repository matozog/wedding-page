import { useLayoutEffect } from 'react'
import { themeSignature, type AppTheme } from '../config/themes'
import { THEME_VARIABLES, buildThemeVariables, isPaletteReady } from '../lib/themeColors'

// Ile klatek czekamy na arkusz CSS, zanim zostawimy kolory zastępcze.
const MAX_PALETTE_RETRIES = 60

// Motyw całej strony: paleta jako data-theme na <html>, własne kolory jako
// zmienne CSS w stylu inline (mają pierwszeństwo przed paletą).
// useLayoutEffect - motyw jest ustawiony przed narysowaniem strony.
export function useDocumentTheme(theme: AppTheme | null) {
  const signature = themeSignature(theme)

  useLayoutEffect(() => {
    const root = document.documentElement

    if (theme) {
      root.dataset.theme = theme.key
    } else {
      delete root.dataset.theme
    }

    const applyColors = () => {
      // Zmienne poprzedniego motywu z własnymi kolorami.
      for (const name of THEME_VARIABLES) root.style.removeProperty(name)

      const variables = theme ? buildThemeVariables(theme) : null
      if (variables) {
        for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value)
      }
    }

    applyColors()

    // Własne kolory wyliczane z palety, której arkusz CSS jeszcze się nie
    // wczytał - powtarzamy w kolejnych klatkach, aż kolory palety będą znane.
    if (!theme?.colors || isPaletteReady(theme.key)) return

    let frame = 0
    let retries = 0
    const retry = () => {
      if (isPaletteReady(theme.key)) {
        applyColors()
      } else if (++retries < MAX_PALETTE_RETRIES) {
        frame = requestAnimationFrame(retry)
      }
    }
    frame = requestAnimationFrame(retry)

    return () => cancelAnimationFrame(frame)
    // signature opisuje motyw w całości
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

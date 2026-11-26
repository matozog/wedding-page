import { useEffect, useState } from 'react'

// Kolory motywu dla canvasa (Konva nie czyta klas Tailwinda). Zmienne CSS
// mają postać "H S% L%" - zamieniamy je na hsl(). Odświeżane po zmianie
// motywu (atrybut data-theme i własne kolory w style na <html>).
export type ThemeColors = {
  background: string
  foreground: string
  card: string
  border: string
  muted: string
  mutedForeground: string
  primary: string
  primaryForeground: string
  secondary: string
}

const VARS: Record<keyof ThemeColors, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  border: '--border',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
}

const readColors = (): ThemeColors => {
  const style = getComputedStyle(document.documentElement)
  const entries = Object.entries(VARS).map(([key, name]) => {
    const parts = style.getPropertyValue(name).trim().split(/\s+/).filter(Boolean)
    return [key, parts.length === 3 ? `hsl(${parts.join(', ')})` : '#888888']
  })
  return Object.fromEntries(entries) as ThemeColors
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readColors)

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
    return () => observer.disconnect()
  }, [])

  return colors
}

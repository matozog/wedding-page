// Palety kolorów wydarzeń. Wartości kolorów są w src/index.css
// ([data-theme='...']), tutaj tylko lista do wyboru. Klucze muszą
// odpowiadać ograniczeniu events_theme_check w bazie.
export const THEMES = [
  { key: 'sand', label: 'Złoty piasek', tone: 'light' },
  { key: 'sage', label: 'Szałwia', tone: 'light' },
  { key: 'blush', label: 'Pudrowy róż', tone: 'light' },
  { key: 'navy', label: 'Granat i złoto', tone: 'light' },
  { key: 'lavender', label: 'Lawenda', tone: 'light' },
  { key: 'terracotta', label: 'Terakota', tone: 'light' },
  { key: 'midnight', label: 'Nocny granat', tone: 'dark' },
  { key: 'graphite', label: 'Grafit i złoto', tone: 'dark' },
  { key: 'forest', label: 'Butelkowa zieleń', tone: 'dark' },
  { key: 'wine', label: 'Bordo', tone: 'dark' },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

export const DEFAULT_THEME: ThemeKey = 'sand'

export const isThemeKey = (value: unknown): value is ThemeKey =>
  THEMES.some((theme) => theme.key === value)

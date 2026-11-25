// Palety kolorów wydarzeń. Wartości kolorów są w src/index.css
// ([data-theme='...']), tutaj tylko lista do wyboru. Klucze muszą
// odpowiadać ograniczeniu events_theme_check w bazie.
export const THEMES = [
  { key: 'sand', label: 'Złoty piasek' },
  { key: 'sage', label: 'Szałwia' },
  { key: 'blush', label: 'Pudrowy róż' },
  { key: 'navy', label: 'Granat i złoto' },
  { key: 'lavender', label: 'Lawenda' },
  { key: 'terracotta', label: 'Terakota' },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

export const DEFAULT_THEME: ThemeKey = 'sand'

export const isThemeKey = (value: unknown): value is ThemeKey =>
  THEMES.some((theme) => theme.key === value)

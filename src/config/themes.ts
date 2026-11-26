// Palety kolorów wydarzeń. Wartości kolorów są w src/index.css
// ([data-theme='...']), tutaj tylko lista do wyboru. Klucze muszą
// odpowiadać funkcji public.is_theme_key w bazie.
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

// Własne kolory - nadpisania palety. Pozostałe kolory (karty, obramowania,
// tekst na przyciskach...) są z nich wyliczane (src/lib/themeColors.ts).
// Klucze jak w public.is_theme_colors w bazie.
export const CUSTOM_COLORS = [
  { key: 'background', label: 'Tło' },
  { key: 'foreground', label: 'Tekst' },
  { key: 'primary', label: 'Kolor główny' },
  { key: 'secondary', label: 'Kolor drugorzędny' },
  { key: 'accent', label: 'Akcent' },
] as const

export type CustomColorKey = (typeof CUSTOM_COLORS)[number]['key']

// Wartości "#rrggbb". Brak klucza - kolor z palety.
export type CustomColors = Partial<Record<CustomColorKey, string>>

// Motyw: paleta i opcjonalne własne kolory (null - sama paleta).
export type AppTheme = {
  key: ThemeKey
  colors: CustomColors | null
}

export const DEFAULT_APP_THEME: AppTheme = { key: DEFAULT_THEME, colors: null }

const HEX_COLOR = /^#[0-9a-f]{6}$/

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX_COLOR.test(value)

// Kolory z bazy / localStorage - nieznane klucze i błędne wartości pomijamy.
export const parseCustomColors = (value: unknown): CustomColors | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  const colors: CustomColors = {}

  for (const { key } of CUSTOM_COLORS) {
    const color = typeof record[key] === 'string' ? (record[key] as string).toLowerCase() : null
    if (isHexColor(color)) colors[key] = color
  }

  return Object.keys(colors).length > 0 ? colors : null
}

export const toAppTheme = (key: unknown, colors: unknown): AppTheme => ({
  key: isThemeKey(key) ? key : DEFAULT_THEME,
  colors: parseCustomColors(colors),
})

// Klucz do porównań i zależności efektów (obiekt motywu bywa tworzony co render).
export const themeSignature = (theme: AppTheme | null) =>
  theme ? `${theme.key}|${CUSTOM_COLORS.map(({ key }) => theme.colors?.[key] ?? '').join(',')}` : ''

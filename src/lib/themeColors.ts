import type { CSSProperties } from 'react'
import { CUSTOM_COLORS, type AppTheme, type CustomColorKey, type ThemeKey } from '../config/themes'

// Wyliczanie zmiennych CSS motywu z własnych kolorów. Paleta (index.css)
// daje bazę, własne kolory ją nadpisują, a zmienne od nich zależne (karty,
// obramowania, tekst na przyciskach...) są wyliczane. Pozostałe zostają
// z palety. Zmienne mają postać "H S% L%" (patrz @theme w index.css).

type Hsl = { h: number; s: number; l: number }
type Rgb = { r: number; g: number; b: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value * 10) / 10

const hexToRgb = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
})

const rgbToHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((part) => Math.round(clamp(part, 0, 255)).toString(16).padStart(2, '0')).join('')}`

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l: l * 100 }

  const s = d / (1 - Math.abs(2 * l - 1))
  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60 : max === gn ? ((bn - rn) / d + 2) * 60 : ((rn - gn) / d + 4) * 60

  return { h, s: s * 100, l: l * 100 }
}

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 }
}

const hexToHsl = (hex: string) => rgbToHsl(hexToRgb(hex))
const hslToHex = (hsl: Hsl) => rgbToHex(hslToRgb(hsl))
const toTriplet = ({ h, s, l }: Hsl) => `${round(h)} ${round(s)}% ${round(l)}%`

// "H S% L%" -> "#rrggbb"; null dla pustej / błędnej wartości.
const tripletToHex = (value: string): string | null => {
  const match = value.trim().match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (!match) return null
  return hslToHex({ h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) })
}

// Względna luminancja i kontrast wg WCAG 2.x.
const luminance = (hex: string) => {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export const contrastRatio = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// Kolor przesunięty w stronę tekstu (jaśniejszy na ciemnym tle, ciemniejszy
// na jasnym), z opcjonalnie zmniejszonym nasyceniem.
const shift = (hex: string, amount: number, dark: boolean, saturation = 1) => {
  const hsl = hexToHsl(hex)
  return hslToHex({ h: hsl.h, s: clamp(hsl.s * saturation, 0, 100), l: clamp(hsl.l + (dark ? amount : -amount), 0, 100) })
}

// Mieszanie w RGB: weight - udział koloru b.
const mix = (a: string, b: string, weight: number) => {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * weight,
    g: ca.g + (cb.g - ca.g) * weight,
    b: ca.b + (cb.b - ca.b) * weight,
  })
}

// Zmienne kolorów motywu (wszystkie z @theme w index.css poza
// --destructive*). Własne kolory nadpisują tylko zmienne od nich zależne.
const COLOR_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--ring',
] as const

type ColorVariable = (typeof COLOR_VARIABLES)[number]

// Wszystko, co useDocumentTheme może ustawić w stylu inline.
export const THEME_VARIABLES = [...COLOR_VARIABLES, 'color-scheme'] as const

type ThemeVariables = Partial<Record<(typeof THEME_VARIABLES)[number], string>>

// Paleta odczytana z CSS (jedno źródło prawdy - index.css). complete=false -
// arkusz jeszcze się nie wczytał (wtedy wynik nie trafia do pamięci).
type Palette = { colors: Record<ColorVariable, string>; dark: boolean; complete: boolean }

const paletteCache = new Map<ThemeKey, Palette>()
const FALLBACK_COLOR = '#888888'

const readPalette = (key: ThemeKey): Palette => {
  const cached = paletteCache.get(key)
  if (cached) return cached

  const probe = document.createElement('span')
  probe.dataset.theme = key
  probe.hidden = true
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const values = COLOR_VARIABLES.map((name) => [name, tripletToHex(style.getPropertyValue(name))] as const)
  const dark = style.getPropertyValue('color-scheme').trim() === 'dark'
  probe.remove()

  const palette: Palette = {
    colors: Object.fromEntries(values.map(([name, hex]) => [name, hex ?? FALLBACK_COLOR])) as Palette['colors'],
    dark,
    complete: values.every(([, hex]) => hex !== null),
  }

  if (palette.complete) paletteCache.set(key, palette)
  return palette
}

// false - arkusz CSS jeszcze się nie wczytał, kolory palety są zastępcze.
export const isPaletteReady = (key: ThemeKey) => readPalette(key).complete

type BaseColors = Record<CustomColorKey, string>

// Pięć kolorów bazowych palety (wartości pól w edytorze).
export const readPaletteColors = (key: ThemeKey): BaseColors => {
  const { colors } = readPalette(key)
  return Object.fromEntries(CUSTOM_COLORS.map(({ key: colorKey }) => [colorKey, colors[`--${colorKey}`]])) as BaseColors
}

// Kolory motywu (hex) po nałożeniu własnych kolorów. changed - zmienne różne
// od palety (tylko je ustawiamy w stylu inline i tylko dla nich sprawdzamy
// kontrast); schemeChanged - tło lub tekst zmienione, color-scheme wyliczony.
type DerivedColors = {
  colors: Record<ColorVariable, string>
  dark: boolean
  changed: Set<ColorVariable>
  schemeChanged: boolean
}

// Wyciszony tekst: tekst rozjaśniony w stronę tła, ale z kontrastem co
// najmniej MIN_CONTRAST (o ile to możliwe).
const mutedText = (foreground: string, background: string) => {
  for (let weight = 0.45; weight > 0.1; weight -= 0.05) {
    const color = mix(foreground, background, weight)
    if (contrastRatio(color, background) >= MIN_CONTRAST) return color
  }
  return mix(foreground, background, 0.1)
}

// Jaki spadek kontrastu względem palety jeszcze nie zmienia roli tekstu.
const ROLE_TOLERANCE = 0.85

// Kolory z tekstem: zmienna koloru i zmienna tekstu na nim.
const COLORED = [
  { key: 'primary', color: '--primary', text: '--primary-foreground' },
  { key: 'secondary', color: '--secondary', text: '--secondary-foreground' },
  { key: 'accent', color: '--accent', text: '--accent-foreground' },
] as const

const deriveColors = (theme: AppTheme): DerivedColors => {
  const palette = readPalette(theme.key)
  const custom = theme.colors ?? {}
  const colors = { ...palette.colors }
  const changed = new Set<ColorVariable>()
  const set = (name: ColorVariable, value: string) => {
    colors[name] = value
    changed.add(name)
  }

  const backgroundChanged = custom.background !== undefined
  const foregroundChanged = custom.foreground !== undefined
  const schemeChanged = backgroundChanged || foregroundChanged
  const background = custom.background ?? palette.colors['--background']
  const foreground = custom.foreground ?? palette.colors['--foreground']
  // Ciemny motyw: tło ciemniejsze od tekstu.
  const dark = schemeChanged ? luminance(background) < luminance(foreground) : palette.dark

  if (backgroundChanged) {
    const card = shift(background, dark ? 4 : 2, dark)
    const border = shift(background, dark ? 14 : 11, dark, 0.7)
    set('--background', background)
    set('--card', card)
    set('--popover', dark ? card : background)
    set('--muted', shift(background, dark ? 8 : 7, dark, 0.8))
    set('--border', border)
    set('--input', border)
  }

  if (foregroundChanged) {
    set('--foreground', foreground)
    set('--card-foreground', foreground)
    set('--popover-foreground', foreground)
  }

  if (schemeChanged) {
    set('--muted-foreground', mutedText(foreground, background))
  }

  // Tekst na nadpisanym kolorze: tło albo tekst motywu, co daje lepszy kontrast.
  const textOn = (color: string) =>
    contrastRatio(color, background) >= contrastRatio(color, foreground) ? background : foreground
  // Tekst na kolorze z palety: zostaje w tej samej roli co w palecie (kolor
  // tła albo tekstu motywu, teraz w nowych odcieniach), o ile kontrast nie
  // spada wyraźnie poniżej palety - wtedy wariant z lepszym kontrastem.
  // Tolerancja: drobna zmiana tła nie przełącza tekstu z jasnego na ciemny.
  const keepRole = (color: ColorVariable, text: ColorVariable) => {
    const sameRole =
      contrastRatio(palette.colors[text], palette.colors['--background']) <
      contrastRatio(palette.colors[text], palette.colors['--foreground'])
        ? background
        : foreground
    const required = Math.min(contrastRatio(palette.colors[text], palette.colors[color]), MIN_CONTRAST) * ROLE_TOLERANCE
    return contrastRatio(sameRole, palette.colors[color]) >= required ? sameRole : textOn(palette.colors[color])
  }

  for (const { key, color, text } of COLORED) {
    const value = custom[key]
    if (value !== undefined) {
      set(color, value)
      set(text, textOn(value))
      if (key === 'primary') set('--ring', value)
    } else if (schemeChanged) {
      set(text, keepRole(color, text))
    }
  }

  return { colors, dark, changed, schemeChanged }
}

// Zmienne do stylu inline - tylko różne od palety. null - sama paleta.
export const buildThemeVariables = (theme: AppTheme): ThemeVariables | null => {
  if (!theme.colors) return null

  const { colors, dark, changed, schemeChanged } = deriveColors(theme)
  const variables: ThemeVariables = Object.fromEntries(
    [...changed].map((name) => [name, toTriplet(hexToHsl(colors[name]))])
  )
  if (schemeChanged) variables['color-scheme'] = dark ? 'dark' : 'light'

  return Object.keys(variables).length > 0 ? variables : null
}

// Styl inline dla fragmentu z data-theme (podgląd) - zmienne własnych kolorów.
export const themeStyle = (theme: AppTheme): CSSProperties | undefined =>
  (buildThemeVariables(theme) as CSSProperties | null) ?? undefined

// Pary tekst / tło ze zbyt słabym kontrastem (WCAG AA, 4,5:1). Sprawdzane
// tylko pary, w których coś się zmieniło, i tylko gdy kontrast jest gorszy
// niż w samej palecie (palety są dobrane ręcznie).
export const MIN_CONTRAST = 4.5

const CONTRAST_PAIRS = [
  { label: 'Tekst na tle', text: '--foreground', background: '--background' },
  { label: 'Wyciszony tekst na tle', text: '--muted-foreground', background: '--background' },
  { label: 'Tekst na przyciskach (kolor główny)', text: '--primary-foreground', background: '--primary' },
  { label: 'Tekst na kolorze drugorzędnym', text: '--secondary-foreground', background: '--secondary' },
  { label: 'Tekst na akcencie', text: '--accent-foreground', background: '--accent' },
] as const

export type ContrastIssue = { label: string; ratio: number }

// Spadek kontrastu względem palety pomijany w ostrzeżeniach (drobna zmiana
// odcienia tła nie powinna ostrzegać o parze, którą dobrała sama paleta).
const CONTRAST_TOLERANCE = 0.95

export const findContrastIssues = (theme: AppTheme): ContrastIssue[] => {
  if (!theme.colors) return []

  const palette = readPalette(theme.key)
  const { colors, changed } = deriveColors(theme)
  return CONTRAST_PAIRS.filter(({ text, background }) => changed.has(text) || changed.has(background))
    .map(({ label, text, background }) => ({
      label,
      ratio: contrastRatio(colors[text], colors[background]),
      paletteRatio: contrastRatio(palette.colors[text], palette.colors[background]),
    }))
    .filter(({ ratio, paletteRatio }) => ratio < MIN_CONTRAST && ratio < paletteRatio * CONTRAST_TOLERANCE)
    .map(({ label, ratio }) => ({ label, ratio }))
}

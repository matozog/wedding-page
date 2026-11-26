import { toAppTheme, type AppTheme } from '../config/themes'
import { supabase } from './supabase'

// Ustawienia aplikacji (jeden wiersz app_settings). Odczyt - każdy, także
// bez sesji (ekran kodu), zapis - tylko super admin (RPC sprawdza to w bazie).

// Motyw ekranu startowego (wpisywanie kodu).
export const fetchStartTheme = async (): Promise<AppTheme> => {
  const { data, error } = await supabase.from('app_settings').select('start_theme, start_theme_colors').maybeSingle()

  if (error) {
    throw error
  }

  return toAppTheme(data?.start_theme, data?.start_theme_colors)
}

export const setStartTheme = async (theme: AppTheme) => {
  const { error } = await supabase.rpc('set_start_theme', {
    p_theme: theme.key,
    p_colors: theme.colors ?? undefined,
  })

  if (error) {
    throw error
  }
}

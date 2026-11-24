import { createContext, useContext } from 'react'
import { buildSideOptions, type SideOptions } from '@/types/guest'

// Etykiety "Od kogo" bieżącego wydarzenia - potrzebne w wielu miejscach
// panelu gości (tabela, karty, filtry, formularze).
export const SideOptionsContext = createContext<SideOptions>(
  buildSideOptions({ hostA: null, hostB: null })
)

export const useSideOptions = () => useContext(SideOptionsContext)

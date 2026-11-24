import { createContext, useContext } from 'react'
import { buildInviterOptions, type InviterOptions } from '@/types/guest'

// "Od kogo" bieżącej listy - potrzebne w wielu miejscach panelu gości
// (tabela, karty, filtry, licznik, formularze).
export const InviterOptionsContext = createContext<InviterOptions>(buildInviterOptions([]))

export const useInviterOptions = () => useContext(InviterOptionsContext)

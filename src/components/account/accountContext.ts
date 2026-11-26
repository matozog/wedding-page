import { createContext, useContext } from 'react'

// Konto zalogowanej osoby dla nagłówków stron. Wyjście / wylogowanie idzie
// nadal przez propsy onLogout (ekrany mogą je przechwycić, np. przy
// niezapisanych zmianach).
export type AccountContextValue = {
  // Konto anonimowe (pseudonim) - "Wyjdź" zamiast "Wyloguj".
  isAnonymous: boolean
  // Otwiera okno zmiany pseudonimu.
  onChangeNickname: () => void
}

export const AccountContext = createContext<AccountContextValue | null>(null)

export const useAccount = () => useContext(AccountContext)

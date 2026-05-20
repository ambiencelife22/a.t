// ThemeContext.ts
import { createContext } from 'react'
import type { Palette } from '../lib/tokensProgramme'

export interface ThemeContextValue {
  isDark:      boolean
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({
  isDark:      true,
  toggleTheme: () => {},
})

// Palette type re-exported for convenience
export type { Palette }
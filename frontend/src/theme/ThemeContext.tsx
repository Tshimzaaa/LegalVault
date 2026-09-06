import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

interface ThemeContextValue {
  /** The theme actually in effect right now — explicit choice if set, else the OS preference. */
  theme: Theme
  /** Sets an explicit theme and persists it, overriding the OS preference from now on. */
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [explicitTheme, setExplicitTheme] = useState<Theme | null>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystemTheme(getSystemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (explicitTheme) {
      document.documentElement.dataset.theme = explicitTheme
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [explicitTheme])

  const theme = explicitTheme ?? systemTheme

  function setTheme(next: Theme) {
    localStorage.setItem(THEME_KEY, next)
    setExplicitTheme(next)
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

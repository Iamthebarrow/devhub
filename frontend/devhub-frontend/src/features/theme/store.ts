import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
  applyTheme: (mode?: ThemeMode) => void
}

function resolveSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light'
  }
  if (typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }
  const stored = window.localStorage.getItem('devhub-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }
  const resolved = mode === 'system' ? resolveSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getStoredMode(),
  setMode: (mode) => {
    set({ mode })
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('devhub-theme', mode)
    }
    applyThemeToDocument(mode)
  },
  toggleMode: () => {
    const current = get().mode
    const next = current === 'dark' ? 'light' : 'dark'
    get().setMode(next)
  },
  applyTheme: (mode) => {
    const next = mode ?? get().mode
    applyThemeToDocument(next)
  },
}))

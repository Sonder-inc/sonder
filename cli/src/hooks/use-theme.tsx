/**
 * Theme Hooks for Sonder CLI
 *
 * Simple hooks for accessing theme from zustand store
 */

import { create } from 'zustand'

import { chatThemes, type ChatTheme, type ThemeName } from '../types/theme'

import type { StoreApi, UseBoundStore } from 'zustand'

type ThemeStore = {
  theme: ChatTheme
  setThemeName: (name: ThemeName) => void
  isLimitedColor: boolean
}

/**
 * Detect if terminal has limited color support (e.g., Apple Terminal)
 * Apple Terminal only supports 256 colors, not truecolor
 */
export const detectLimitedColorTerminal = (): boolean => {
  const termProgram = process.env.TERM_PROGRAM
  const colorterm = process.env.COLORTERM

  // Apple Terminal doesn't set COLORTERM and doesn't support truecolor
  if (termProgram === 'Apple_Terminal') {
    return true
  }

  // If COLORTERM is truecolor or 24bit, we have full color support
  if (colorterm === 'truecolor' || colorterm === '24bit') {
    return false
  }

  // Check TERM for 256color support only (not truecolor)
  const term = process.env.TERM ?? ''
  if (term.includes('256color') && !colorterm) {
    return true
  }

  return false
}

export let useThemeStore: UseBoundStore<StoreApi<ThemeStore>> = (() => {
  throw new Error('useThemeStore not initialized')
}) as any
let themeStoreInitialized = false

/**
 * Detect the system theme preference
 */
export const detectSystemTheme = (): ThemeName => {
  const envPreference = process.env.SONDER_THEME ?? process.env.OPENTUI_THEME
  const normalizedEnv = envPreference?.toLowerCase()

  if (normalizedEnv === 'dark' || normalizedEnv === 'light') {
    return normalizedEnv
  }

  // Check COLORFGBG environment variable (format: "foreground;background")
  // Common in many terminal emulators
  const colorFgBg = process.env.COLORFGBG
  if (colorFgBg) {
    const parts = colorFgBg.split(';')
    const bg = parseInt(parts[parts.length - 1] ?? '', 10)
    // Background color 0-6 or 8 typically indicates dark, 7 or 9-15 indicates light
    if (!isNaN(bg)) {
      if (bg === 7 || (bg >= 9 && bg <= 15)) {
        return 'light'
      }
      return 'dark'
    }
  }

  // Check macOS dark mode
  if (process.platform === 'darwin') {
    try {
      const result = Bun.spawnSync(['defaults', 'read', '-g', 'AppleInterfaceStyle'])
      const output = new TextDecoder().decode(result.stdout).trim().toLowerCase()
      if (output === 'dark') {
        return 'dark'
      }
      // If the key doesn't exist or returns something else, it's light mode
      return 'light'
    } catch {
      // Ignore errors, fall through to default
    }
  }

  // Default to dark theme
  return 'dark'
}

export function initializeThemeStore() {
  if (themeStoreInitialized) {
    return
  }
  themeStoreInitialized = true

  const initialThemeName = detectSystemTheme()
  const initialTheme = chatThemes[initialThemeName]
  const isLimitedColor = detectLimitedColorTerminal()

  useThemeStore = create<ThemeStore>((set) => ({
    theme: initialTheme,
    isLimitedColor,

    setThemeName: (name: ThemeName) => {
      const theme = chatThemes[name]
      set({ theme })
    },
  }))
}

export const useTheme = (): ChatTheme => {
  return useThemeStore((state) => state.theme)
}

export const useIsLimitedColor = (): boolean => {
  return useThemeStore((state) => state.isLimitedColor)
}

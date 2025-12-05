import { RGBA } from "@opentui/core"

export type ThemeName = 'dark' | 'light'

export type ChatTheme = {
  text: string | RGBA | undefined
  name: ThemeName
  // Core colors
  background: string
  foreground: string
  muted: string
  accent: string
  error: string
  warning: string
  success: string
  info: string

  // Input colors
  inputFg: string
  inputFocusedFg: string
  inputBg: string
  inputBorder: string
  slashCommandFg: string

  // Message colors
  userMessageBg: string
  userMessageFg: string
  aiMessageBg: string
  aiMessageFg: string

  // Border colors
  borderColor: string
  borderMuted: string

  // Status colors
  statusBg: string
  statusFg: string

  // Code block colors
  codeBlockBg: string
  codeBlockFg: string
}

export const darkTheme: ChatTheme = {
  name: 'dark',
  background: 'transparent',
  foreground: '#e4e4e7',
  muted: '#71717a',
  accent: '#3b82f6',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#06b6d4',

  inputFg: '#808080',
  inputFocusedFg: '#808080',
  inputBg: 'transparent',
  inputBorder: '#3f3f46',
  slashCommandFg: '#ffffff',

  userMessageBg: '#1e3a5f',
  userMessageFg: '#e4e4e7',
  aiMessageBg: 'transparent',
  aiMessageFg: '#e4e4e7',

  borderColor: '#3f3f46',
  borderMuted: '#27272a',

  statusBg: 'transparent',
  statusFg: '#71717a',

  codeBlockBg: '#18181b',
  codeBlockFg: '#a1a1aa',
  text: undefined
}

export const lightTheme: ChatTheme = {
  name: 'light',
  background: 'transparent',
  foreground: '#18181b',
  muted: '#71717a',
  accent: '#2563eb',
  error: '#dc2626',
  warning: '#d97706',
  success: '#16a34a',
  info: '#0891b2',

  inputFg: '#808080',
  inputFocusedFg: '#808080',
  inputBg: 'transparent',
  inputBorder: '#d4d4d8',
  slashCommandFg: '#18181b',

  userMessageBg: '#dbeafe',
  userMessageFg: '#18181b',
  aiMessageBg: 'transparent',
  aiMessageFg: '#18181b',

  borderColor: '#d4d4d8',
  borderMuted: '#e4e4e7',

  statusBg: 'transparent',
  statusFg: '#71717a',

  codeBlockBg: '#f4f4f5',
  codeBlockFg: '#52525b',
  text: undefined
}

export const chatThemes: Record<ThemeName, ChatTheme> = {
  dark: darkTheme,
  light: lightTheme,
}

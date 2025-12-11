import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AuthMethod = 'signin' | 'byok' | null

export interface SonderUser {
  id: string
  githubId: number
  githubUsername: string
  email?: string
  avatarUrl?: string
  credits: number
  tier: 'free' | 'pro' | 'max' | 'black'
}

export type AuthStoreState = {
  isAuthenticated: boolean
  authMethod: AuthMethod
  isDevMode: boolean // True when using "test" bypass

  // BYOK mode
  apiKey: string | null

  // Sonder signin mode
  sessionToken: string | null
  user: SonderUser | null

  // UI flag - auto-open config panel on BYOK entry
  shouldOpenConfig: boolean
}

type AuthStoreActions = {
  setAuthenticated: (authenticated: boolean, method?: AuthMethod, devMode?: boolean) => void
  setApiKey: (key: string | null) => void
  setSession: (sessionToken: string, user: SonderUser) => void
  updateUser: (user: Partial<SonderUser>) => void
  setShouldOpenConfig: (value: boolean) => void
  clearShouldOpenConfig: () => void
  logout: () => void
}

export type AuthStore = AuthStoreState & AuthStoreActions

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      authMethod: null,
      apiKey: null,
      isDevMode: false,
      sessionToken: null,
      user: null,
      shouldOpenConfig: false,

      setAuthenticated: (authenticated, method, devMode = false) =>
        set({
          isAuthenticated: authenticated,
          authMethod: method ?? null,
          isDevMode: devMode,
        }),

      setApiKey: (key) =>
        set({
          apiKey: key,
        }),

      setSession: (sessionToken, user) =>
        set({
          sessionToken,
          user,
          isAuthenticated: true,
          authMethod: 'signin',
          isDevMode: false,
        }),

      updateUser: (userUpdate) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdate } : null,
        })),

      setShouldOpenConfig: (value) =>
        set({
          shouldOpenConfig: value,
        }),

      clearShouldOpenConfig: () =>
        set({
          shouldOpenConfig: false,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          authMethod: null,
          apiKey: null,
          isDevMode: false,
          sessionToken: null,
          user: null,
          shouldOpenConfig: false,
        }),
    }),
    {
      name: 'sonder-auth',
    }
  )
)

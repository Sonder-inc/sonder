import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AuthMethod = 'signin' | 'byok' | null

export type AuthStoreState = {
  isAuthenticated: boolean
  authMethod: AuthMethod
  apiKey: string | null
  isDevMode: boolean  // True when using "test" bypass
}

type AuthStoreActions = {
  setAuthenticated: (authenticated: boolean, method?: AuthMethod, devMode?: boolean) => void
  setApiKey: (key: string | null) => void
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

      logout: () =>
        set({
          isAuthenticated: false,
          authMethod: null,
          apiKey: null,
          isDevMode: false,
        }),
    }),
    {
      name: 'sonder-auth',
    }
  )
)

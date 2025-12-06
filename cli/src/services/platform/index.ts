/**
 * Platform services - HTB/THM integration
 */

export { platformManager } from './manager'
export { htbClient } from './htb'
export { thmClient } from './thm'

export type {
  IPlatform,
  PlatformCredentials,
  PlatformUser,
  VPNConfig,
  MachineFilters,
  OAuthState,
} from './types'

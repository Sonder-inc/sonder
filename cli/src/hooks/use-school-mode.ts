/**
 * School Mode Hook
 *
 * Manages the school mode flow:
 * 1. Check/prompt for platform auth (HTB/THM)
 * 2. Auto-connect VPN
 * 3. List/select machine
 * 4. Spawn machine
 * 5. Start hacking session
 */

import { useState, useCallback } from 'react'
import { platformManager } from '../services/platform'
import { usePlatformStore } from '../state/platform-store'
import type { Machine } from '../types/platform'

export type SchoolModePhase =
  | 'idle'
  | 'vpn_connecting'
  | 'machine_select'
  | 'spawning'
  | 'hacking'
  | 'error'

export interface SchoolModeState {
  phase: SchoolModePhase
  error?: string
  platform?: 'htb' | 'thm'
  machine?: Machine
  vpnConnected: boolean
}

export interface UseSchoolModeReturn {
  state: SchoolModeState
  enterSchoolMode: () => Promise<void>
  exitSchoolMode: () => void
  selectPlatform: (platform: 'htb' | 'thm') => Promise<void>
  selectMachine: (machine: Machine) => Promise<void>
  submitFlag: (flag: string) => Promise<{ correct: boolean; message: string }>
  isActive: boolean
}

export function useSchoolMode(): UseSchoolModeReturn {
  const [state, setState] = useState<SchoolModeState>({
    phase: 'idle',
    vpnConnected: false,
  })

  const {
    setUser,
    setActiveMachine,
    setMachineStatus,
    setIsSpawning,
  } = usePlatformStore()

  const enterSchoolMode = useCallback(async () => {
    // Initialize platform manager
    await platformManager.init()

    // Check which platforms are authenticated
    const authedPlatforms = platformManager.getAuthenticatedPlatforms()

    if (authedPlatforms.length === 0) {
      // Show error - authentication should be handled at login
      setState({
        phase: 'error',
        error: 'Please authenticate with HackTheBox or TryHackMe first',
        vpnConnected: false,
      })
      return
    }

    // Check for active machine
    const activeMachine = await platformManager.getActiveMachine()

    if (activeMachine) {
      // Resume existing session
      setActiveMachine(activeMachine as any)

      // Check VPN
      const platform = activeMachine.platform as 'htb' | 'thm'
      const vpnStatus = await platformManager.getVPNStatus(platform)

      setState({
        phase: 'hacking',
        platform,
        machine: activeMachine,
        vpnConnected: vpnStatus.connected,
      })
      return
    }

    // No active machine, go to selection
    setState({
      phase: 'machine_select',
      platform: authedPlatforms[0],
      vpnConnected: false,
    })
  }, [setActiveMachine])

  const exitSchoolMode = useCallback(() => {
    setState({ phase: 'idle', vpnConnected: false })
    setActiveMachine(null)
  }, [setActiveMachine])

  const selectPlatform = useCallback(async (platform: 'htb' | 'thm') => {
    // Assume platform is already authenticated (handled at login)
    const isAuthed = platformManager.isAuthenticated(platform)

    if (!isAuthed) {
      setState({
        phase: 'error',
        error: `Please authenticate with ${platform.toUpperCase()} first`,
        vpnConnected: false,
      })
      return
    }

    // Connect VPN
    setState({ phase: 'vpn_connecting', platform, vpnConnected: false })

    const vpnResult = await platformManager.connectVPN(platform)

    if (!vpnResult.success) {
      setState({
        phase: 'error',
        error: `VPN connection failed: ${vpnResult.error}`,
        platform,
        vpnConnected: false,
      })
      return
    }

    platformManager.setActivePlatform(platform)

    setState({
      phase: 'machine_select',
      platform,
      vpnConnected: true,
    })
  }, [])

  const selectMachine = useCallback(async (machine: Machine) => {
    const platform = machine.platform as 'htb' | 'thm'

    setState((prev) => ({
      ...prev,
      phase: 'spawning',
      machine,
    }))
    setIsSpawning(true)
    setMachineStatus('spawning')

    const result = await platformManager.spawnMachine(machine.id)
    setIsSpawning(false)

    if (!result.success) {
      setState((prev) => ({
        ...prev,
        phase: 'error',
        error: result.error || 'Failed to spawn machine',
      }))
      setMachineStatus('offline')
      return
    }

    // Update machine with IP
    const updatedMachine: Machine = {
      ...machine,
      ip: result.ip,
      status: 'running',
    }

    setActiveMachine(updatedMachine as any)
    setMachineStatus('running')

    setState({
      phase: 'hacking',
      platform,
      machine: updatedMachine,
      vpnConnected: true,
    })
  }, [setActiveMachine, setIsSpawning, setMachineStatus])

  const submitFlag = useCallback(async (flag: string) => {
    if (!state.machine) {
      return { correct: false, message: 'No active machine' }
    }

    const result = await platformManager.submitFlag(state.machine.id, flag)

    if (result.correct) {
      // Update machine ownership
      setActiveMachine({
        ...state.machine,
        userOwned: result.flagType === 'user' || state.machine.userOwned,
        rootOwned: result.flagType === 'root' || state.machine.rootOwned,
      } as any)
    }

    return {
      correct: result.correct,
      message: result.message,
    }
  }, [state.machine, setActiveMachine])

  return {
    state,
    enterSchoolMode,
    exitSchoolMode,
    selectPlatform,
    selectMachine,
    submitFlag,
    isActive: state.phase === 'hacking',
  }
}

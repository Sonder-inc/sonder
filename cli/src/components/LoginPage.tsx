import { useState, useCallback, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useAuthStore } from '../state/auth-store'
import { sonderApi } from '../services/sonder-api'

type LoginOption = 0 | 1
type SigninState = 'idle' | 'loading' | 'showing_code' | 'polling' | 'success' | 'error'

// Donut.c implementation - spinning 3D torus in ASCII
const DONUT_WIDTH = 45
const DONUT_HEIGHT = 22

function renderDonutFrame(A: number, B: number): string {
  const output: string[] = new Array(DONUT_WIDTH * DONUT_HEIGHT).fill(' ')
  const zbuffer: number[] = new Array(DONUT_WIDTH * DONUT_HEIGHT).fill(0)

  const cosA = Math.cos(A), sinA = Math.sin(A)
  const cosB = Math.cos(B), sinB = Math.sin(B)

  // theta goes around the tube, phi goes around the torus
  for (let theta = 0; theta < 6.28; theta += 0.07) {
    const cosTheta = Math.cos(theta), sinTheta = Math.sin(theta)

    for (let phi = 0; phi < 6.28; phi += 0.02) {
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi)

      // 3D coordinates of point on torus
      const circleX = 2 + 1 * cosTheta // R1=2, R2=1
      const circleY = 1 * sinTheta

      // Rotate around Y axis (B) then X axis (A)
      const x = circleX * (cosB * cosPhi + sinA * sinB * sinPhi) - circleY * cosA * sinB
      const y = circleX * (sinB * cosPhi - sinA * cosB * sinPhi) + circleY * cosA * cosB
      const z = 5 + cosA * circleX * sinPhi + circleY * sinA // K2=5
      const ooz = 1 / z // one over z

      // Project to 2D (scaled up, shifted up)
      const xp = Math.floor(DONUT_WIDTH / 2 + 20 * ooz * x)
      const yp = Math.floor(DONUT_HEIGHT / 2 - 3 + 10 * ooz * y)

      // Calculate luminance
      const L = cosPhi * cosTheta * sinB - cosA * cosTheta * sinPhi - sinA * sinTheta + cosB * (cosA * sinTheta - cosTheta * sinA * sinPhi)

      if (xp >= 0 && xp < DONUT_WIDTH && yp >= 0 && yp < DONUT_HEIGHT) {
        const idx = xp + yp * DONUT_WIDTH
        if (ooz > zbuffer[idx]) {
          zbuffer[idx] = ooz
          const luminanceIndex = Math.max(0, Math.floor(L * 8))
          output[idx] = '.,-~:;=!*#$@'[Math.min(luminanceIndex, 11)]
        }
      }
    }
  }

  // Convert to string with newlines
  let result = ''
  for (let y = 0; y < DONUT_HEIGHT; y++) {
    result += output.slice(y * DONUT_WIDTH, (y + 1) * DONUT_WIDTH).join('') + '\n'
  }
  return result.trimEnd()
}

function useDonutAnimation() {
  const [frame, setFrame] = useState('')
  const angleRef = useRef({ A: 0, B: 0 })

  useEffect(() => {
    // Initial render
    setFrame(renderDonutFrame(0, 0))

    const interval = setInterval(() => {
      angleRef.current.A += 0.04
      angleRef.current.B += 0.02
      setFrame(renderDonutFrame(angleRef.current.A, angleRef.current.B))
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return frame
}

export const LoginPage = () => {
  const theme = useTheme()
  const { terminalHeight } = useTerminalDimensions()
  const setSession = useAuthStore((state) => state.setSession)
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const setShouldOpenConfig = useAuthStore((state) => state.setShouldOpenConfig)

  const [selectedOption, setSelectedOption] = useState<LoginOption>(0)

  // Signin state (GitHub device flow)
  const [signinState, setSigninState] = useState<SigninState>('idle')
  const [userCode, setUserCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [deviceCode, setDeviceCode] = useState('')

  // Polling ref to track active polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Animated donut
  const donutFrame = useDonutAnimation()

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Start GitHub device flow
  const startSignin = useCallback(async () => {
    setSigninState('loading')
    setErrorMessage('')

    try {
      const response = await sonderApi.startDeviceAuth()
      setUserCode(response.userCode)
      setVerificationUri(response.verificationUri)
      setDeviceCode(response.deviceCode)
      setSigninState('showing_code')

      // Start polling after a short delay
      setTimeout(() => {
        setSigninState('polling')
        startPolling(response.deviceCode, response.interval)
      }, 2000)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start sign in')
      setSigninState('error')
    }
  }, [])

  // Poll for authorization
  const startPolling = useCallback((code: string, interval: number) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    const poll = async () => {
      try {
        const response = await sonderApi.pollDeviceAuth(code)

        if (response.error) {
          // Handle errors
          if (response.error === 'expired_token') {
            setErrorMessage('Authorization expired. Please try again.')
            setSigninState('error')
            if (pollingRef.current) clearInterval(pollingRef.current)
          } else if (response.error === 'access_denied') {
            setErrorMessage('Authorization denied.')
            setSigninState('error')
            if (pollingRef.current) clearInterval(pollingRef.current)
          }
          return
        }

        if (response.status === 'pending') {
          // Update interval if server requests slower polling
          if (response.interval && response.interval > interval) {
            // Restart polling with new interval
            if (pollingRef.current) clearInterval(pollingRef.current)
            startPolling(code, response.interval)
          }
          return
        }

        // Success!
        if (response.sessionToken && response.user) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setSigninState('success')
          setSession(response.sessionToken, response.user)
        }
      } catch (error) {
        // Network error - keep polling
        console.error('Polling error:', error)
      }
    }

    // Initial poll
    poll()

    // Set up interval
    pollingRef.current = setInterval(poll, interval * 1000)
  }, [setSession])

  // Handle BYOK - just let them in and open config
  const handleByok = useCallback(() => {
    setAuthenticated(true, 'byok', false)
    setShouldOpenConfig(true)
  }, [setAuthenticated, setShouldOpenConfig])

  // Reset signin state
  const resetSignin = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }
    setSigninState('idle')
    setUserCode('')
    setVerificationUri('')
    setDeviceCode('')
    setErrorMessage('')
  }, [])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // If we're in signin flow, handle escape to cancel
        if (signinState !== 'idle' && signinState !== 'success') {
          if (key.name === 'escape') {
            resetSignin()
            return
          }
          // Don't process other keys during signin flow
          return
        }

        // Handle menu navigation
        if (key.name === 'up' || key.sequence === 'k') {
          setSelectedOption(0)
        } else if (key.name === 'down' || key.sequence === 'j') {
          setSelectedOption(1)
        } else if (key.name === 'return') {
          if (selectedOption === 0) {
            // Sign in with Sonder (GitHub)
            startSignin()
          } else {
            // BYOK - instant entry, open config
            handleByok()
          }
        }
      },
      [selectedOption, signinState, startSignin, handleByok, resetSignin]
    )
  )

  // Calculate vertical centering
  const contentHeight = 22
  const paddingTop = Math.max(2, Math.floor((terminalHeight - contentHeight) / 2))

  // Render signin flow status below option 1
  const renderSigninStatus = () => {
    switch (signinState) {
      case 'loading':
        return (
          <text style={{ fg: theme.muted }}>     Starting authentication...</text>
        )
      case 'showing_code':
      case 'polling':
        return (
          <box style={{ flexDirection: 'column' }}>
            <box style={{ flexDirection: 'row' }}>
              <text style={{ fg: theme.muted }}>     Go to: </text>
              <text style={{ fg: theme.accent }}>{verificationUri}</text>
            </box>
            <box style={{ flexDirection: 'row' }}>
              <text style={{ fg: theme.muted }}>     Enter code: </text>
              <text style={{ fg: '#22c55e' }}>{userCode}</text>
            </box>
            <text style={{ fg: theme.muted }}>
              {signinState === 'polling' ? '     Waiting for authorization...' : ''}
            </text>
          </box>
        )
      case 'success':
        return (
          <text style={{ fg: '#22c55e' }}>     Authenticated!</text>
        )
      case 'error':
        return (
          <box style={{ flexDirection: 'column' }}>
            <text style={{ fg: '#ef4444' }}>     {errorMessage}</text>
            <text style={{ fg: theme.muted }}>     Press Esc to try again</text>
          </box>
        )
      default:
        return (
          <text style={{ fg: theme.muted }}>     Sign in with your GitHub account</text>
        )
    }
  }

  return (
    <scrollbox
      scrollX={false}
      scrollY={false}
      scrollbarOptions={{ visible: false }}
      style={{
        flexGrow: 1,
        rootOptions: {
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
        },
        wrapperOptions: {
          paddingLeft: 4,
          paddingTop,
          border: false,
        },
        contentOptions: {
          flexDirection: 'column',
        },
      }}
    >
      <box style={{ flexDirection: 'row', gap: 4 }}>
        {/* Left: Animated donut */}
        <box style={{ flexDirection: 'column', width: DONUT_WIDTH }}>
          <text style={{ fg: '#5599ff' }}>{donutFrame}</text>
        </box>

        {/* Right: Welcome text and options */}
        <box style={{ flexDirection: 'column', paddingTop: 1 }}>
          {/* Title */}
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.foreground }}>Welcome to </text>
            <text style={{ fg: theme.accent }}>Sonder</text>
            <text style={{ fg: theme.foreground }}>, the cli hacking agent</text>
          </box>
          <text> </text>
          {/* Description */}
          <text style={{ fg: theme.foreground }}>Sign in with Sonder to get credits for contributions</text>
          <text style={{ fg: theme.foreground }}>or use your own API key for direct billing</text>
          <text> </text>

          {/* Option 1: Sign in with Sonder */}
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>{selectedOption === 0 ? '> ' : '  '}</text>
            <text style={{ fg: selectedOption === 0 ? theme.accent : theme.foreground }}>
              1. Sign in with Sonder
            </text>
          </box>
          {selectedOption === 0 ? renderSigninStatus() : (
            <text style={{ fg: theme.muted }}>     Sign in with your GitHub account</text>
          )}
          <text> </text>

          {/* Option 2: BYOK */}
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>{selectedOption === 1 ? '> ' : '  '}</text>
            <text style={{ fg: selectedOption === 1 ? theme.accent : theme.foreground }}>
              2. Use your own API key
            </text>
          </box>
          <text style={{ fg: theme.muted }}>     Pay for what you use directly</text>
          <text> </text>

          {/* Hint */}
          <text style={{ fg: theme.muted }}>Press Enter to continue</text>
        </box>
      </box>
    </scrollbox>
  )
}

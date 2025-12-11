import { useState, useCallback, useEffect, useRef } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent, PasteEvent } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useAuthStore } from '../state/auth-store'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

type LoginOption = 0 | 1
type ValidationState = 'idle' | 'validating' | 'error'

/**
 * Validate OpenRouter API key format
 * OpenRouter keys start with sk-or- and are typically 50+ chars
 */
function isValidKeyFormat(key: string): boolean {
  return key.startsWith('sk-or-') && key.length > 20
}

/**
 * Test API key by making a minimal request to OpenRouter
 */
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const openrouter = createOpenRouter({ apiKey })
    // Make a minimal request to verify the key works
    await generateText({
      model: openrouter('anthropic/claude-3.5-haiku'),
      prompt: 'Hi',
    })
    return { valid: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('401') || message.includes('Unauthorized')) {
      return { valid: false, error: 'Invalid API key' }
    }
    if (message.includes('402') || message.includes('Payment')) {
      return { valid: false, error: 'No credits on this key' }
    }
    return { valid: false, error: 'Could not verify key' }
  }
}

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
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const setApiKey = useAuthStore((state) => state.setApiKey)

  const [selectedOption, setSelectedOption] = useState<LoginOption>(0)
  const [keyValue, setKeyValue] = useState('')
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Animated donut
  const donutFrame = useDonutAnimation()

  // Handle paste events
  const handlePaste = useCallback((event: PasteEvent) => {
    if (selectedOption !== 1) return

    const text = event.text ?? ''
    if (!text) return

    setKeyValue((prev) => prev + text)
    // Clear error when user pastes
    if (validationState === 'error') {
      setValidationState('idle')
      setErrorMessage('')
    }
  }, [selectedOption, validationState])

  // Handle API key submission with validation
  const handleKeySubmit = useCallback(async () => {
    const key = keyValue.trim()
    if (!key) return

    // Dev bypass - type "test" to skip validation
    if (key.toLowerCase() === 'test') {
      setApiKey('test')
      setAuthenticated(true, 'byok', true) // isDevMode = true
      return
    }

    // Validate format first (quick check)
    if (!isValidKeyFormat(key)) {
      setValidationState('error')
      setErrorMessage('Key should start with sk-or-')
      return
    }

    // Test the key with API
    setValidationState('validating')
    setErrorMessage('')

    const result = await validateApiKey(key)
    if (result.valid) {
      setApiKey(key)
      setAuthenticated(true, 'byok', false)
    } else {
      setValidationState('error')
      setErrorMessage(result.error || 'Invalid key')
    }
  }, [keyValue, setApiKey, setAuthenticated])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // Don't accept input while validating
        if (validationState === 'validating') return

        // When on BYOK option, handle typing
        if (selectedOption === 1) {
          if (key.name === 'return' && keyValue.trim()) {
            void handleKeySubmit()
            return
          } else if (key.name === 'backspace') {
            setKeyValue((prev) => prev.slice(0, -1))
            // Clear error when user starts editing
            if (validationState === 'error') {
              setValidationState('idle')
              setErrorMessage('')
            }
            return
          } else if ((key.meta || key.ctrl) && (key.name === 'v' || key.sequence === 'v')) {
            // Cmd+V (macOS) or Ctrl+V (Linux/Windows) - paste will be handled by onPaste event
            return
          } else if (key.sequence && !key.ctrl && !key.meta) {
            // Accept both single characters and pastes (multi-character sequences)
            setKeyValue((prev) => prev + key.sequence)
            // Clear error when user starts editing
            if (validationState === 'error') {
              setValidationState('idle')
              setErrorMessage('')
            }
            return
          }
        }

        // Handle menu navigation
        if (key.name === 'up' || key.name === 'k') {
          setSelectedOption(0)
          setKeyValue('')
          setValidationState('idle')
          setErrorMessage('')
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedOption(1)
        } else if (key.name === 'return') {
          if (selectedOption === 0) {
            // Sign in - coming soon
          }
        }
      },
      [keyValue, selectedOption, validationState, handleKeySubmit]
    )
  )

  // Calculate vertical centering
  const contentHeight = 22
  const paddingTop = Math.max(2, Math.floor((terminalHeight - contentHeight) / 2))

  return (
    <scrollbox
      scrollX={false}
      scrollY={false}
      scrollbarOptions={{ visible: false }}
      onPaste={handlePaste}
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
          <text style={{ fg: theme.foreground }}>Sign in with Sonder to use as part of your subscription</text>
          <text style={{ fg: theme.foreground }}>or connect an API key for usage-based billing</text>
          <text> </text>
          {/* Option 1: Sign in */}
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>{selectedOption === 0 ? '> ' : '  '}</text>
            <text style={{ fg: selectedOption === 0 ? theme.accent : theme.foreground }}>1. Sign in with Sonder</text>
          </box>
          <text style={{ fg: theme.muted }}>     Usage included with subscription</text>
          <text> </text>
          {/* Option 2: BYOK */}
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: theme.muted }}>{selectedOption === 1 ? '> ' : '  '}</text>
            <text style={{ fg: selectedOption === 1 ? theme.accent : theme.foreground }}>2. </text>
            {selectedOption === 1 ? (
              <>
                <text style={{ fg: validationState === 'error' ? '#ef4444' : theme.accent }}>
                  {keyValue ? '*'.repeat(Math.min(keyValue.length, 40)) : ''}
                </text>
                {validationState === 'validating' ? (
                  <text style={{ fg: theme.muted }}> validating...</text>
                ) : (
                  <text style={{ fg: validationState === 'error' ? '#ef4444' : theme.accent }}>_</text>
                )}
              </>
            ) : (
              <text style={{ fg: theme.foreground }}>Provide your own API key</text>
            )}
          </box>
          <text style={{ fg: theme.muted }}>     Pay for what you use</text>
          <text> </text>
          {/* Error message or hint */}
          {validationState === 'error' && errorMessage ? (
            <text style={{ fg: '#ef4444' }}>{errorMessage}</text>
          ) : (
            <text style={{ fg: theme.muted }}>Press Enter to continue</text>
          )}
        </box>
      </box>
    </scrollbox>
  )
}

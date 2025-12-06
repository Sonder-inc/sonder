/**
 * QuestionWizard - Multi-step question UI with selectable options
 *
 * Used by the interrogator agent to clarify ambiguous requests.
 * Displays questions in a wizard-style format with navigation.
 */

import { useState, useCallback, useEffect } from 'react'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useTheme } from '../hooks/use-theme'
import type { QuestionWizardData } from '../types/chat'

export type QuestionWizardProps = QuestionWizardData

export const QuestionWizard = ({ questions, onComplete, onCancel }: QuestionWizardProps) => {
  const theme = useTheme()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [customInput, setCustomInput] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)

  // Blink cursor when on "Type something" option
  const isOnCustomOption = selectedOptionIndex === questions[currentQuestionIndex].options.length
  useEffect(() => {
    if (!isOnCustomOption) return
    const interval = setInterval(() => setCursorVisible(v => !v), 500)
    return () => clearInterval(interval)
  }, [isOnCustomOption])

  const currentQuestion = questions[currentQuestionIndex]
  const totalOptions = currentQuestion.options.length + (currentQuestion.allowCustom !== false ? 1 : 0)

  // Handle keyboard navigation
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const isCustomOption = selectedOptionIndex === currentQuestion.options.length

        // Escape: cancel typing or cancel wizard
        if (key.name === 'escape') {
          if (isCustomOption && customInput) {
            setCustomInput('')
          } else {
            onCancel()
          }
          return
        }

        // When on custom option, handle typing
        if (isCustomOption && currentQuestion.allowCustom !== false) {
          if (key.name === 'return' && customInput.trim()) {
            const newAnswers = { ...answers, [currentQuestion.id]: customInput.trim() }
            setAnswers(newAnswers)
            setCustomInput('')

            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(currentQuestionIndex + 1)
              setSelectedOptionIndex(0)
            } else {
              onComplete(newAnswers)
            }
            return
          } else if (key.name === 'backspace') {
            setCustomInput(prev => prev.slice(0, -1))
            return
          } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
            setCustomInput(prev => prev + key.sequence)
            return
          }
        }

        // Navigation
        if (key.name === 'up' || key.name === 'k') {
          setSelectedOptionIndex(prev => Math.max(0, prev - 1))
          setCustomInput('')
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedOptionIndex(prev => Math.min(totalOptions - 1, prev + 1))
          setCustomInput('')
        } else if (key.name === 'left' || key.name === 'h') {
          if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1)
            setSelectedOptionIndex(0)
            setCustomInput('')
          }
        } else if (key.name === 'right' || key.name === 'l') {
          if (answers[currentQuestion.id] && currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
            setSelectedOptionIndex(0)
            setCustomInput('')
          }
        } else if (key.name === 'return' && !isCustomOption) {
          // Select regular option
          const selectedOption = currentQuestion.options[selectedOptionIndex]
          const newAnswers = { ...answers, [currentQuestion.id]: selectedOption.label }
          setAnswers(newAnswers)

          if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
            setSelectedOptionIndex(0)
          } else {
            onComplete(newAnswers)
          }
        } else if (key.name === 'tab') {
          setSelectedOptionIndex(prev => (prev + 1) % totalOptions)
          setCustomInput('')
        }
      },
      [
        currentQuestion,
        currentQuestionIndex,
        selectedOptionIndex,
        totalOptions,
        answers,
        customInput,
        questions.length,
        onComplete,
        onCancel,
      ]
    )
  )

  const allAnswered = questions.every(q => answers[q.id] !== undefined)
  const canGoRight = answers[currentQuestion.id] && currentQuestionIndex < questions.length - 1

  return (
    <box style={{ flexDirection: 'column', marginLeft: 1 }}>
      {/* Header */}
      <box style={{ flexDirection: 'row', marginBottom: 1 }}>
        <text style={{ fg: currentQuestionIndex > 0 ? theme.foreground : theme.muted }}>{'← '}</text>
        {questions.map((q, idx) => {
          const isComplete = answers[q.id] !== undefined
          const isCurrent = idx === currentQuestionIndex
          const icon = isComplete ? '■' : '□'
          const color = isCurrent ? theme.accent : isComplete ? theme.success : theme.muted
          return (
            <text key={q.id} style={{ fg: color }}>
              {icon} {q.header}{idx < questions.length - 1 ? ' ' : ''}
            </text>
          )
        })}
        <text style={{ fg: allAnswered ? theme.success : theme.muted }}> {allAnswered ? '✓' : '○'} Submit</text>
        <text style={{ fg: canGoRight ? theme.foreground : theme.muted }}> →</text>
      </box>

      {/* Question */}
      <text style={{ fg: theme.foreground, marginBottom: 1 }}>{currentQuestion.question}</text>

      {/* Options */}
      <box style={{ flexDirection: 'column', marginTop: 1 }}>
        {currentQuestion.options.map((option, idx) => {
          const isSelected = idx === selectedOptionIndex
          const prefix = isSelected ? '❯' : ' '
          const num = idx + 1
          return (
            <box key={option.label} style={{ flexDirection: 'column' }}>
              <box style={{ flexDirection: 'row' }}>
                <text style={{ fg: isSelected ? theme.accent : theme.muted }}>{prefix} </text>
                <text style={{ fg: isSelected ? theme.accent : theme.foreground }}>{num}. {option.label}</text>
              </box>
              {option.description && (
                <text style={{ fg: theme.muted, marginLeft: 4 }}>{option.description}</text>
              )}
            </box>
          )
        })}
        {currentQuestion.allowCustom !== false && (
          <box style={{ flexDirection: 'column' }}>
            <box style={{ flexDirection: 'row' }}>
              <text style={{ fg: isOnCustomOption ? theme.accent : theme.muted }}>
                {isOnCustomOption ? '❯' : ' '}{' '}
              </text>
              <text style={{ fg: isOnCustomOption ? theme.accent : theme.foreground }}>
                {currentQuestion.options.length + 1}.{' '}
              </text>
              {!isOnCustomOption && (
                <text style={{ fg: theme.muted }}>Type something.</text>
              )}
            </box>
            {isOnCustomOption && (
              <text style={{ fg: theme.foreground, marginLeft: 4 }}>
                {customInput.length > 60 ? '...' + customInput.slice(-57) : customInput}
                <span style={{ fg: cursorVisible ? theme.accent : theme.background }}>_</span>
              </text>
            )}
          </box>
        )}
      </box>

      {/* Footer */}
      <text style={{ fg: theme.muted, marginTop: 2 }}>
        {isOnCustomOption
          ? 'Enter to submit · Esc to clear'
          : 'Enter to select · Tab/Arrow keys to navigate · Esc to cancel'}
      </text>
    </box>
  )
}

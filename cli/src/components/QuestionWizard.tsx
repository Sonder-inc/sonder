/**
 * QuestionWizard - Multi-step question UI with selectable options
 *
 * Used by the interrogator agent to clarify ambiguous requests.
 * Displays questions in a wizard-style format with navigation.
 */

import { useState, useCallback } from 'react'
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
  const [isTyping, setIsTyping] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const currentQuestion = questions[currentQuestionIndex]
  const totalOptions = currentQuestion.options.length + (currentQuestion.allowCustom !== false ? 1 : 0)

  // Handle keyboard navigation
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // Handle custom input mode
        if (isTyping) {
          if (key.name === 'escape') {
            setIsTyping(false)
            setCustomInput('')
          } else if (key.name === 'return') {
            if (customInput.trim()) {
              const newAnswers = { ...answers, [currentQuestion.id]: customInput.trim() }
              setAnswers(newAnswers)
              setCustomInput('')
              setIsTyping(false)

              // Move to next question or complete
              if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1)
                setSelectedOptionIndex(0)
              } else {
                onComplete(newAnswers)
              }
            }
          } else if (key.name === 'backspace') {
            setCustomInput(prev => prev.slice(0, -1))
          } else if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
            setCustomInput(prev => prev + key.sequence)
          }
          return
        }

        // Navigation mode
        if (key.name === 'escape') {
          onCancel()
          return
        }

        if (key.name === 'up' || key.name === 'k') {
          setSelectedOptionIndex(prev => Math.max(0, prev - 1))
        } else if (key.name === 'down' || key.name === 'j') {
          setSelectedOptionIndex(prev => Math.min(totalOptions - 1, prev + 1))
        } else if (key.name === 'left' || key.name === 'h') {
          // Go to previous question
          if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1)
            setSelectedOptionIndex(0)
          }
        } else if (key.name === 'right' || key.name === 'l') {
          // Go to next question if answered
          if (answers[currentQuestion.id] && currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1)
            setSelectedOptionIndex(0)
          }
        } else if (key.name === 'return') {
          // Check if selecting "Type something" option
          const isCustomOption = selectedOptionIndex === currentQuestion.options.length
          if (isCustomOption && currentQuestion.allowCustom !== false) {
            setIsTyping(true)
            setCustomInput('')
          } else {
            // Select the option
            const selectedOption = currentQuestion.options[selectedOptionIndex]
            const newAnswers = { ...answers, [currentQuestion.id]: selectedOption.label }
            setAnswers(newAnswers)

            // Move to next question or complete
            if (currentQuestionIndex < questions.length - 1) {
              setCurrentQuestionIndex(currentQuestionIndex + 1)
              setSelectedOptionIndex(0)
            } else {
              onComplete(newAnswers)
            }
          }
        } else if (key.name === 'tab') {
          // Tab cycles through options
          setSelectedOptionIndex(prev => (prev + 1) % totalOptions)
        }
      },
      [
        currentQuestion,
        currentQuestionIndex,
        selectedOptionIndex,
        totalOptions,
        answers,
        isTyping,
        customInput,
        questions.length,
        onComplete,
        onCancel,
      ]
    )
  )

  const allAnswered = questions.every(q => answers[q.id] !== undefined)
  const canGoRight = answers[currentQuestion.id] && currentQuestionIndex < questions.length - 1

  // Render custom input mode
  if (isTyping) {
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

        <text style={{ fg: theme.foreground, marginBottom: 1 }}>{currentQuestion.question}</text>
        <box style={{ flexDirection: 'row', marginTop: 1 }}>
          <text style={{ fg: theme.accent }}>{'> '}</text>
          <text style={{ fg: theme.foreground }}>{customInput}</text>
          <text style={{ fg: theme.accent }}>_</text>
        </box>
        <text style={{ fg: theme.muted, marginTop: 2 }}>Enter to submit · Esc to cancel</text>
      </box>
    )
  }

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
          <box style={{ flexDirection: 'row' }}>
            <text style={{ fg: selectedOptionIndex === currentQuestion.options.length ? theme.accent : theme.muted }}>
              {selectedOptionIndex === currentQuestion.options.length ? '❯' : ' '}{' '}
            </text>
            <text style={{ fg: selectedOptionIndex === currentQuestion.options.length ? theme.accent : theme.foreground }}>
              {currentQuestion.options.length + 1}. Type something.
            </text>
          </box>
        )}
      </box>

      {/* Footer */}
      <text style={{ fg: theme.muted, marginTop: 2 }}>
        Enter to select · Tab/Arrow keys to navigate · Esc to cancel
      </text>
    </box>
  )
}

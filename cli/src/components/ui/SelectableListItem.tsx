/**
 * SelectableListItem - Reusable list item with selection state
 *
 * Used by CommandPanel, ContextPanel, ConfigPanel, SchoolModePanel
 */

import type { ReactNode } from 'react'
import { useTheme } from '../../hooks/use-theme'
import { ShimmerText } from '../shimmer-text'

export interface SelectableListItemProps {
  /** Primary text to display */
  text: string
  /** Optional description shown after primary text */
  description?: string
  /** Whether this item is currently selected */
  isSelected: boolean
  /** Optional key for React list rendering */
  itemKey?: string
  /** Custom content to render instead of text/description */
  children?: ReactNode
  /** Color for selected text (defaults to theme.foreground) */
  selectedColor?: string
  /** Color for unselected text (defaults to theme.foreground) */
  unselectedColor?: string
  /** Whether to show shimmer animation on selection */
  shimmer?: boolean
  /** Shimmer animation interval in ms */
  shimmerInterval?: number
}

export const SelectableListItem = ({
  text,
  description,
  isSelected,
  itemKey,
  children,
  selectedColor,
  unselectedColor,
  shimmer = true,
  shimmerInterval = 80,
}: SelectableListItemProps) => {
  const theme = useTheme()

  const selectedFg = selectedColor ?? theme.foreground
  const unselectedFg = unselectedColor ?? theme.foreground

  // Custom children override default rendering
  if (children) {
    return <text key={itemKey}>{children}</text>
  }

  return (
    <text key={itemKey}>
      {isSelected ? (
        <>
          {shimmer ? (
            <ShimmerText text={text} primaryColor={selectedFg} interval={shimmerInterval} />
          ) : (
            <span fg={selectedFg}>{text}</span>
          )}
          {description && <span fg={theme.accent}> {description}</span>}
        </>
      ) : (
        <>
          <span fg={unselectedFg}>{text}</span>
          {description && <span fg={theme.muted}> {description}</span>}
        </>
      )}
    </text>
  )
}

export interface SelectableListProps<T> {
  /** Items to render */
  items: T[]
  /** Currently selected index */
  selectedIndex: number
  /** Extract text from item */
  getText: (item: T) => string
  /** Extract description from item (optional) */
  getDescription?: (item: T) => string | undefined
  /** Extract unique key from item */
  getKey: (item: T) => string
  /** Whether to show shimmer animation */
  shimmer?: boolean
}

/**
 * Render a list of selectable items
 */
export function SelectableList<T>({
  items,
  selectedIndex,
  getText,
  getDescription,
  getKey,
  shimmer = true,
}: SelectableListProps<T>) {
  const clampedIndex = Math.min(selectedIndex, items.length - 1)

  return (
    <>
      {items.map((item, idx) => (
        <SelectableListItem
          key={getKey(item)}
          itemKey={getKey(item)}
          text={getText(item)}
          description={getDescription?.(item)}
          isSelected={idx === clampedIndex}
          shimmer={shimmer}
        />
      ))}
    </>
  )
}

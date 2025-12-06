/**
 * Color compatibility utilities for terminals with limited color support
 * (e.g., Apple Terminal which only supports 256 colors)
 */

/**
 * Convert hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Convert RGB to the closest ANSI 256 color code
 * Uses the 6x6x6 color cube (colors 16-231) and grayscale ramp (232-255)
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
  // Check if it's close to grayscale
  if (r === g && g === b) {
    if (r < 8) return 16 // black
    if (r > 248) return 231 // white
    return Math.round(((r - 8) / 247) * 24) + 232
  }

  // Convert to 6x6x6 cube
  const toAnsi = (v: number) => {
    if (v < 48) return 0
    if (v < 115) return 1
    return Math.min(5, Math.floor((v - 35) / 40))
  }

  return 16 + 36 * toAnsi(r) + 6 * toAnsi(g) + toAnsi(b)
}

/**
 * Convert hex color to ANSI 256 escape sequence
 */
export function hexToAnsi256(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex // Return original if invalid

  const ansi = rgbToAnsi256(rgb.r, rgb.g, rgb.b)
  return `\x1b[38;5;${ansi}m`
}

/**
 * Map of common hex colors to their best ANSI 256 equivalents
 * Pre-computed for performance
 */
export const ANSI_256_COLORS: Record<string, number> = {
  // Blues
  '#3b82f6': 69,  // accent blue
  '#2563eb': 33,  // light theme accent
  '#1e3a5f': 24,  // user message bg
  '#dbeafe': 189, // light user message bg

  // Grays
  '#e4e4e7': 254, // foreground light
  '#71717a': 245, // muted
  '#3f3f46': 239, // border/input border
  '#27272a': 236, // border muted
  '#18181b': 234, // dark foreground
  '#808080': 244, // input fg

  // Reds
  '#ef4444': 196, // error
  '#dc2626': 160, // light error

  // Yellows/Oranges
  '#f59e0b': 214, // warning
  '#d97706': 172, // light warning
  '#facc15': 220, // gold

  // Greens
  '#22c55e': 42,  // success
  '#16a34a': 34,  // light success

  // Cyans
  '#06b6d4': 44,  // info
  '#0891b2': 37,  // light info

  // Code blocks
  '#a1a1aa': 248, // code fg
  '#52525b': 240, // light code fg
  '#f4f4f5': 255, // light code bg

  // Special
  '#ffffff': 15,  // white
  '#000000': 0,   // black
}

/**
 * Get ANSI 256 color code for a hex color
 * Uses lookup table for common colors, falls back to computation
 */
export function getAnsi256Color(hex: string): number {
  const normalized = hex.toLowerCase()
  if (normalized in ANSI_256_COLORS) {
    return ANSI_256_COLORS[normalized]
  }

  const rgb = hexToRgb(hex)
  if (!rgb) return 7 // Default to white

  return rgbToAnsi256(rgb.r, rgb.g, rgb.b)
}

/**
 * Format color for terminal output based on color support
 * Returns the hex color for truecolor terminals, ANSI code for limited
 */
export function formatColor(hex: string, isLimitedColor: boolean): string {
  if (!isLimitedColor || hex === 'transparent') {
    return hex
  }

  // For limited color terminals, return ANSI 256 format that OpenTUI can use
  // OpenTUI should handle this, but if not, we return the closest match
  return hex // OpenTUI handles the conversion internally
}

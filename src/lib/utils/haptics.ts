// Haptic feedback helper — wraps navigator.vibrate for Android.
// No-op on iOS (not supported) and SSR. Use sparingly: add-to-cart, tab switches.

export type HapticPattern = 'light' | 'medium' | 'success' | 'error'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  success: [15, 50, 15],
  error: [50, 100, 50],
}

export function vibrate(pattern: HapticPattern = 'light'): void {
  if (typeof window === 'undefined') return
  if (!navigator.vibrate) return
  try {
    navigator.vibrate(PATTERNS[pattern])
  } catch {
    // Some browsers throw on unsupported patterns
  }
}

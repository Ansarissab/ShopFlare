import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns '#000000' or '#ffffff' — whichever has higher contrast with the given hex color.
 *  Uses WCAG 2.1 relative luminance. */
export function contrastColor(hex: string): '#000000' | '#ffffff' {
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  const r = toLinear(parseInt(hex.slice(1, 3), 16) / 255)
  const g = toLinear(parseInt(hex.slice(3, 5), 16) / 255)
  const b = toLinear(parseInt(hex.slice(5, 7), 16) / 255)
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.179 ? '#000000' : '#ffffff'
}

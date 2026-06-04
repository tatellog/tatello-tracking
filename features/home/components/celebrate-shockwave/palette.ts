import { colors } from '@/theme'

/*
 * The three tones of the celebration flash. Kept here so each layer
 * can import the rgb triplets without re-running the hex parser.
 *
 *   • CREAM   — the hero white at the very centre (colors.leche).
 *   • GOLD    — warm bronze (#D9AE6F) — same hex the constellation
 *     card border + zodiac art halo use, so the flash ties to the
 *     SAME light source already on screen instead of inventing a new
 *     palette mid-celebration.
 *   • MAGENTA — the fade-out tail (colors.magenta), matches the
 *     home tab's accent.
 */

function rgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

export const CREAM = rgb(colors.leche)
export const MAGENTA = rgb(colors.magenta)
export const GOLD = '217,174,111' // #D9AE6F

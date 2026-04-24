/*
 * Sprint 2 palette — "cream, forest, copper, gold".
 *
 * Four families:
 *   cream    — warm backgrounds, paper surfaces
 *   forest   — primary text, deep card surfaces
 *   copper   — accent (today's cell, primary CTAs)
 *   gold     — tertiary labels, dividers, subtle UI chrome
 *
 * Plus a small set of alpha utilities for overlays, dashed borders,
 * and shadows. No hex literals live in components — if you need a
 * color, add it here first.
 */
export const colors = {
  // Cream / background family
  creamWarm: '#F7F1E6',
  creamSoft: '#F5EFE4',
  creamDeep: '#F2EBDC',
  creamShade: '#EFE6D3',
  creamPaper: '#FAF4E8',
  creamShelf: '#F5EED9',

  // Forest / primary text
  forestDeep: '#15302A',
  forestMid: '#1A3C34',
  forestShade: '#0F241F',
  forestSoft: '#3E4841',

  // Copper / accent
  copperBright: '#D97847',
  copperVivid: '#B8633D',
  copperShade: '#9A4E2D',

  // Gold / tertiary
  goldBurnt: '#8B6F3E',
  goldSoft: '#A89B84',
  goldMute: '#C1B7A3',
  goldDivider: '#C9BFA8',

  // Alpha utilities
  overlayWhite35: 'rgba(255, 255, 255, 0.35)',
  overlayWhite40: 'rgba(255, 255, 255, 0.40)',
  overlayWhite60: 'rgba(255, 255, 255, 0.60)',
  goldAlpha08: 'rgba(139, 111, 62, 0.08)',
  goldAlpha10: 'rgba(139, 111, 62, 0.10)',
  goldAlpha12: 'rgba(139, 111, 62, 0.12)',
  goldAlpha18: 'rgba(139, 111, 62, 0.18)',
  goldAlpha20: 'rgba(139, 111, 62, 0.20)',
  goldAlpha25: 'rgba(139, 111, 62, 0.25)',
  forestAlpha08: 'rgba(21, 48, 42, 0.08)',
  forestAlpha15: 'rgba(21, 48, 42, 0.15)',
  copperShadow: 'rgba(184, 99, 61, 0.35)',
} as const

export type ColorToken = keyof typeof colors

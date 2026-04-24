/*
 * Palette — additive across sprints.
 *
 * Sprint 2 families (core):
 *   cream   — warm backgrounds, paper surfaces
 *   forest  — primary text, deep card surfaces
 *   copper  — accent (macros rings, log-meal CTA)
 *   gold    — tertiary labels, dividers, subtle UI chrome
 *
 * Sprint 2 tarea-9-replacement (checkin bar) additions:
 *   ink     — dark surface for the workout checkin bar
 *   pearl   — light text over ink, elevated surface for the
 *             completed bar
 *   mauve   — today's cell + the 'entrené' button (replaces the
 *             previous copper treatment on the today cell; copper
 *             stays as the macros accent)
 *   feedback — moss green for success/completed states
 *
 * Plus alpha utilities for overlays, dashed borders, and shadows.
 * No hex literals live in components — if you need a color, add
 * it here first.
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

  // Copper / macros accent
  copperBright: '#D97847',
  copperVivid: '#B8633D',
  copperShade: '#9A4E2D',

  // Gold / tertiary
  goldBurnt: '#8B6F3E',
  goldSoft: '#A89B84',
  goldMute: '#C1B7A3',
  goldDivider: '#C9BFA8',

  // Ink / checkin bar dark surface
  inkDark: '#1E1E1E',
  inkDarkHighlight: '#2B2B2B',
  inkPrimary: '#1E1E1E',

  // Pearl / text over ink + elevated completed surface
  pearlBase: '#F6F2EA',
  pearlElevated: '#FBF8F2',

  // Mauve / today accent + entrené button
  mauveLight: '#D8A7B8',
  mauveDeep: '#A97082',

  // Feedback (moss green success)
  feedbackSuccess: '#6E8D72',

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

  // Ink/mauve/feedback alpha utilities (checkin bar chrome)
  labelDim: 'rgba(246, 242, 234, 0.55)',
  borderSubtle: 'rgba(30, 30, 30, 0.08)',
  mauveShadow: 'rgba(169, 112, 130, 0.38)',
  mauveAlpha20: 'rgba(169, 112, 130, 0.20)',
  feedbackSuccessSoft: 'rgba(110, 141, 114, 0.12)',
} as const

export type ColorToken = keyof typeof colors

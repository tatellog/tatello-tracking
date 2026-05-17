/**
 * Norte palette — warm dark sweat + magenta accent.
 *
 * Discipline rules:
 *   - No raw hex in components. Always pull from this token set.
 *   - Magenta appears at most twice per screen (one CTA + one
 *     emphasised word). If it spreads, it loses voice.
 *   - The legacy Pearl Mauve aliases (pearlBase, mauveDeep, …) are
 *     value-mapped to their Norte equivalents so untouched features
 *     stay coherent without a per-file refactor. Treat them as
 *     deprecated; reach for the canonical names below in new code.
 */
export const colors = {
  // ── Surfaces ───────────────────────────────────────────────────
  bg: '#0A0608',
  bgCard: '#14080B',
  bgCard2: '#1F0E13',

  // ── Foreground (cream tones on dark) ───────────────────────────
  leche: '#F4ECDE',
  bone: '#C9B8A5',
  niebla: '#8A7570',
  bruma: '#4F3A3D',

  // ── Magenta accent ─────────────────────────────────────────────
  magenta: '#E91E63',
  magentaHot: '#FF4886',
  magentaDeep: '#A6164A',
  magentaGlow: 'rgba(233, 30, 99, 0.45)',
  magentaTint: 'rgba(233, 30, 99, 0.10)',
  magentaTint2: 'rgba(233, 30, 99, 0.18)',

  // ── Hairlines (alpha over leche) ───────────────────────────────
  hairline: 'rgba(244, 236, 222, 0.10)',
  hairlineStrong: 'rgba(244, 236, 222, 0.22)',

  // ── Feedback ───────────────────────────────────────────────────
  feedbackSuccess: '#5A6F4C',
  feedbackError: '#B85045',

  // ── Scan beam — the AI scan-line light sweep ───────────────────
  beamTint: 'rgba(255, 72, 134, 0.32)',
  beamLine: 'rgba(255, 140, 180, 0.55)',

  // ── Scrim — a dark wash for chips sitting over a photo ─────────
  scrim: 'rgba(0, 0, 0, 0.55)',

  // ── Legacy Pearl Mauve aliases (deprecated — see file header) ──
  /** @deprecated Use `bg` */
  pearlBase: '#0A0608',
  /** @deprecated Use `bgCard` */
  pearlElevated: '#14080B',
  /** @deprecated Use `bgCard2` */
  pearlMuted: '#1F0E13',
  /** @deprecated Use `leche` */
  inkPrimary: '#F4ECDE',
  /** @deprecated Use `bone` */
  inkSoft: '#C9B8A5',
  /** @deprecated Use `niebla` */
  labelMuted: '#8A7570',
  /** @deprecated Use `bruma` */
  labelDim: '#4F3A3D',
  /** @deprecated Use `magentaHot` */
  mauveLight: '#FF4886',
  /** @deprecated Use `magenta` */
  mauveDeep: '#E91E63',
  /** @deprecated Use `magentaGlow` */
  mauveShadow: 'rgba(233, 30, 99, 0.45)',
  /** @deprecated Use `magentaTint` */
  mauveTinted: 'rgba(233, 30, 99, 0.10)',
  /** @deprecated Use `bruma` */
  mauveBorderSoft: '#4F3A3D',
  /** @deprecated Use `hairline` */
  borderSubtle: 'rgba(244, 236, 222, 0.10)',
  /** @deprecated Use `bruma` */
  borderDashed: '#4F3A3D',
  /** @deprecated Use `bg` */
  inkDark: '#0A0608',
  /** @deprecated Use `bgCard` */
  inkDarkHighlight: '#14080B',
  /** @deprecated Use `bg` shadow tokens directly */
  shadowCard: 'rgba(0, 0, 0, 0.4)',
  /** @deprecated Use `bg` shadow tokens directly */
  shadowLift: 'rgba(0, 0, 0, 0.55)',
  /** @deprecated Use `bgCard` */
  cameraDark: '#14080B',
  /** @deprecated Use `bg` */
  cameraDarkBottom: '#0A0608',
} as const

export type ColorToken = keyof typeof colors

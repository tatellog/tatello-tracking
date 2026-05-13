/*
 * Norte — warm dark sweat + magenta accent.
 *
 * Filosofía: anti-fitness-bro, anti-gamification, anti-aspirational.
 * El producto es básicamente bicromático: cream (`leche`) + magenta
 * sobre un casi-negro cálido (`bg`). El magenta aparece a lo sumo dos
 * veces por pantalla — si se esparce, pierde voz.
 *
 * Reglas duras:
 *   - Cero hex sueltos en componentes; todo color va via tokens.
 *   - Magenta sólo para CTA primario + palabra italic destacada.
 *   - Hairlines (líneas decorativas) van con alpha sobre `leche`,
 *     no sólido `bruma` — eso lo reservamos para placeholders.
 *
 * Nota de compatibilidad: durante la transición de Pearl Mauve a
 * Norte, los nombres viejos siguen exportados pero apuntan a sus
 * equivalentes Norte. Código nuevo debe usar los nombres canónicos
 * (`bg`, `leche`, `magenta`, etc.). El alias permite que features
 * pre-existentes (home/brief/macros/...) sigan renderizando sin
 * tener que re-tocar cada `colors.pearlBase` simultáneamente.
 */
export const colors = {
  // ── Norte canonical surfaces ────────────────────────────────────
  bg: '#0A0608',
  bgCard: '#14080B',
  bgCard2: '#1F0E13',

  // ── Norte foreground (cream tones on dark) ──────────────────────
  leche: '#F4ECDE',
  bone: '#C9B8A5',
  niebla: '#8A7570',
  bruma: '#4F3A3D',

  // ── Magenta accent (use sparingly) ──────────────────────────────
  magenta: '#E91E63',
  magentaHot: '#FF4886',
  magentaDeep: '#A6164A',
  magentaGlow: 'rgba(233, 30, 99, 0.45)',
  magentaTint: 'rgba(233, 30, 99, 0.10)',
  magentaTint2: 'rgba(233, 30, 99, 0.18)',

  // ── Hairlines (alpha over leche) ────────────────────────────────
  hairline: 'rgba(244, 236, 222, 0.10)',
  hairlineStrong: 'rgba(244, 236, 222, 0.22)',

  // ── Legacy aliases (Pearl Mauve → Norte) ────────────────────────
  // Mapped so existing screens render cohesively in the new palette
  // without per-file refactor. New code should prefer the canonical
  // names above.
  pearlBase: '#0A0608',
  pearlElevated: '#14080B',
  pearlMuted: '#1F0E13',
  pearlGradientEnd: '#14080B',

  inkPrimary: '#F4ECDE',
  inkSoft: '#C9B8A5',
  labelMuted: '#8A7570',
  labelDim: '#4F3A3D',

  mauveLight: '#FF4886',
  mauveDeep: '#E91E63',
  mauveShadow: 'rgba(233, 30, 99, 0.45)',
  mauveTinted: 'rgba(233, 30, 99, 0.10)',
  mauveBorderSoft: '#4F3A3D',

  borderSubtle: 'rgba(244, 236, 222, 0.10)',
  borderDashed: '#4F3A3D',

  inkDark: '#0A0608',
  inkDarkHighlight: '#14080B',

  shadowCard: 'rgba(0, 0, 0, 0.4)',
  shadowLift: 'rgba(0, 0, 0, 0.55)',

  feedbackSuccess: '#5A6F4C',
  feedbackError: '#B85045',

  cameraDark: '#14080B',
  cameraDarkBottom: '#0A0608',
} as const

export type ColorToken = keyof typeof colors

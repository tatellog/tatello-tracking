/* Etiquetas del objetivo (monthly_focus) para mostrarlo fuera del wizard:
 * Perfil lo muestra y lo edita. Vivía en Ajustes hasta el 26 sep 2026. */
/** monthly_focus → settings display, mirrors the wizard's intention
 *  step. The 5 ACTIVE options (weight/energy/food/patterns/other) carry
 *  the EXACT same label + tagline the user saw in the wizard, so Settings
 *  reads as a continuation of that voice. sleep/cycle/mind are INERT —
 *  pruned from the wizard UI but kept here so legacy rows that still carry
 *  those values render a label instead of falling through to null. */
export const FOCUS_LABEL: Record<string, { label: string; tagline: string }> = {
  weight: { label: 'Bajar de peso', tagline: 'Stelar trabaja para que se sostenga.' },
  energy: { label: 'Recuperar mi energía', tagline: 'De tu energía nace la constancia.' },
  food: { label: 'Entender cómo me alimento', tagline: 'Qué se repite alrededor de comer.' },
  patterns: { label: 'Entender mis patrones', tagline: 'Qué hace los viernes distintos.' },
  other: { label: 'Algo más', tagline: 'La nombras tú.' },
  // ── Inert: pruned from the wizard UI, kept for legacy rows only. ──
  sleep: { label: 'Dormir profundo', tagline: 'La noche se vuelve descanso' },
  cycle: { label: 'Conocer mi ciclo', tagline: 'Tu cuerpo va a hablarte' },
  mind: { label: 'Calmar la mente', tagline: 'Menos ruido por dentro' },
}

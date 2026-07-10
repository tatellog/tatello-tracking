import * as monthBuilt from '../month-built'

/*
 * GUARDRAIL de convergencia (Epic 01 · F6 · T6.1).
 *
 * `month-built.ts` es el motor de Mes solo-cliente DIVERGENTE que CLAUDE.md marca
 * para converger a `supabase/functions/_shared/intelligence/` (donde vive la IA
 * server-side de Fase B). Regla del repo: "NO agregues detectores nuevos a
 * month-built.ts — van a _shared/intelligence/".
 *
 * La convergencia física está DIFERIDA (ver docs/adr/0002-*): mover las ~1800
 * líneas arrastra `features/patterns/consistency.ts` (otra épica) y multiplica
 * los motores de "mes" en _shared. Mientras tanto, este test CONGELA la
 * superficie: si alguien agrega (o quita) una función exportada de month-built,
 * falla y obliga a una decisión consciente — un detector NUEVO debe nacer en
 * `_shared/intelligence/`, no aquí. Si el cambio es legítimo (p. ej. converger
 * una función a _shared), actualiza esta lista con intención.
 */
const FROZEN_FN_EXPORTS = [
  'comboPhrase',
  'comboReveal',
  'correlationForKind',
  'daysInDeficit',
  'deficitTrajectoryRead',
  'detectMonthPatterns',
  'finalPhrase',
  'habitReveal',
  'monthCalendar',
  'monthChange',
  'monthConsistency',
  'monthDiscoveries',
  'monthReveals',
  'monthShiftSummary',
  'monthVerdict',
  'presenceSummary',
  'proteinAdherence',
  'revealDayMap',
  'revealFocus',
  'weeklyComboLever',
  'winningCombo',
] as const

describe('month-built · guardrail de convergencia (F6)', () => {
  it('la superficie de funciones está congelada (detectores nuevos van a _shared)', () => {
    const actual = Object.entries(monthBuilt)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
      .sort()
    expect(actual).toEqual([...FROZEN_FN_EXPORTS])
  })
})

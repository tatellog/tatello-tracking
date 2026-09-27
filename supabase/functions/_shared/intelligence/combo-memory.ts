/*
 * Qué patrones "ya existían" para la histéresis de winningCombo (dueña 26 sep
 * 2026: un patrón mostrado no muere por un solo día). PURO.
 *
 * Una combinación cuenta como ya mostrada si NACIÓ (vara completa de 15 puntos)
 * en alguno de los últimos `lookbackDays` días: se recalcula la ventana
 * cortada en cada uno de esos días. Así la memoria no depende del teléfono y
 * cubre los patrones que se vieron antes de que existiera la memoria local.
 */
import { winningCombo } from './month-built.ts'
import type { DailySignals } from './types.ts'

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function comboKey(keys: readonly string[]): string {
  return [...keys].sort().join('+')
}

export function combosBornRecently(
  signals: readonly DailySignals[],
  opts: {
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
  todayIso: string,
  lookbackDays = 14,
): string[] {
  const out = new Set<string>()
  for (let k = 1; k <= lookbackDays; k++) {
    const cut = addDaysIso(todayIso, -k)
    const c = winningCombo(
      signals.filter((s) => s.day != null && s.day <= cut),
      opts,
    )
    if (c) out.add(comboKey(c.signals.map((s) => s.key)))
  }
  return [...out]
}

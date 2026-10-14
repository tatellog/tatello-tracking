/*
 * La elección PURA del hallazgo protagonista (ST-007): la usan Descubre (su
 * feed) y Hoy (el destacado) vía `useFeaturedDiscovery`. Sin hooks: testeable.
 */
import { comboKey } from './combo-memory'
import type { MonthPattern, WinningCombo } from './month-built'
import type { Surprise } from './surprise'

export type FeaturedDiscovery =
  | { kind: 'surprise'; id: string; surprise: Surprise }
  | { kind: 'combo'; id: string; combo: WinningCombo }
  | { kind: 'pattern'; id: string; pattern: MonthPattern }

/** Patrones de apoyo: se excluye lo que ya dijo el combo y se ordena por
 *  relevancia (déficit es el norte). Tope: 2 con combo, 3 sin él. */
export function pickSupportPatterns(
  all: MonthPattern[],
  combo: WinningCombo | null,
): MonthPattern[] {
  const comboKeys = new Set(combo?.signals.map((s) => s.key) ?? [])
  const coveredByCombo = (id: string): boolean => {
    if (id === 'sleep-deficit') return comboKeys.has('sueno')
    if (id === 'training-protein') return comboKeys.has('cuerpo') && comboKeys.has('proteina')
    // El combo ya conecta movimiento con el déficit → no repetir.
    if (id === 'movement-deficit') return comboKeys.has('cuerpo')
    return false
  }
  const PRIORITY: Record<string, number> = {
    // La FALLA primero (dónde se rompe tu déficit) — es la promesa.
    'deficit-daytype': 0,
    // El par que conecta esfuerzo (movimiento) ↔ norte (déficit): alto valor.
    'movement-deficit': 1,
    'surplus-concentration': 2,
    'sleep-deficit': 3,
    'training-protein': 4,
  }
  return all
    .filter((p) => p.kind === 'pattern' && !coveredByCombo(p.id))
    .sort((a, b) => (PRIORITY[a.id] ?? 9) - (PRIORITY[b.id] ?? 9))
    .slice(0, combo ? 2 : 3)
}

/** Todo lo que el feed de Descubre muestra como hallazgo, en su orden:
 *  sorpresa → combo → patrones de apoyo. Es lo "calificado" de ST-008. */
export function qualifiedDiscoveries(
  surprise: Surprise | null,
  combo: WinningCombo | null,
  support: readonly MonthPattern[],
): FeaturedDiscovery[] {
  const out: FeaturedDiscovery[] = []
  if (surprise) out.push({ kind: 'surprise', id: surprise.id, surprise })
  if (combo) out.push({ kind: 'combo', id: comboKey(combo.signals.map((x) => x.key)), combo })
  for (const p of support) out.push({ kind: 'pattern', id: p.id, pattern: p })
  return out
}

/** El protagonista, en el orden del feed: sorpresa → combo → primer patrón. */
export function featuredOf(
  surprise: Surprise | null,
  combo: WinningCombo | null,
  support: readonly MonthPattern[],
): FeaturedDiscovery | null {
  return qualifiedDiscoveries(surprise, combo, support)[0] ?? null
}

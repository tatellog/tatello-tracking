import type { BodyMeasurement } from '@/features/brief/api'

import type { BodyComposition } from './api'

/*
 * Dev-only mock de body_measurements para EXPO_PUBLIC_SKIP_AUTH.
 *
 * Genera 8 puntos a lo largo de los últimos 60 días con un decline
 * suave (78.4 → 76.0 kg) más algo de ruido natural día-a-día. Es
 * suficiente para:
 *   - ≥3 puntos en cualquier rango (7d / 30d / 90d / all) → trend copy
 *   - delta visible
 *   - cuerva monotoneX no-trivial
 *
 * Tree-shaken cuando useMeasurements no entra al branch SKIP_AUTH.
 */
const DAY_MS = 24 * 60 * 60 * 1000

type Sample = { offsetDays: number; weight: number; waist?: number }

// Curva pensada para que cualquier corte de rango muestre evolución.
const SAMPLES: Sample[] = [
  { offsetDays: -60, weight: 78.4, waist: 78 },
  { offsetDays: -52, weight: 78.1 },
  { offsetDays: -42, weight: 77.6 },
  { offsetDays: -30, weight: 77.2, waist: 76.5 },
  { offsetDays: -21, weight: 76.9 },
  { offsetDays: -14, weight: 76.6 },
  { offsetDays: -7, weight: 76.4, waist: 75 },
  { offsetDays: 0, weight: 76.0, waist: 74 },
]

function sampleToMeasurement(s: Sample, now: Date): BodyMeasurement {
  const measuredAt = new Date(now)
  measuredAt.setDate(now.getDate() + s.offsetDays)
  measuredAt.setHours(8, 0, 0, 0)
  const iso = measuredAt.toISOString()
  return {
    id: `mock-${s.offsetDays}`,
    user_id: 'mock-user',
    measured_at: iso,
    weight_kg: s.weight,
    waist_cm: s.waist ?? null,
    chest_cm: null,
    hip_cm: null,
    thigh_cm: null,
    arm_cm: null,
    created_at: iso,
  }
}

export function buildMockMeasurements(rangeDays: number | null): BodyMeasurement[] {
  const now = new Date()
  const all = SAMPLES.map((s) => sampleToMeasurement(s, now))
  if (rangeDays == null) return all
  return all.filter((m) => {
    const ageDays = (now.getTime() - new Date(m.measured_at).getTime()) / DAY_MS
    return ageDays <= rangeDays + 0.5
  })
}

/*
 * Mock de composición corporal (WEARABLE_MOCK_DATA · dev-gated): la báscula
 * inteligente que aún no existe. Deja ver/validar Body (CompositionCards) y el
 * detector de recomposición SIN el dev build + HealthKit. Determinístico (sin
 * random) y con arco realista: grasa baja despacio, masa magra se sostiene —
 * junto al peso mock (estable-descendente), enciende `recomposition`.
 * NUNCA para beta: fabricar datos del cuerpo de una usuaria real rompe la
 * confianza — por eso el hook lo doble-gatea a dev (aiEnabledForEmail).
 */
type CompSample = { offsetDays: number; fat: number; lean: number }

const COMP_SAMPLES: CompSample[] = [
  { offsetDays: -42, fat: 32.6, lean: 47.6 },
  { offsetDays: -35, fat: 32.2, lean: 47.7 },
  { offsetDays: -28, fat: 31.8, lean: 47.7 },
  { offsetDays: -21, fat: 31.5, lean: 47.9 },
  { offsetDays: -14, fat: 31.1, lean: 48.0 },
  { offsetDays: -7, fat: 30.8, lean: 48.0 },
  { offsetDays: -2, fat: 30.5, lean: 48.1 },
]

/** IMC coherente con el peso mock (~76 kg / 1.65 m). */
const MOCK_BMI_BASE = 27.9

export function buildMockBodyComposition(rangeDays: number | null): BodyComposition[] {
  const now = new Date()
  const all = COMP_SAMPLES.map((s, i) => {
    const d = new Date(now)
    d.setDate(now.getDate() + s.offsetDays)
    return {
      day_date: d.toISOString().slice(0, 10),
      body_fat_pct: s.fat,
      lean_body_mass_kg: s.lean,
      bmi: Number((MOCK_BMI_BASE - i * 0.08).toFixed(1)),
    }
  })
  if (rangeDays == null) return all
  return all.filter((c) => {
    const age = (now.getTime() - new Date(`${c.day_date}T12:00:00`).getTime()) / DAY_MS
    return age <= rangeDays + 0.5
  })
}

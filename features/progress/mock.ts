import type { BodyMeasurement } from '@/features/brief/api'

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

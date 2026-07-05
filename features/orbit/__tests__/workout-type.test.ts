/* Detección por tipo de entreno (_shared/intelligence/workout-type) + su
 * integración en las tarjetas de Mes (month-built). */
import { isDeficitDay } from '../deficit'
import { detectMonthPatterns } from '../month-built'
import {
  workoutTypeDeficitSplit,
  workoutTypeLabel,
  workoutTypeMix,
  workoutTypeMixPhrase,
} from '../workout-type'
import { addDays, mkSig } from './signals.fixture'

const BASE = '2026-06-01'
const TARGET = 1800

/** n días consecutivos entrenados con tipo (y overrides opcionales). */
function typedDays(
  start: number,
  n: number,
  type: string | null,
  o: Parameters<typeof mkSig>[1] = {},
) {
  return Array.from({ length: n }, (_, i) =>
    mkSig(addDays(BASE, start + i), { trained: true, workout_type: type, ...o }),
  )
}

describe('workoutTypeLabel', () => {
  it('mapea los ids del catálogo y capitaliza los desconocidos', () => {
    expect(workoutTypeLabel('fuerza')).toBe('Fuerza')
    expect(workoutTypeLabel('caminata')).toBe('Caminata')
    expect(workoutTypeLabel('natación')).toBe('Natación')
  })
})

describe('workoutTypeMix', () => {
  it('null con menos de 2 entrenos tipados (un dato no es mezcla)', () => {
    expect(workoutTypeMix([...typedDays(0, 1, 'fuerza'), ...typedDays(1, 3, null)])).toBeNull()
  })

  it('ignora días no entrenados aunque traigan tipo residual', () => {
    const rows = [
      ...typedDays(0, 2, 'fuerza'),
      mkSig(addDays(BASE, 5), { trained: false, workout_type: 'cardio' }),
    ]
    const mix = workoutTypeMix(rows)
    expect(mix).not.toBeNull()
    expect(mix!.typedDays).toBe(2)
    expect(mix!.counts).toEqual([{ type: 'fuerza', label: 'Fuerza', days: 2 }])
  })

  it('ordena mayor primero y la frase es el eco literal', () => {
    const mix = workoutTypeMix([
      ...typedDays(0, 4, 'fuerza'),
      ...typedDays(4, 2, 'caminata'),
      ...typedDays(6, 1, 'cardio'),
    ])!
    expect(mix.typedDays).toBe(7)
    expect(mix.counts.map((c) => c.type)).toEqual(['fuerza', 'caminata', 'cardio'])
    expect(workoutTypeMixPhrase(mix)).toBe('4 de fuerza · 2 de caminata · 1 de cardio')
  })
})

describe('workoutTypeDeficitSplit', () => {
  const DEFICIT = { calories: 1600 } // dentro de [0.6×1800, 1800]
  const SURPLUS = { calories: 2200 }

  it('null sin muestra mínima por lado', () => {
    const rows = [...typedDays(0, 2, 'fuerza', DEFICIT), ...typedDays(2, 4, 'cardio', SURPLUS)]
    expect(workoutTypeDeficitSplit(rows, TARGET, isDeficitDay)).toBeNull()
  })

  it('null cuando la brecha no es marcada', () => {
    // Fuerza 2/3 vs otros 2/3 — misma tasa, nada que nombrar.
    const rows = [
      ...typedDays(0, 2, 'fuerza', DEFICIT),
      ...typedDays(2, 1, 'fuerza', SURPLUS),
      ...typedDays(3, 2, 'cardio', DEFICIT),
      ...typedDays(5, 1, 'cardio', SURPLUS),
    ]
    expect(workoutTypeDeficitSplit(rows, TARGET, isDeficitDay)).toBeNull()
  })

  it('nombra el mejor tipo contra el resto (incluye entrenos sin tipo)', () => {
    const rows = [
      ...typedDays(0, 4, 'fuerza', DEFICIT), // 4/4 en déficit
      ...typedDays(4, 2, 'cardio', SURPLUS),
      ...typedDays(6, 2, null, SURPLUS), // sin tipo → cuenta en "otros"
    ]
    const split = workoutTypeDeficitSplit(rows, TARGET, isDeficitDay)
    expect(split).toEqual({
      type: 'fuerza',
      label: 'Fuerza',
      bestDeficit: 4,
      bestTotal: 4,
      otherDeficit: 0,
      otherTotal: 4,
    })
  })
})

describe('detectMonthPatterns · integración del tipo', () => {
  it('la constancia de Movimiento incluye la mezcla como prueba', () => {
    // 9 entrenos tipados en ~2 semanas → constancia detectada + mezcla.
    const rows = [
      ...typedDays(0, 6, 'fuerza', { calories: 1600, meal_count: 2 }),
      ...typedDays(6, 3, 'caminata', { calories: 1600, meal_count: 2 }),
    ]
    const training = detectMonthPatterns(rows, { calorieTarget: TARGET }).find(
      (p) => p.id === 'consistent-training',
    )
    expect(training).toBeDefined()
    expect(training!.notes).toEqual(
      expect.arrayContaining(['Tu mezcla: 6 de fuerza · 3 de caminata']),
    )
  })

  it('emite workout-type-deficit cuando los datos lo sostienen', () => {
    const rows = [
      ...typedDays(0, 4, 'fuerza', { calories: 1600, meal_count: 2 }),
      ...typedDays(4, 4, 'cardio', { calories: 2200, meal_count: 2 }),
    ]
    const p = detectMonthPatterns(rows, { calorieTarget: TARGET }).find(
      (q) => q.id === 'workout-type-deficit',
    )
    expect(p).toBeDefined()
    expect(p!.kind).toBe('pattern')
    expect(p!.title).toBe('Tus días de fuerza, tu déficit apareció más seguido.')
    expect(p!.evidence.bars).toEqual([
      { label: 'Fuerza', value: 4, total: 4, colorKey: 'cuerpo', highlight: true },
      { label: 'Otros entrenos', value: 0, total: 4, colorKey: 'cuerpo' },
    ])
  })

  it('NO emite el patrón de tipo cuando nadie anotó tipos', () => {
    const rows = typedDays(0, 10, null, { calories: 1600, meal_count: 2 })
    const ids = detectMonthPatterns(rows, { calorieTarget: TARGET }).map((p) => p.id)
    expect(ids).not.toContain('workout-type-deficit')
  })
})

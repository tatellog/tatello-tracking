import {
  buildWeeklyReading,
  lastClosedWeekStart,
  weekHasReading,
  WEEKLY_READING_MIN_DAYS,
} from '../weekly-reading'

import { addDays, buildHistory, mkSig } from './signals.fixture'

// Lunes 2026-06-01 … domingo 2026-06-07 = la semana leída en estos tests.
const MONDAY = '2026-06-01'
const CTX = { calorieTarget: 1500, proteinTarget: 90 }

describe('lastClosedWeekStart', () => {
  it('desde cualquier día de la semana apunta al lunes anterior cerrado', () => {
    // Lunes 8 jun → semana cerrada = lunes 1 jun.
    expect(lastClosedWeekStart('2026-06-08')).toBe('2026-06-01')
    // Domingo 14 jun (fin de semana en curso) → sigue leyendo la del 1 jun.
    expect(lastClosedWeekStart('2026-06-14')).toBe('2026-06-01')
    // Miércoles 10 jun → lunes 1 jun.
    expect(lastClosedWeekStart('2026-06-10')).toBe('2026-06-01')
  })
})

describe('buildWeeklyReading — grados honestos', () => {
  it('calla (null) con menos de MIN_DAYS días con comida', () => {
    const signals = [
      mkSig(MONDAY, { calories: 1400 }),
      mkSig(addDays(MONDAY, 1), { calories: 1400 }),
    ]
    expect(buildWeeklyReading(signals, MONDAY, CTX)).toBeNull()
    expect(WEEKLY_READING_MIN_DAYS).toBe(3)
  })

  it('parcial: semana registrada sin pesajes suficientes para TDEE', () => {
    const signals = buildHistory(MONDAY, 7, () => ({ calories: 1400, protein_g: 60 }))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r).not.toBeNull()
    expect(r!.grade).toBe('parcial')
    expect(r!.tdee).toBeNull()
    expect(r!.paceKgWeek).toBeNull()
    expect(r!.daysWithFood).toBe(7)
    expect(r!.deficitDays).toBe(7)
    expect(r!.kcalAvg).toBe(1400)
    expect(r!.body.join(' ')).toContain('pesajes')
  })

  it('completa: con 28 días creíbles + pesajes en ambos extremos hay TDEE y ritmo', () => {
    // 5 semanas de historia terminando en la semana leída: comida diaria
    // creíble + pesajes al inicio y al final de la ventana de 28 días.
    const base = addDays(MONDAY, -28) // 4 semanas antes del lunes leído
    const signals = buildHistory(base, 35, (_m, i) => ({
      calories: 1500,
      protein_g: 85,
      // Racimos de pesajes: días 0-9 (82 kg) y días 25-34 (81.3 kg).
      ...(i < 10 ? { weight_kg: 82 } : {}),
      ...(i >= 25 ? { weight_kg: 81.3 } : {}),
    }))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r).not.toBeNull()
    expect(r!.grade).toBe('completa')
    expect(r!.tdee).not.toBeNull()
    expect(r!.paceKgWeek).not.toBeNull()
    expect(r!.body.join(' ')).toContain('gastado alrededor de')
    expect(r!.body.join(' ')).toContain('por semana')
  })
})

describe('buildWeeklyReading — palanca retrospectiva (una, con dato)', () => {
  it('finde alto → la palanca señala el finde', () => {
    const signals = buildHistory(MONDAY, 7, (monIdx) =>
      monIdx >= 5 ? { calories: 2100 } : { calories: 1400 },
    )
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.lever?.kind).toBe('finde')
  })

  it('entre semana firme y sin excesos → sostener el ritmo', () => {
    const signals = buildHistory(MONDAY, 7, (monIdx) => (monIdx < 5 ? { calories: 1400 } : null))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.lever?.kind).toBe('entre-semana')
  })

  it('sin meta calórica pero proteína sostenida → palanca de proteína', () => {
    const signals = buildHistory(MONDAY, 7, () => ({ calories: 1400, protein_g: 88 }))
    const r = buildWeeklyReading(signals, MONDAY, { calorieTarget: null, proteinTarget: 90 })
    expect(r!.lever?.kind).toBe('proteina')
    expect(r!.opening).not.toContain('en déficit')
  })

  it('sin señal suficiente → sin palanca (null), jamás relleno', () => {
    // Días alternados sobre la meta entre semana: ni finde alto dominante,
    // ni entre-semana firme, ni proteína registrada.
    const signals = buildHistory(MONDAY, 7, (monIdx) =>
      monIdx < 5 ? { calories: monIdx % 2 === 0 ? 1700 : 1300 } : null,
    )
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.lever).toBeNull()
  })
})

/* ST-010 · la Lectura cumple las reglas de integridad (dueña 14 oct 2026). */
describe('buildWeeklyReading — ST-010', () => {
  it('H1: días debajo del piso NO son "sostuviste tu meta"', () => {
    // Meta 1500 → banda sana [900, 1500]. 500 kcal no la sostiene.
    const signals = buildHistory(MONDAY, 7, (monIdx) => (monIdx < 5 ? { calories: 500 } : null))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.lever?.kind).not.toBe('entre-semana')
  })

  it('H4: la primera semana cuenta desde tu primer día, no "de 7"', () => {
    // Empezó el jueves: jue, vie, sáb, dom = 4 días posibles.
    const signals = buildHistory(addDays(MONDAY, 3), 4, () => ({ calories: 1400 }))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.opening).toContain('4 de 4 días con comida registrada')
  })

  it('H11: sin días en déficit no dice "0 en déficit"', () => {
    const signals = buildHistory(MONDAY, 7, () => ({ calories: 2000 }))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.deficitDays).toBe(0)
    expect(r!.opening).not.toContain('en déficit')
  })

  it('H6: la proteína de un desayuno suelto no cuenta para su palanca', () => {
    // 2 días completos con proteína alta + 3 parciales: no alcanza 3 completos.
    const signals = buildHistory(MONDAY, 5, (_m, i) =>
      i < 2 ? { calories: 1400, protein_g: 95 } : { calories: 300, protein_g: 90 },
    )
    const r = buildWeeklyReading(signals, MONDAY, { calorieTarget: null, proteinTarget: 90 })
    expect(r!.lever).toBeNull()
  })

  it('H7: un finde que pasó la meta pero comió menos que entre semana no es "lo más alto"', () => {
    const signals = buildHistory(MONDAY, 7, (monIdx) =>
      monIdx >= 5 ? { calories: 1600 } : { calories: monIdx === 2 ? 2600 : 2400 },
    )
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.lever?.kind).not.toBe('finde')
  })

  it('H5: sin gasto sólido no hay ritmo en kg', () => {
    // Sin pesajes: sin TDEE → sin ritmo (ya cubierto); aquí, gasto presente
    // pero el ritmo exige calidad sólida y días completos.
    const signals = buildHistory(MONDAY, 7, () => ({ calories: 1400 }))
    const r = buildWeeklyReading(signals, MONDAY, CTX)
    expect(r!.paceKgWeek).toBeNull()
    expect(r!.body.join(' ')).not.toContain('kg por semana')
  })
})

describe('weekHasReading (avisar sin generar · ST-010 H8)', () => {
  it('coincide con cuándo el motor habla o calla', () => {
    const three = buildHistory(MONDAY, 3, () => ({ calories: 1400 }))
    const two = buildHistory(MONDAY, 2, () => ({ calories: 1400 }))
    expect(weekHasReading(three, MONDAY)).toBe(buildWeeklyReading(three, MONDAY, CTX) != null)
    expect(weekHasReading(two, MONDAY)).toBe(false)
    expect(buildWeeklyReading(two, MONDAY, CTX)).toBeNull()
  })

  it('los días fuera de esa semana no cuentan', () => {
    const before = buildHistory(addDays(MONDAY, -3), 3, () => ({ calories: 1400 }))
    expect(weekHasReading(before, MONDAY)).toBe(false)
  })
})

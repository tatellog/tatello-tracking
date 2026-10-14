import { historyTrends } from '../logic'

const sig = (day: string, o: Record<string, unknown> = {}) =>
  ({ day, calories: null, protein_g: null, trained: null, meal_count: null, ...o }) as never

const ctx = { today: '2026-10-07', calorieTarget: 1500, proteinTarget: 120 }

describe('historyTrends · números con denominador', () => {
  // Periodo actual: 8 sep – 7 oct. 4 días con comida, 3 en déficit.
  const cur = [
    sig('2026-10-06', { calories: 1300, protein_g: 130, trained: true }), // martes
    sig('2026-10-05', { calories: 1400, protein_g: 100 }), // lunes
    sig('2026-10-04', { calories: 1350, protein_g: 90, trained: true }), // domingo
    sig('2026-09-20', { calories: 2100, protein_g: 60 }),
  ]

  test('déficit de tus días con comida, con el lado de la semana', () => {
    const t = historyTrends(cur, ctx)
    expect(t.deficit).toMatchObject({ value: 3, denom: 4, prev: null })
    expect(t.deficit!.highlight).toBe('Tus días en déficit fueron sobre todo entre semana.')
  })

  test('"antes" solo con 5+ días con dato', () => {
    const prev = Array.from({ length: 5 }, (_, i) =>
      sig(`2026-08-${String(10 + i).padStart(2, '0')}`, { calories: 1400, protein_g: 80 }),
    )
    const t = historyTrends([...cur, ...prev], ctx)
    expect(t.deficit!.prev).toEqual({ value: 5, denom: 5 })
    expect(t.protein!.prevAvg).toBe(80)
    expect(historyTrends([...cur, ...prev.slice(0, 2)], ctx).protein!.prevAvg).toBeNull()
  })

  test('registro, proteína y entreno', () => {
    const t = historyTrends(cur, ctx)
    // Desde que empezaste (20 sep) hasta ayer: 17 días; hoy sin comida no cuenta.
    expect(t.logging).toMatchObject({ value: 4, denom: 17 })
    expect(t.logging.highlight).toContain('(3 días)')
    expect(t.protein).toMatchObject({ avg: 95, n: 4, inTarget: 1, gap: 25 })
    expect(t.workouts.value).toBe(2)
    expect(t.workouts.weeks).toHaveLength(4)
    expect(t.workouts.weeks[3]!.days).toBe(2)
    expect(t.range.label).toBe('8 sep – 7 oct')
  })
})

test('summary nombra solo lo que mejoró contra el mes pasado', () => {
  const prev = [sig('2026-08-20', { calories: 1400 })]
  const cur = [
    sig('2026-10-06', { calories: 1300, trained: true }),
    sig('2026-10-05', { calories: 1400 }),
  ]
  const t = historyTrends([...cur, ...prev], ctx)
  expect(t.improved).toMatchObject({ logging: true, workouts: true })
  expect(t.summary).toBe('Este mes registraste comida y entrenaste más seguido que el mes pasado.')
  expect(historyTrends(prev, ctx).summary).toBeNull()
})

/*
 * ST-009 (dueña 14 oct 2026): denominadores desde que empezaste, hoy abierto
 * fuera del déficit, comparación por proporción y proteína de días completos.
 */
describe('historyTrends · ST-009', () => {
  test('una usuaria nueva no ve "N de 30": cuenta desde su primer día', () => {
    const t = historyTrends(
      [
        sig('2026-10-04', { calories: 1400 }),
        sig('2026-10-05', { calories: 1400, trained: true }),
        sig('2026-10-07', { calories: 1400 }),
      ],
      ctx,
    )
    // 4, 5, 6 + hoy (ya tiene comida) = 4 días.
    expect(t.logging).toMatchObject({ value: 3, denom: 4, prev: null })
    // Hoy sin entreno sigue abierto: 4, 5, 6 = 3 días.
    expect(t.workouts).toMatchObject({ value: 1, denom: 3, prev: null })
  })

  test('hoy abierto debajo del piso no entra al déficit; en la banda sí', () => {
    const base = [sig('2026-10-05', { calories: 1400 }), sig('2026-10-06', { calories: 1400 })]
    const open = historyTrends([...base, sig('2026-10-07', { calories: 300 })], ctx)
    expect(open.deficit).toMatchObject({ value: 2, denom: 2 })
    const inBand = historyTrends([...base, sig('2026-10-07', { calories: 1200 })], ctx)
    expect(inBand.deficit).toMatchObject({ value: 3, denom: 3 })
  })

  test('registrar más días no es "más déficit": se comparan proporciones', () => {
    // Mes pasado: 5 de 5 en déficit. Este mes: 6 de 10 (más días, menor tasa).
    const prev = Array.from({ length: 5 }, (_, i) =>
      sig(`2026-08-${String(10 + i).padStart(2, '0')}`, { calories: 1400 }),
    )
    const cur = Array.from({ length: 10 }, (_, i) =>
      sig(`2026-09-${String(10 + i).padStart(2, '0')}`, { calories: i < 6 ? 1400 : 2000 }),
    )
    const t = historyTrends([...prev, ...cur], ctx)
    expect(t.deficit).toMatchObject({ value: 6, denom: 10, prev: { value: 5, denom: 5 } })
    expect(t.improved.deficit).toBe(false)
  })

  test('la proteína promedia solo días completos', () => {
    const t = historyTrends(
      [
        sig('2026-10-05', { calories: 1400, protein_g: 120 }),
        sig('2026-10-06', { calories: 1400, protein_g: 100 }),
        // Un desayuno suelto: no baja el promedio.
        sig('2026-10-07', { calories: 300, protein_g: 15 }),
      ],
      ctx,
    )
    expect(t.protein).toMatchObject({ avg: 110, n: 2, gap: 10 })
  })
})

import { computeNourishmentConsistency } from '../nourishment'

// Ventana de 7 días, HOY al final ('2026-06-07' está abierto: no se juzga).
const DATES = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
]

describe('computeNourishmentConsistency', () => {
  it('protein: reached = closed logged days at >=90% of reference; logged excludes no-meal days', () => {
    const meals = [
      { meal_date: '2026-06-01', protein_g: 60 },
      { meal_date: '2026-06-01', protein_g: 60 }, // 120 >= 112 → reached
      { meal_date: '2026-06-02', protein_g: 105 }, // >= 90% de 112 (100.8) → reached
      { meal_date: '2026-06-03', protein_g: 80 }, // logged pero corto → short
    ]
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals,
      waterByDate: {},
      proteinTarget: 112,
      waterGoalGlasses: 8,
    })
    // 3 días cerrados con comidas (logged), 2 llegaron al 90% (reached).
    expect(res.protein).toMatchObject({ reached: 2, logged: 3, total: 7 })
    expect(res.protein?.days.slice(0, 4).map((d) => d.state)).toEqual([
      'reached',
      'reached',
      'short',
      'empty',
    ])
    // El ratio alimenta la ALTURA de la barra (capado a 1).
    expect(res.protein?.days[0]?.ratio).toBe(1) // 120/112 capado
    expect(res.protein?.days[2]?.ratio).toBeCloseTo(80 / 112)
    expect(res.protein?.days[3]?.ratio).toBe(0)
  })

  it('hoy (última fecha) está ABIERTO: no cuenta en reached/logged pero sí se dibuja', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [{ meal_date: '2026-06-07', protein_g: 200 }],
      waterByDate: { '2026-06-07': 8 },
      proteinTarget: 100,
      waterGoalGlasses: 8,
    })
    // Solo hoy tiene datos → el conteo de días cerrados queda en cero…
    expect(res.protein).toMatchObject({ reached: 0, logged: 0 })
    expect(res.agua).toMatchObject({ reached: 0, logged: 0 })
    // …pero la barra de hoy vive en directo.
    expect(res.protein?.days[6]).toMatchObject({ state: 'reached', ratio: 1 })
    expect(res.agua.days[6]).toMatchObject({ state: 'reached', ratio: 1 })
  })

  it('hides the protein row (null) when no reference is set', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [{ meal_date: '2026-06-01', protein_g: 200 }],
      waterByDate: {},
      proteinTarget: null,
      waterGoalGlasses: 8,
    })
    expect(res.protein).toBeNull()
  })

  it('agua: reached at >=90% of goal; days without water are empty, not short', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [],
      // goal 8 → bar 7.2: 8 y 9 reached, 5 short, días sin agua empty.
      waterByDate: { '2026-06-01': 8, '2026-06-02': 9, '2026-06-03': 5 },
      proteinTarget: null,
      waterGoalGlasses: 8,
    })
    expect(res.agua).toMatchObject({ reached: 2, logged: 3, total: 7 })
    expect(res.agua.days.slice(0, 4).map((d) => d.state)).toEqual([
      'reached',
      'reached',
      'short',
      'empty',
    ])
    expect(res.agua.days[2]?.ratio).toBeCloseTo(5 / 8)
  })

  it('ignores meals/water outside the window and exposes the targets', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [{ meal_date: '2026-05-20', protein_g: 200 }],
      waterByDate: { '2026-05-20': 12 },
      proteinTarget: 100,
      waterGoalGlasses: 8,
    })
    expect(res.protein).toMatchObject({ reached: 0, logged: 0, total: 7 })
    expect(res.agua).toMatchObject({ reached: 0, logged: 0 })
    expect(res.proteinTarget).toBe(100)
    expect(res.waterGoalGlasses).toBe(8)
  })
})

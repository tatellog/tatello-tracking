import { computeNourishmentConsistency } from '../nourishment'

const DATES = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
  '2026-06-08',
  '2026-06-09',
  '2026-06-10',
]

describe('computeNourishmentConsistency', () => {
  it('protein: reached = logged days at >=90% of reference; logged excludes no-meal days', () => {
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
    // 3 días con comidas (logged), 2 llegaron al 90% (reached).
    expect(res.protein).toMatchObject({ reached: 2, logged: 3, total: 10 })
    expect(res.protein?.days.slice(0, 4)).toEqual(['reached', 'reached', 'short', 'empty'])
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
    expect(res.agua).toMatchObject({ reached: 2, logged: 3, total: 10 })
    expect(res.agua.days.slice(0, 4)).toEqual(['reached', 'reached', 'short', 'empty'])
  })

  it('ignores meals/water outside the window', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [{ meal_date: '2026-05-20', protein_g: 200 }],
      waterByDate: { '2026-05-20': 12 },
      proteinTarget: 100,
      waterGoalGlasses: 8,
    })
    expect(res.protein).toMatchObject({ reached: 0, logged: 0, total: 10 })
    expect(res.agua).toMatchObject({ reached: 0, logged: 0 })
  })
})

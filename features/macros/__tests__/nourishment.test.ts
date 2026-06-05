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
  it('counts protein = days whose summed protein reached the reference', () => {
    const meals = [
      { meal_date: '2026-06-01', protein_g: 60 },
      { meal_date: '2026-06-01', protein_g: 60 }, // 120 >= 112 ✓
      { meal_date: '2026-06-02', protein_g: 100 }, // < 112 ✗
      { meal_date: '2026-06-03', protein_g: 112 }, // == 112 ✓
    ]
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals,
      waterByDate: {},
      proteinTarget: 112,
      waterGoalGlasses: 8,
    })
    expect(res.protein).toEqual({ hit: 2, total: 10 })
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

  it('counts agua = days that met the glass goal', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [],
      waterByDate: { '2026-06-01': 8, '2026-06-02': 9, '2026-06-03': 5 },
      proteinTarget: null,
      waterGoalGlasses: 8,
    })
    expect(res.agua).toEqual({ hit: 2, total: 10 })
  })

  it('ignores meals/water outside the window', () => {
    const res = computeNourishmentConsistency({
      dates: DATES,
      meals: [{ meal_date: '2026-05-20', protein_g: 200 }],
      waterByDate: { '2026-05-20': 12 },
      proteinTarget: 100,
      waterGoalGlasses: 8,
    })
    expect(res.protein).toEqual({ hit: 0, total: 10 })
    expect(res.agua.hit).toBe(0)
  })
})

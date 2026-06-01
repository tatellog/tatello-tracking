import { computeWeeklyMealStats, lastNDates } from '@/features/macros/logic'

describe('lastNDates', () => {
  it('devuelve n fechas terminando en today, más vieja primero', () => {
    const dates = lastNDates('2026-05-10', 7)

    expect(dates).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ])
    expect(dates).toHaveLength(7)
    expect(dates[dates.length - 1]).toBe('2026-05-10')
  })

  it('cruza el límite de mes con los días correctos de febrero', () => {
    const dates = lastNDates('2026-03-02', 7)

    expect(dates).toEqual([
      '2026-02-24',
      '2026-02-25',
      '2026-02-26',
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
  })

  it('cruza el límite de año (enero hacia diciembre)', () => {
    const dates = lastNDates('2026-01-02', 4)

    expect(dates).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
  })

  it('con n=1 devuelve solo today', () => {
    expect(lastNDates('2026-05-10', 1)).toEqual(['2026-05-10'])
  })

  it('siempre devuelve fechas en orden ascendente con longitud === n', () => {
    const dates = lastNDates('2026-07-15', 10)

    expect(dates).toHaveLength(10)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })
})

const WEEK = [
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-05-07',
  '2026-05-08',
  '2026-05-09',
  '2026-05-10',
]

describe('computeWeeklyMealStats', () => {
  it('sin comidas devuelve daysLogged 0 y promedio null', () => {
    const stats = computeWeeklyMealStats([], WEEK, 130)

    expect(stats.daysLogged).toBe(0)
    expect(stats.proteinAvgPerLoggedDay).toBeNull()
    expect(stats.daysHitProtein).toBe(0)
    expect(stats.totalDays).toBe(7)
  })

  it('suma varias comidas del mismo día como un solo día registrado', () => {
    const meals = [
      { meal_date: '2026-05-04', protein_g: 30 },
      { meal_date: '2026-05-04', protein_g: 40 },
      { meal_date: '2026-05-04', protein_g: 20 },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 130)

    expect(stats.daysLogged).toBe(1)
    expect(stats.proteinAvgPerLoggedDay).toBe(90)
  })

  it('ignora comidas fuera de la ventana de 7 días', () => {
    const meals = [
      { meal_date: '2026-05-04', protein_g: 50 },
      { meal_date: '2026-04-30', protein_g: 200 },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 130)

    expect(stats.daysLogged).toBe(1)
    expect(stats.proteinAvgPerLoggedDay).toBe(50)
  })

  it('ignora comidas con meal_date null', () => {
    const meals = [
      { meal_date: null, protein_g: 80 },
      { meal_date: '2026-05-05', protein_g: 60 },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 130)

    expect(stats.daysLogged).toBe(1)
    expect(stats.proteinAvgPerLoggedDay).toBe(60)
  })

  it('promedia la proteína solo sobre los días registrados', () => {
    const meals = [
      { meal_date: '2026-05-04', protein_g: 100 },
      { meal_date: '2026-05-05', protein_g: 50 },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 130)

    expect(stats.daysLogged).toBe(2)
    expect(stats.proteinAvgPerLoggedDay).toBe(75)
  })

  it('cuenta los días que alcanzan o superan el target de proteína', () => {
    const meals = [
      { meal_date: '2026-05-04', protein_g: 130 },
      { meal_date: '2026-05-05', protein_g: 150 },
      { meal_date: '2026-05-06', protein_g: 90 },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 130)

    expect(stats.daysLogged).toBe(3)
    expect(stats.daysHitProtein).toBe(2)
    expect(stats.proteinTarget).toBe(130)
  })

  it('con proteinTarget null deja daysHitProtein en null', () => {
    const meals = [{ meal_date: '2026-05-04', protein_g: 100 }]

    const stats = computeWeeklyMealStats(meals, WEEK, null)

    expect(stats.daysHitProtein).toBeNull()
    expect(stats.proteinTarget).toBeNull()
    expect(stats.daysLogged).toBe(1)
  })

  it('suma numéricamente protein_g cuando viene como string', () => {
    const meals = [
      { meal_date: '2026-05-04', protein_g: '30' },
      { meal_date: '2026-05-04', protein_g: '40' },
    ]

    const stats = computeWeeklyMealStats(meals, WEEK, 60)

    expect(stats.proteinAvgPerLoggedDay).toBe(70)
    expect(stats.daysHitProtein).toBe(1)
  })
})

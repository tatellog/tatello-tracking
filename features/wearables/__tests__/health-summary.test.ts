import {
  averageSteps,
  formatCount,
  lastSevenSteps,
  localDayOf,
  waterOfDay,
  workoutLineText,
  workoutsOfDay,
} from '../health-summary'

const TZ = 'America/Mexico_City'
const TODAY = '2026-09-29' // martes

describe('health-summary', () => {
  it('asigna cada entreno a su día LOCAL, no al UTC', () => {
    // 01:30 UTC del 30 = 7:30 pm del 29 en CDMX
    expect(localDayOf('2026-09-30T01:30:00Z', TZ)).toBe('2026-09-29')
    const lines = workoutsOfDay(
      [
        {
          started_at: '2026-09-30T01:30:00Z',
          ended_at: '2026-09-30T02:15:00Z',
          workout_type: 'fuerza',
          duration_min: 45,
          energy_kcal: 320,
        },
        {
          started_at: '2026-09-28T14:00:00Z',
          ended_at: '2026-09-28T14:30:00Z',
          workout_type: 'cardio',
          duration_min: 30,
          energy_kcal: null,
        },
      ],
      TODAY,
      TZ,
    )
    expect(lines).toHaveLength(1)
    expect(workoutLineText(lines[0]!)).toBe('Fuerza · 7:30 pm · 45 min · ~320 kcal')
  })

  it('un tipo desconocido se nombra "Entreno" y se omite lo que falta', () => {
    const [l] = workoutsOfDay(
      [
        {
          started_at: '2026-09-29T15:00:00Z',
          ended_at: '2026-09-29T15:20:00Z',
          workout_type: 'otro',
          duration_min: null,
          energy_kcal: 0,
        },
      ],
      TODAY,
      TZ,
    )
    expect(workoutLineText(l!)).toBe('Entreno · 9:00 am')
  })

  it('la semana de pasos termina hoy y promedia solo días con dato', () => {
    const summary = {
      workouts: [],
      water: [{ day_date: TODAY, water_ml: 750 }],
      steps: [
        { day_date: '2026-09-27', steps: 4000 },
        { day_date: '2026-09-28', steps: 8000 },
        { day_date: TODAY, steps: 6000 },
      ],
    }
    const bars = lastSevenSteps(summary, TODAY)
    expect(bars.map((b) => b.initial)).toEqual(['X', 'J', 'V', 'S', 'D', 'L', 'M'])
    expect(bars[6]).toMatchObject({ day: TODAY, steps: 6000, selected: true })
    expect(averageSteps(bars)).toBe(6000)
    expect(averageSteps(bars.slice(5))).toBeNull()
    expect(waterOfDay(summary, TODAY)).toBe(750)
    expect(waterOfDay(summary, '2026-09-28')).toBeNull()
  })

  it('formatea miles con coma', () => {
    expect(formatCount(6240)).toBe('6,240')
    expect(formatCount(950)).toBe('950')
  })
})

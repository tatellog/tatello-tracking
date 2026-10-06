import {
  averagePointsPerDay,
  dayEvidence,
  evidencePhrase,
  evidencePoints,
  nextStageForecast,
} from '../logic'

const t = { calorieTarget: 1600, proteinTarget: 150, waterGoalGlasses: 8 }

describe('dayEvidence · misma vara que fn_transform_points', () => {
  test('un día completo suma los cinco hábitos (31 pts)', () => {
    const ev = dayEvidence(
      { calories: 1400, protein_g: 160, trained: true, sleep_minutes: 450, water_glasses: 8 },
      t,
    )
    expect(ev).toEqual(['deficit', 'trained', 'protein', 'sleep', 'water'])
    expect(evidencePoints(ev)).toBe(31)
  })
  test('bajo el piso sano (60%) no es déficit; sobre la meta tampoco', () => {
    expect(dayEvidence({ calories: 800 }, t)).not.toContain('deficit')
    expect(dayEvidence({ calories: 1700 }, t)).not.toContain('deficit')
  })
  test('sueño 6 h 59 no cuenta; sin meta de proteína no hay proteína', () => {
    expect(dayEvidence({ sleep_minutes: 419 }, t)).toEqual([])
    expect(dayEvidence({ protein_g: 200 }, { ...t, proteinTarget: null })).toEqual([])
  })
})

test('evidencePhrase', () => {
  expect(evidencePhrase(['protein', 'deficit'])).toBe('déficit y proteína')
  expect(evidencePhrase(['water', 'trained', 'deficit'])).toBe('déficit, entreno y agua')
  expect(evidencePhrase(['sleep'])).toBe('sueño de 7 h')
})

describe('nextStageForecast · cuánto falta, en días como los tuyos', () => {
  test('de 40% a "Se revela" (50%) con 18 pts/día: 60 pts → 4 días', () => {
    const f = nextStageForecast(40, 18)
    expect(f.next?.label).toBe('Se revela')
    expect(f.days).toBe(4)
  })
  test('sin ritmo reciente no se inventan días', () => {
    expect(nextStageForecast(10, 0)).toMatchObject({ days: null })
    expect(nextStageForecast(10, 0).next?.label).toBe('Toma forma')
  })
  test('completo: no hay siguiente', () => {
    expect(nextStageForecast(100, 20)).toEqual({ next: null, days: null })
  })
})

test('averagePointsPerDay', () => {
  expect(averagePointsPerDay([{ trained: true }, { trained: false }], t)).toBe(4)
  expect(averagePointsPerDay([], t)).toBe(0)
})

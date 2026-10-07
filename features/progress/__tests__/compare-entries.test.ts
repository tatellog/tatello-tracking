import { buildCompareEntries, compareDeltas, daysBetween, elapsedLabel } from '../logic'

const checkin = (day: string, o: Record<string, number | null>) =>
  ({ measured_on: day, weight_kg: null, body_fat_pct: null, muscle_kg: null, ...o }) as never
const photo = (day: string) =>
  ({
    id: day,
    taken_at: `${day}T10:00:00Z`,
    angle: 'front',
    signed_url: `https://x/${day}`,
  }) as never

describe('buildCompareEntries', () => {
  test('une fotos y mediciones por fecha, con los números de ese día', () => {
    const e = buildCompareEntries(
      [checkin('2024-11-15', { weight_kg: 66.8, body_fat_pct: 31.1, muscle_kg: 43.7 })],
      [photo('2024-11-15'), photo('2026-07-14')],
      'front',
      [{ t: new Date('2026-07-12T12:00:00').getTime(), weight: 71.4 }],
    )
    expect(e.map((x) => x.day)).toEqual(['2024-11-15', '2026-07-14'])
    expect(e[0]).toMatchObject({ weight: 66.8, fat: 31.1 })
    // Sin check-in ese día: el peso más cercano de la serie (±7 días).
    expect(e[1]).toMatchObject({ weight: 71.4, fat: null })
  })
  test('lejos de cualquier medición: sin peso, no se inventa', () => {
    const e = buildCompareEntries([], [photo('2026-07-14')], 'front', [
      { t: new Date('2026-05-01T12:00:00').getTime(), weight: 70 },
    ])
    expect(e[0]!.weight).toBeNull()
  })
})

test('daysBetween + elapsedLabel', () => {
  expect(elapsedLabel(daysBetween('2024-11-15', '2026-07-14'))).toBe('20 meses')
  expect(daysBetween('2026-07-01', '2026-07-13')).toBe(12)
})

test('compareDeltas: solo métricas con dato en ambos lados; grasa en puntos', () => {
  const a = {
    day: 'a',
    photo: null,
    weight: 66.8,
    fat: 31.1,
    muscle: 43.7,
    water: 48,
    visceral: null,
    bmi: 24.1,
  }
  const b = {
    day: 'b',
    photo: null,
    weight: 72.1,
    fat: 36.8,
    muscle: null,
    water: null,
    visceral: 6,
    bmi: 26,
  }
  expect(compareDeltas(a, b)).toEqual([
    { key: 'weight', label: 'Peso', text: '↑ 5.3 kg' },
    { key: 'fat', label: 'Grasa', text: '↑ 5.7 puntos' },
    { key: 'bmi', label: 'IMC', text: '↑ 1.9' },
  ])
})

describe('sameSourceChange · no resta entre fuentes', () => {
  const { sameSourceChange } = jest.requireActual('../logic') as typeof import('../logic')
  test('compara solo los puntos de la fuente de la última medición', () => {
    const c = sameSourceChange([
      { day: '2024-08-15', value: 35.4, source: 'checkin' },
      { day: '2025-01-10', value: 28, source: 'wearable' },
      { day: '2025-08-15', value: 36.8, source: 'checkin' },
    ])
    expect(c).toEqual({ abs: 1.4, fromDay: '2024-08-15', n: 2 })
  })
  test('con un solo punto de esa fuente, no hay cambio', () => {
    expect(
      sameSourceChange([
        { day: '2024-08-15', value: 35, source: 'checkin' },
        { day: '2025-08-15', value: 30, source: 'wearable' },
      ]),
    ).toBeNull()
  })
})

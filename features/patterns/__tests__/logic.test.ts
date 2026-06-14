import { detectAbandonment, detectNightEating, nightEatingDayCount } from '../logic'

describe('detectNightEating', () => {
  const NOW = new Date('2026-05-28T15:00:00')
  // 5 noches distintas en ventana (22–26 may) con comida a las 22:30.
  const fiveNights = [
    '2026-05-22T22:30:00',
    '2026-05-23T22:30:00',
    '2026-05-24T22:30:00',
    '2026-05-25T22:30:00',
    '2026-05-26T22:30:00',
  ].map((consumed_at) => ({ consumed_at }))

  test('empty list → false', () => {
    expect(detectNightEating([], NOW)).toBe(false)
  })

  test('5 distinct nights after 22:00 → true', () => {
    expect(detectNightEating(fiveNights, NOW)).toBe(true)
    expect(nightEatingDayCount(fiveNights, NOW)).toBe(5)
  })

  test('4 distinct nights → false (threshold is 5 days)', () => {
    expect(detectNightEating(fiveNights.slice(0, 4), NOW)).toBe(false)
  })

  test('counts DAYS not meals: many meals across 3 nights → false', () => {
    const meals = [
      { consumed_at: '2026-05-26T22:00:00' },
      { consumed_at: '2026-05-26T23:30:00' }, // misma noche → no suma un día
      { consumed_at: '2026-05-27T22:30:00' },
      { consumed_at: '2026-05-28T22:30:00' },
    ]
    expect(nightEatingDayCount(meals, NOW)).toBe(3)
    expect(detectNightEating(meals, NOW)).toBe(false)
  })

  test('boundary: 22:00 counts, 21:59 does not', () => {
    const at = (hm: string) =>
      ['2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26'].map((d) => ({
        consumed_at: `${d}T${hm}:00`,
      }))
    expect(detectNightEating(at('22:00'), NOW)).toBe(true)
    expect(detectNightEating(at('21:59'), NOW)).toBe(false)
  })

  test('nights older than 7 days are ignored', () => {
    const old = [
      '2026-05-10T22:30:00',
      '2026-05-11T22:30:00',
      '2026-05-12T22:30:00',
      '2026-05-13T22:30:00',
      '2026-05-14T22:30:00',
    ].map((consumed_at) => ({ consumed_at }))
    expect(detectNightEating(old, NOW)).toBe(false)
  })

  test('daytime meals never count', () => {
    const day = fiveNights.map((m) => ({ consumed_at: m.consumed_at.replace('22:30', '13:00') }))
    expect(detectNightEating(day, NOW)).toBe(false)
  })
})

describe('detectAbandonment', () => {
  test('empty list → false', () => {
    expect(detectAbandonment([])).toBe(false)
  })

  test('one day → false', () => {
    expect(detectAbandonment(['2026-05-28'])).toBe(false)
  })

  test('consecutive days → false', () => {
    expect(detectAbandonment(['2026-05-26', '2026-05-27', '2026-05-28'])).toBe(false)
  })

  test('3-day gap before today → true', () => {
    expect(detectAbandonment(['2026-05-24', '2026-05-28'])).toBe(true)
  })

  test('2-day gap → false (threshold is 3)', () => {
    expect(detectAbandonment(['2026-05-26', '2026-05-28'])).toBe(false)
  })

  test('long gap after prior consistent use → true', () => {
    expect(detectAbandonment(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-28'])).toBe(true)
  })

  test('unsorted input still works (sorts internally)', () => {
    expect(detectAbandonment(['2026-05-28', '2026-05-24'])).toBe(true)
  })
})

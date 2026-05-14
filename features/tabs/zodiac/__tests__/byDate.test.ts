import { zodiacFromDate } from '../byDate'

describe('zodiacFromDate', () => {
  it.each([
    ['2026-03-21', 'aries'],
    ['2026-04-19', 'aries'],
    ['2026-04-20', 'tauro'],
    ['2026-05-20', 'tauro'],
    ['2026-05-21', 'geminis'],
    ['2026-06-20', 'geminis'],
    ['2026-06-21', 'cancer'],
    ['2026-07-22', 'cancer'],
    ['2026-07-23', 'leo'],
    ['2026-08-22', 'leo'],
    ['2026-08-23', 'virgo'],
    ['2026-09-22', 'virgo'],
    ['2026-09-23', 'libra'],
    ['2026-10-22', 'libra'],
    ['2026-10-23', 'escorpio'],
    ['2026-11-21', 'escorpio'],
    ['2026-11-22', 'sagitario'],
    ['2026-12-21', 'sagitario'],
    ['2026-12-22', 'capricornio'],
    ['2026-12-31', 'capricornio'],
    ['2026-01-01', 'capricornio'],
    ['2026-01-19', 'capricornio'],
    ['2026-01-20', 'acuario'],
    ['2026-02-18', 'acuario'],
    ['2026-02-19', 'piscis'],
    ['2026-03-20', 'piscis'],
  ])('maps %s → %s', (iso, expected) => {
    expect(zodiacFromDate(iso)).toBe(expected)
  })

  it.each([null, undefined, '', 'not-a-date', '2026-13-01', '2026-02-32'])(
    'falls back to acuario for invalid input %p',
    (input) => {
      expect(zodiacFromDate(input as string | null | undefined)).toBe('acuario')
    },
  )
})

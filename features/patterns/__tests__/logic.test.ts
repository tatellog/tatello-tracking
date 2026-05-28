import { detectAbandonment, detectNightEating } from '../logic'

describe('detectNightEating', () => {
  const NOW = new Date('2026-05-28T15:00:00')

  test('empty list → false', () => {
    expect(detectNightEating([], NOW)).toBe(false)
  })

  test('one night meal → false (threshold is 2)', () => {
    expect(detectNightEating([{ consumed_at: '2026-05-26T22:30:00' }], NOW)).toBe(false)
  })

  test('two night meals in last 7 days → true', () => {
    expect(
      detectNightEating(
        [{ consumed_at: '2026-05-26T21:30:00' }, { consumed_at: '2026-05-27T22:15:00' }],
        NOW,
      ),
    ).toBe(true)
  })

  test('night meals older than 7 days are ignored', () => {
    expect(
      detectNightEating(
        [{ consumed_at: '2026-05-15T22:00:00' }, { consumed_at: '2026-05-16T23:00:00' }],
        NOW,
      ),
    ).toBe(false)
  })

  test('daytime meals never count', () => {
    expect(
      detectNightEating(
        [{ consumed_at: '2026-05-26T13:00:00' }, { consumed_at: '2026-05-27T19:00:00' }],
        NOW,
      ),
    ).toBe(false)
  })

  test('boundary: exactly 21:00 counts as night', () => {
    expect(
      detectNightEating(
        [{ consumed_at: '2026-05-26T21:00:00' }, { consumed_at: '2026-05-27T21:00:00' }],
        NOW,
      ),
    ).toBe(true)
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

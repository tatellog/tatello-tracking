import { USER_TIMEZONE, todayInTimezone } from '@/lib/time'

describe('todayInTimezone', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns YYYY-MM-DD format', () => {
    jest.setSystemTime(new Date('2026-04-24T15:00:00Z'))
    expect(todayInTimezone()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('resolves to the correct local date across timezone boundaries', () => {
    // 02:00 UTC on 2026-04-24 is still 2026-04-23 in Mexico City (UTC-6)
    // and already 2026-04-24 in Tokyo (UTC+9).
    jest.setSystemTime(new Date('2026-04-24T02:00:00Z'))
    expect(todayInTimezone('America/Mexico_City')).toBe('2026-04-23')
    expect(todayInTimezone('Asia/Tokyo')).toBe('2026-04-24')
  })

  it('defaults to USER_TIMEZONE when none is passed', () => {
    jest.setSystemTime(new Date('2026-04-24T10:00:00Z'))
    expect(todayInTimezone()).toBe(todayInTimezone(USER_TIMEZONE))
  })

  it('pads single-digit months and days', () => {
    jest.setSystemTime(new Date('2026-03-05T15:00:00Z'))
    const iso = todayInTimezone('UTC')
    expect(iso).toBe('2026-03-05')
    expect(iso.length).toBe(10)
  })
})

describe('USER_TIMEZONE constant', () => {
  it('is the IANA name matching the server-side user_timezone() function', () => {
    expect(USER_TIMEZONE).toBe('America/Mexico_City')
  })
})

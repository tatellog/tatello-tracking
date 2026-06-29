import {
  deviceTimezone,
  setUserTimezone,
  USER_TIMEZONE,
  todayInTimezone,
  userTimezone,
} from '@/lib/time'

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

  it('por defecto usa userTimezone() (la zona del perfil, o el device)', () => {
    jest.setSystemTime(new Date('2026-04-24T10:00:00Z'))
    setUserTimezone(null)
    expect(todayInTimezone()).toBe(todayInTimezone(userTimezone()))
    // Con la zona del perfil seteada, el default la sigue.
    setUserTimezone('Asia/Tokyo')
    expect(todayInTimezone()).toBe(todayInTimezone('Asia/Tokyo'))
    setUserTimezone(null)
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

describe('deviceTimezone', () => {
  it('returns a non-empty IANA zone name', () => {
    const tz = deviceTimezone()
    expect(typeof tz).toBe('string')
    expect(tz.length).toBeGreaterThan(0)
  })

  it('falls back to USER_TIMEZONE when the runtime reports no zone', () => {
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions)
    expect(deviceTimezone()).toBe(USER_TIMEZONE)
    spy.mockRestore()
  })
})

describe('userTimezone / setUserTimezone', () => {
  afterEach(() => setUserTimezone(null))

  it('usa la zona del perfil cuando está seteada (calza con la vista del server)', () => {
    setUserTimezone('Asia/Tokyo')
    expect(userTimezone()).toBe('Asia/Tokyo')
  })

  it('null o cadena vacía → cae al device (no hereda zona ajena)', () => {
    setUserTimezone('America/Mexico_City')
    expect(userTimezone()).toBe('America/Mexico_City')
    setUserTimezone('')
    expect(userTimezone()).toBe(deviceTimezone())
    setUserTimezone(null)
    expect(userTimezone()).toBe(deviceTimezone())
  })
})

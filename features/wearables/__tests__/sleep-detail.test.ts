import { barLabel, clockTime, lastSevenNights, stageSegments, usualSleep } from '../sleep-detail'

describe('stageSegments', () => {
  it('reparte la noche en partes que suman 1', () => {
    const segs = stageSegments({
      deep_minutes: 60,
      core_minutes: 240,
      rem_minutes: 90,
      awake_minutes: 10,
    })!
    expect(segs.map((s) => s.label)).toEqual(['Profundo', 'Ligero', 'REM', 'Despierta'])
    expect(segs.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1)
  })
  it('null cuando el reloj no dio etapas', () => {
    expect(
      stageSegments({
        deep_minutes: null,
        core_minutes: null,
        rem_minutes: null,
        awake_minutes: null,
      }),
    ).toBeNull()
  })
})

describe('lastSevenNights', () => {
  it('las 7 noches que terminan en el día visto, con huecos', () => {
    const bars = lastSevenNights(
      '2026-09-29',
      new Map([
        ['2026-09-29', 441],
        ['2026-09-27', 469],
      ]),
    )
    expect(bars).toHaveLength(7)
    expect(bars[0]!.day).toBe('2026-09-23')
    expect(bars[6]).toMatchObject({ day: '2026-09-29', minutes: 441, selected: true, initial: 'M' })
    expect(bars[5]!.minutes).toBeNull()
  })
})

describe('usualSleep', () => {
  it('mediana redondeada a 5 min; calla con menos de 3 noches', () => {
    expect(usualSleep([420, 263, 519, 414])).toBe(415)
    expect(usualSleep([420, 400])).toBeNull()
  })
})

describe('formatos', () => {
  it('barLabel rellena los minutos', () => {
    expect(barLabel(425)).toBe('7:05')
  })
  it('clockTime en la zona de la usuaria', () => {
    expect(clockTime('2026-09-29T05:48:00Z', 'America/Mexico_City')).toBe('11:48 pm')
  })
})

describe('hora de dormir', () => {
  const { bedtimeMinutes, bedtimeLabel, bedtimeRead } = jest.requireActual('../sleep-detail')
  const TZ = 'America/Mexico_City'
  it('cuenta desde el mediodía para que cruzar la medianoche promedie bien', () => {
    expect(bedtimeMinutes('2026-10-02T07:15:00Z', TZ)).toBe(795) // 1:15 am
    expect(bedtimeMinutes('2026-10-02T04:30:00Z', TZ)).toBe(630) // 10:30 pm
    expect(bedtimeLabel(795)).toBe('1:15 am')
    expect(bedtimeLabel(630)).toBe('10:30 pm')
    expect(bedtimeLabel(720)).toBe('12:00 am')
  })
  it('compara anoche contra tu promedio de noches anteriores', () => {
    const nights = [
      { sleep_date: '2026-09-29', bedtime_at: '2026-09-29T06:40:00Z' }, // 12:40 am
      { sleep_date: '2026-09-30', bedtime_at: '2026-09-30T06:50:00Z' }, // 12:50 am
      { sleep_date: '2026-10-01', bedtime_at: '2026-10-01T06:57:00Z' }, // 12:57 am
      { sleep_date: '2026-10-02', bedtime_at: '2026-10-02T07:15:00Z' }, // 1:15 am
    ]
    const r = bedtimeRead(nights, '2026-10-02', TZ)
    expect(r.bars).toHaveLength(14)
    expect(r.bars[13]).toMatchObject({ selected: true, minutes: 795 })
    expect(bedtimeLabel(r.average)).toBe('12:49 am')
    expect(r.diff).toBe(26)
  })
  it('con pocas noches no hay promedio', () => {
    const r = bedtimeRead(
      [{ sleep_date: '2026-10-02', bedtime_at: '2026-10-02T07:15:00Z' }],
      '2026-10-02',
      TZ,
    )
    expect(r.average).toBeNull()
    expect(r.diff).toBeNull()
  })
})

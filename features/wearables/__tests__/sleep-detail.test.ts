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

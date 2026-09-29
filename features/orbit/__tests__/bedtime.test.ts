import { bedtimeOffsetMinutes, lateBedtimeEffect } from '../bedtime'
import { rankSurprises } from '../surprise'
import type { DailySignals } from '../../../supabase/functions/_shared/intelligence/types'

const TZ = 'America/Mexico_City'

const sig = (day: string, calories: number) => ({ day, calories }) as unknown as DailySignals

describe('bedtimeOffsetMinutes', () => {
  it('minutos desde las 6 pm, sin partirse en medianoche', () => {
    expect(bedtimeOffsetMinutes('2026-09-29T05:30:00Z', TZ)).toBe(330) // 23:30
    expect(bedtimeOffsetMinutes('2026-09-29T07:00:00Z', TZ)).toBe(420) // 1:00
  })
})

describe('lateBedtimeEffect', () => {
  const days = ['01', '02', '03', '04', '05', '06'].map((d) => `2026-09-${d}`)
  // Tres noches antes de medianoche (en déficit) y tres a la 1 am o más tarde.
  const bedtimes = new Map([
    [days[0]!, 300],
    [days[1]!, 330],
    [days[2]!, 310],
    [days[3]!, 420],
    [days[4]!, 450],
    [days[5]!, 430],
  ])
  const signals = [
    sig(days[0]!, 1300),
    sig(days[1]!, 1350),
    sig(days[2]!, 1250),
    sig(days[3]!, 1900),
    sig(days[4]!, 1800),
    sig(days[5]!, 1300),
  ]

  it('habla con la hora dicha y la evidencia de ambos lados', () => {
    const s = lateBedtimeEffect(signals, { calorieTarget: 1400, bedtimes })!
    expect(s.id).toBe('late-bedtime')
    expect(s.headline).toBe(
      'Cuando te duermes a la 1 am o más tarde, al día siguiente cierras en déficit menos seguido.',
    )
    expect(s.rows[0]).toMatchObject({
      label: 'Tras dormirte antes de la 1 am',
      value: '3 de 3',
      strong: true,
    })
    expect(s.rows[1]!.value).toBe('1 de 3')
    expect(s.delayed).toBe(true)
  })

  it('entra al ranker de sorpresas', () => {
    const r = rankSurprises(signals, { calorieTarget: 1400, bedtimes })
    expect([r.hero, ...r.others].some((x) => x?.id === 'late-bedtime')).toBe(true)
  })

  it('calla sin reloj, sin ventaja o si "tarde" es antes de las 11 pm', () => {
    expect(lateBedtimeEffect(signals, { calorieTarget: 1400 })).toBeNull()
    const flat = signals.map((s) => sig(s.day!, 1300))
    expect(lateBedtimeEffect(flat, { calorieTarget: 1400, bedtimes })).toBeNull()
    const early = new Map([...bedtimes].map(([d, b]) => [d, b - 200]))
    expect(lateBedtimeEffect(signals, { calorieTarget: 1400, bedtimes: early })).toBeNull()
  })
})

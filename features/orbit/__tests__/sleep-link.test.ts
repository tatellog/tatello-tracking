import { sleepDeficitLink } from '../sleep-link'

const day = (d: number, sleep: number, calories: number) => ({
  day: `2026-09-${String(d).padStart(2, '0')}`,
  sleep_minutes: sleep,
  calories,
})

describe('sleepDeficitLink', () => {
  it('habla cuando dormir 7 h o más va con más días en déficit', () => {
    const signals = [
      day(1, 450, 1300),
      day(2, 460, 1350),
      day(3, 480, 1200),
      day(4, 300, 1900),
      day(5, 330, 1800),
      day(6, 350, 1350),
    ]
    const link = sleepDeficitLink(signals, 1400)!
    expect(link.good).toEqual({ deficit: 3, days: 3 })
    expect(link.short).toEqual({ deficit: 1, days: 3 })
  })
  it('calla sin evidencia suficiente o sin ventaja', () => {
    expect(sleepDeficitLink([day(1, 450, 1300), day(2, 300, 1900)], 1400)).toBeNull()
    const flat = [1, 2, 3]
      .map((d) => day(d, 450, 1300))
      .concat([4, 5, 6].map((d) => day(d, 300, 1300)))
    expect(sleepDeficitLink(flat, 1400)).toBeNull()
    expect(sleepDeficitLink(flat, null)).toBeNull()
  })
})

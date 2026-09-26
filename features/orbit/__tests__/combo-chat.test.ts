import { comboChatHash, comboId, comboToFinding } from '../combo-chat'
import type { WinningCombo } from '../month-built'

const combo: WinningCombo = {
  signals: [
    { key: 'sueno', label: 'Sueño' },
    { key: 'cuerpo', label: 'Entreno' },
  ],
  occurrences: 11,
  deficits: 6,
  days: ['2026-09-01', '2026-09-03'],
  restDays: 30,
  restDeficits: 9,
}

describe('comboToFinding', () => {
  it('id estable, independiente del orden de las señales', () => {
    const flipped = { ...combo, signals: [...combo.signals].reverse() }
    expect(comboId(combo)).toBe('combo:cuerpo+sueno')
    expect(comboId(flipped)).toBe(comboId(combo))
  })

  it('el hash cambia si cambia la evidencia (no rehidrata otro patrón)', () => {
    expect(comboChatHash({ ...combo, deficits: 7 })).not.toBe(comboChatHash(combo))
  })

  it('viste el combo con sus números reales y sin inventar palanca', () => {
    const f = comboToFinding(combo)
    expect(f.metric.value).toBe('6 de 11')
    expect(f.phrase.support).toContain('11 días')
    expect(f.evidenceDates).toEqual(combo.days)
    expect(f.lever).toBeUndefined()
    expect(f.reflectionKey).toBe('orbita:combo:cuerpo+sueno')
  })

  it('la palanca solo viene del motor', () => {
    expect(comboToFinding(combo, 'Van 2 de tus 3 días así.').lever).toBe('Van 2 de tus 3 días así.')
  })
})

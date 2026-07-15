import { elapsedLabel, pickLeadChip } from '../logic'

/*
 * El titular del 30v30 solo se gana con MEJORA (feedback target-user 14 jul
 * 2026: en mes flojo, "el más significativo" servía la peor noticia en
 * gigante). Honestidad sin amplificación: el dato duro sigue en el grid.
 */

const chip = (key: string, significance: number, delta: number) => ({ key, significance, delta })

describe('pickLeadChip', () => {
  it('gana la mejora más significativa', () => {
    const lead = pickLeadChip([
      chip('deficit', 0.2, 3),
      chip('workouts', 0.5, 4),
      chip('protein', 0.3, 12),
    ])
    expect(lead?.key).toBe('workouts')
  })

  it('mes flojo (todo retrocede): NADIE lidera, grid plano', () => {
    const lead = pickLeadChip([
      chip('deficit', 0.4, -6),
      chip('workouts', 0.5, -4),
      chip('protein', 0.3, -12),
    ])
    expect(lead).toBeNull()
  })

  it('un retroceso grande no le gana a una mejora chica', () => {
    const lead = pickLeadChip([chip('deficit', 0.9, -8), chip('workouts', 0.2, 2)])
    expect(lead?.key).toBe('workouts')
  })

  it('sin mejora significativa, el déficit lidera solo si no retrocedió', () => {
    expect(pickLeadChip([chip('deficit', 0, 0), chip('workouts', 0, 0)])?.key).toBe('deficit')
    expect(pickLeadChip([chip('deficit', 0, -2), chip('workouts', 0, 0)])).toBeNull()
  })

  it('el peso nunca compite (significance 0) aunque haya bajado', () => {
    const lead = pickLeadChip([chip('weight', 0, 0), chip('deficit', 0.3, 4)])
    expect(lead?.key).toBe('deficit')
  })

  it('mejora sin significancia no gana el titular (anti-ruido)', () => {
    // delta positivo pero significance 0 (bajo el umbral): cae al fallback.
    const lead = pickLeadChip([chip('workouts', 0, 2), chip('deficit', 0, 1)])
    expect(lead?.key).toBe('deficit')
  })
})

describe('elapsedLabel', () => {
  it('habla en días, semanas, meses y años', () => {
    expect(elapsedLabel(0)).toBe('el mismo día')
    expect(elapsedLabel(1)).toBe('1 día')
    expect(elapsedLabel(10)).toBe('10 días')
    expect(elapsedLabel(21)).toBe('3 semanas')
    expect(elapsedLabel(274)).toBe('9 meses')
    expect(elapsedLabel(800)).toBe('2 años')
  })
})

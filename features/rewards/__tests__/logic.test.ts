import {
  daysBetweenIso,
  pickReturnPhrase,
  RETURN_GAP_MIN_DAYS,
  RETURN_PHRASES,
  shouldCelebrateReturn,
} from '../logic'

describe('daysBetweenIso', () => {
  it('mide días simples', () => {
    expect(daysBetweenIso('2026-06-01', '2026-06-04')).toBe(3)
  })

  it('mismo día es 0', () => {
    expect(daysBetweenIso('2026-06-12', '2026-06-12')).toBe(0)
  })

  it('cruza fin de mes', () => {
    expect(daysBetweenIso('2026-05-30', '2026-06-02')).toBe(3)
  })

  it('cruza fin de año', () => {
    expect(daysBetweenIso('2025-12-30', '2026-01-02')).toBe(3)
  })

  it('cruza el cambio de horario (DST no afecta el conteo)', () => {
    // En America/Mexico_City ya no hay DST, pero el cálculo es UTC-puro
    // y debe dar días exactos en cualquier zona del dispositivo.
    expect(daysBetweenIso('2026-03-06', '2026-03-10')).toBe(4)
  })

  it('orden invertido da negativo', () => {
    expect(daysBetweenIso('2026-06-04', '2026-06-01')).toBe(-3)
  })
})

describe('shouldCelebrateReturn', () => {
  it('nunca celebra el primer uso (sin lastSeen)', () => {
    expect(shouldCelebrateReturn(null, '2026-06-12')).toBe(false)
  })

  it('no celebra el uso diario (gap 1)', () => {
    expect(shouldCelebrateReturn('2026-06-11', '2026-06-12')).toBe(false)
  })

  it('no celebra un fin de semana fuera (gap 2)', () => {
    expect(shouldCelebrateReturn('2026-06-10', '2026-06-12')).toBe(false)
  })

  it('celebra exactamente en el umbral (gap 3)', () => {
    expect(shouldCelebrateReturn('2026-06-09', '2026-06-12')).toBe(true)
  })

  it('celebra ausencias largas', () => {
    expect(shouldCelebrateReturn('2026-05-01', '2026-06-12')).toBe(true)
  })

  it('no celebra con fecha malformada', () => {
    expect(shouldCelebrateReturn('garbage', '2026-06-12')).toBe(false)
  })

  it('el umbral es 3 días', () => {
    expect(RETURN_GAP_MIN_DAYS).toBe(3)
  })
})

describe('pickReturnPhrase', () => {
  it('siempre devuelve una de las frases del spec', () => {
    expect(RETURN_PHRASES).toContain(pickReturnPhrase('2026-06-12'))
    expect(RETURN_PHRASES).toContain(pickReturnPhrase('2026-01-01'))
    expect(RETURN_PHRASES).toContain(pickReturnPhrase('2026-12-31'))
  })

  it('es determinística — el mismo día dice lo mismo', () => {
    expect(pickReturnPhrase('2026-06-12')).toBe(pickReturnPhrase('2026-06-12'))
  })

  it('rota entre días (no siempre la misma frase)', () => {
    const phrases = new Set(
      ['2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15'].map(pickReturnPhrase),
    )
    expect(phrases.size).toBeGreaterThan(1)
  })

  it('ninguna frase castiga, cuenta días ni menciona pérdida', () => {
    for (const phrase of RETURN_PHRASES) {
      expect(phrase).not.toMatch(/racha|perdiste|días|falta|extrañamos/i)
    }
  })
})

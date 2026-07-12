import type { Finding } from '../findings'
import { patternKindFor } from '../pattern-memory-logic'

/** Finding mínimo con overrides (los campos que mira patternKindFor). */
const mk = (o: Partial<Finding> & { id: string }): Finding =>
  ({
    category: 'movimiento',
    confidence: 70,
    title: '',
    subject: '',
    phrase: { lead: '', support: '', caption: '' },
    explanation: '',
    metric: { value: '', label: '' },
    evidenceDates: [],
    evidenceTitle: '',
    charts: [],
    reflectionKey: o.id,
    metacognition: { question: '', options: [], replies: {} },
    followUps: [],
    ...o,
  }) as Finding

describe('patternKindFor — qué patrones se archivan en Historia', () => {
  it('el rescate se archiva como "rescue" (Ancla)', () => {
    expect(patternKindFor(mk({ id: 'rescue' }))).toBe('rescue')
  })

  it('una señal naciente (emerging) se archiva como "rising_signal"', () => {
    expect(patternKindFor(mk({ id: 'training-deficit', emerging: true }))).toBe('rising_signal')
  })

  it('el veredicto de déficit NO se archiva (no es un descubrimiento)', () => {
    expect(patternKindFor(mk({ id: 'deficit-summary', emerging: false }))).toBeNull()
  })

  it('un obstáculo NO se archiva (marcar un día malo roza la culpa)', () => {
    expect(patternKindFor(mk({ id: 'weekday-diet-break', isObstacle: true }))).toBeNull()
  })

  it('un obstáculo emergente TAMPOCO se archiva (isObstacle gana)', () => {
    expect(
      patternKindFor(mk({ id: 'weekday-diet-break', isObstacle: true, emerging: true })),
    ).toBeNull()
  })

  it('un hallazgo consolidado sin id de patrón conocido NO se archiva', () => {
    expect(patternKindFor(mk({ id: 'training-deficit', emerging: false }))).toBeNull()
  })
})

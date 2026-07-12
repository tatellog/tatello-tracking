import { insightToFinding } from '../insight-chat'
import type { ProgressInsight } from '../insights'

const insight: ProgressInsight = {
  id: 'recomposition',
  subject: 'tu peso y tu grasa',
  lead: 'Tu peso casi no se movió, pero tu grasa sí bajó.',
  support: 'Peso 78.2 kg → 78.0 kg · grasa 31.4% → 30.1% en 5 semanas.',
  contrast: null,
  confidence: 78,
  relatedMetrics: ['weight', 'body_fat'],
  northLink: 'Recomponer es avanzar aunque el número se quede quieto.',
}

describe('insightToFinding — el adaptador al chat de Órbita (Epic 04)', () => {
  it('preserva lo que el chat necesita: subject, lead, support, northLink', () => {
    const f = insightToFinding(insight)
    expect(f.id).toBe('recomposition')
    expect(f.subject).toBe(insight.subject)
    expect(f.phrase.lead).toBe(insight.lead)
    expect(f.phrase.support).toBe(insight.support) // los ÚNICOS números citables
    expect(f.northLink).toBe(insight.northLink)
  })

  it('NO inventa: sin palanca ni hipótesis (el porqué es Órbita)', () => {
    const f = insightToFinding(insight)
    expect(f.lever).toBeUndefined()
    expect(f.hypothesis).toBeUndefined()
    expect(f.evidenceDates).toEqual([])
  })

  it('reflectionKey namespaced (progress:) para no chocar con Órbita', () => {
    expect(insightToFinding(insight).reflectionKey).toBe('progress:recomposition')
  })

  it('contrast null → undefined (contrato del Finding)', () => {
    expect(insightToFinding({ ...insight, contrast: null }).contrast).toBeUndefined()
    expect(insightToFinding({ ...insight, contrast: 'el otro lado' }).contrast).toBe('el otro lado')
  })
})

import type { Finding, FindingCategory, Story } from '../engine-types'
import { buildHypotheses } from '../hypothesis'

const mkFinding = (o: {
  id: string
  category: FindingCategory
  confidence: number
  subject: string
  hypothesis?: string
}): Finding => ({
  title: '',
  explanation: '',
  phrase: { lead: '', support: '', caption: '' },
  metric: { value: '', label: '' },
  evidenceDates: [],
  evidenceTitle: '',
  charts: [],
  reflectionKey: o.id,
  metacognition: { question: '', options: [], replies: {} },
  followUps: [],
  ...o,
})

const noCausation = /porque|caus[aó]|debido a|provoca|hace que/i

describe('buildHypotheses — Hypothesis Engine (Engine 5)', () => {
  it('de una historia: relación tentativa, status open, sourceStoryId', () => {
    const agua = mkFinding({
      id: 'water-deficit',
      category: 'agua',
      confidence: 80,
      subject: 'tu agua',
    })
    const entreno = mkFinding({
      id: 'training-deficit',
      category: 'movimiento',
      confidence: 70,
      subject: 'tu entreno',
    })
    const story: Story = {
      id: 'water-deficit+training-deficit',
      findingIds: ['water-deficit', 'training-deficit'],
      chain: ['tu agua', 'tu entreno', 'tu déficit'],
      score: 30,
    }
    const hyps = buildHypotheses([agua, entreno], [story])
    const h = hyps.find((x) => x.sourceStoryId === story.id)!
    expect(h.status).toBe('open')
    expect(h.text).toMatch(/^Es posible que/)
    expect(h.text).toContain('tu agua')
    expect(h.text).toContain('tu entreno')
    expect(h.confidence).toBe(70) // min del par
    expect(h.text).not.toMatch(noCausation) // sugiere, no afirma causa
  })

  it('de un finding con cruce: reusa el texto tentativo, sourceFindingId', () => {
    const f = mkFinding({
      id: 'deficit-summary',
      category: 'deficit',
      confidence: 65,
      subject: 'tu déficit',
      hypothesis: 'Me llamó algo más: en 4 de esos días también dormiste 7 horas o más.',
    })
    const hyps = buildHypotheses([f], [])
    const h = hyps.find((x) => x.sourceFindingId === 'deficit-summary')!
    expect(h.status).toBe('open')
    expect(h.text).toContain('también dormiste')
    expect(h.confidence).toBe(65)
  })

  it('sin historias ni cruces → sin hipótesis; cap 3', () => {
    expect(
      buildHypotheses([mkFinding({ id: 'a', category: 'agua', confidence: 90, subject: 'x' })], []),
    ).toEqual([])
  })

  it('deduplica cruces repetidos (misma frase, distinto número) por confianza', () => {
    const a = mkFinding({
      id: 'water-deficit',
      category: 'agua',
      confidence: 80,
      subject: 'tu agua',
      hypothesis: 'Me llamó algo más: en 4 de esos días también entrenaste. Ahí están los dos.',
    })
    const b = mkFinding({
      id: 'deficit-summary',
      category: 'deficit',
      confidence: 60,
      subject: 'tu déficit',
      hypothesis: 'Me llamó algo más: en 2 de esos días también entrenaste. Ahí están los dos.',
    })
    const hyps = buildHypotheses([a, b], [])
    // Un solo cruce a "entreno" (el de mayor confianza), no dos casi idénticos.
    const entreno = hyps.filter((h) => h.text.includes('entrenaste'))
    expect(entreno).toHaveLength(1)
    expect(entreno[0]!.sourceFindingId).toBe('water-deficit')
  })
})

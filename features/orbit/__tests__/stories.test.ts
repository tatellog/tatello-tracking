import type { Finding, FindingCategory } from '../engine-types'
import { buildStories } from '../stories'

/** Finding mínimo para tests de historias (solo los campos que usa el engine). */
const mkFinding = (o: {
  id: string
  category: FindingCategory
  confidence: number
  subject: string
  evidenceDates: string[]
  northLink?: string
}): Finding => ({
  title: '',
  explanation: '',
  phrase: { lead: '', support: '', caption: '' },
  metric: { value: '', label: '' },
  evidenceTitle: '',
  charts: [],
  reflectionKey: o.id,
  metacognition: { question: '', options: [], replies: {} },
  followUps: [],
  ...o,
})

const D = (n: number) => `2026-07-${String(n).padStart(2, '0')}`

describe('buildStories — Story Engine (Engine 3)', () => {
  it('empareja dimensiones distintas que coinciden ≥2 días; norte → nodo déficit', () => {
    const agua = mkFinding({
      id: 'water-deficit',
      category: 'agua',
      confidence: 80,
      subject: 'tus días con tu meta de agua',
      evidenceDates: [D(1), D(2), D(3)],
      northLink: 'x',
    })
    const entreno = mkFinding({
      id: 'training-deficit',
      category: 'movimiento',
      confidence: 70,
      subject: 'tus días de entrenamiento',
      evidenceDates: [D(2), D(3), D(9)],
      northLink: 'x',
    })
    const stories = buildStories([agua, entreno])
    expect(stories).toHaveLength(1)
    expect(stories[0]!.findingIds.sort()).toEqual(['training-deficit', 'water-deficit'])
    // Ambos acercan al norte → el nodo final es el déficit.
    expect(stories[0]!.chain[stories[0]!.chain.length - 1]).toBe('tu déficit')
    expect(stories[0]!.chain).toContain('tus días con tu meta de agua')
    expect(stories[0]!.score).toBeGreaterThan(0)
  })

  it('no encadena dos hallazgos del MISMO eje (no es una historia)', () => {
    const a = mkFinding({
      id: 'deficit-summary',
      category: 'deficit',
      confidence: 60,
      subject: 'tu déficit del mes',
      evidenceDates: [D(1), D(2), D(3)],
    })
    const b = mkFinding({
      id: 'weekday-diet-break',
      category: 'deficit',
      confidence: 80,
      subject: 'los viernes',
      evidenceDates: [D(1), D(2)],
    })
    expect(buildStories([a, b])).toEqual([])
  })

  it('sin ≥2 días compartidos → no hay historia; sin norte → cadena de 2 nodos', () => {
    const agua = mkFinding({
      id: 'water-deficit',
      category: 'agua',
      confidence: 80,
      subject: 'agua',
      evidenceDates: [D(1)],
    })
    const entreno = mkFinding({
      id: 'training-deficit',
      category: 'movimiento',
      confidence: 70,
      subject: 'entreno',
      evidenceDates: [D(1)], // solo 1 compartido
    })
    expect(buildStories([agua, entreno])).toEqual([])

    entreno.evidenceDates = [D(1), D(2)]
    agua.evidenceDates = [D(1), D(2)]
    const stories = buildStories([agua, entreno])
    expect(stories).toHaveLength(1)
    expect(stories[0]!.chain).toEqual(['agua', 'entreno']) // sin norte → 2 nodos
  })

  it('vacío / un solo hallazgo → sin historias', () => {
    expect(buildStories([])).toEqual([])
  })
})

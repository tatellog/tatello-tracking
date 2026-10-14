import { featuredOf, qualifiedDiscoveries } from '../featured-discovery'
import { discoveryLabel } from '../hoy-discovery'
import { insightKey, insightMeta, markSentToday, shouldSendToday } from '../insight-events'
import type { MonthPattern, WinningCombo } from '../month-built'
import { stepsDeficit, type Surprise } from '../surprise'
import { addDays, mkSig } from './signals.fixture'

/*
 * ST-008 · el recorrido de un hallazgo (calificado → presentado → abierto):
 * qué se manda, cuándo se repite y que nunca lleve datos de salud.
 */
describe('dedupe por día', () => {
  it('una llave se manda una vez al día y vuelve a mandarse al siguiente', () => {
    const key = insightKey('insight_presented', 'steps-deficit', 'hoy')
    const l1 = markSentToday({}, key, '2026-10-14')
    expect(shouldSendToday({}, key, '2026-10-14')).toBe(true)
    expect(shouldSendToday(l1, key, '2026-10-14')).toBe(false)
    expect(shouldSendToday(l1, key, '2026-10-15')).toBe(true)
  })

  it('presentado en Hoy y en Descubre son llaves distintas', () => {
    expect(insightKey('insight_presented', 'x', 'hoy')).not.toBe(
      insightKey('insight_presented', 'x', 'descubre'),
    )
    expect(insightKey('insight_eligible', 'x')).not.toBe(insightKey('insight_presented', 'x'))
  })

  it('el ledger suelta los días anteriores (no crece)', () => {
    const old = markSentToday({}, 'a', '2026-10-13')
    expect(markSentToday(old, 'b', '2026-10-14')).toEqual({ b: '2026-10-14' })
  })
})

describe('insightMeta', () => {
  it('solo ids y etiquetas: ningún número de comida, peso o sueño', () => {
    const signals = Array.from({ length: 12 }, (_, i) =>
      mkSig(addDays('2026-06-01', i), {
        meal_count: 2,
        steps: i % 2 === 0 ? 9000 : 2000,
        calories: i % 2 === 0 ? 1400 : 2400,
      }),
    )
    const s = stepsDeficit(signals, { calorieTarget: 1800 })!
    const d = featuredOf(s, null, [])!
    const meta = insightMeta(d, discoveryLabel(d, 3, signals, { calorieTarget: 1800 }), 3)
    expect(meta).toEqual({
      source: 'discovery',
      finding_id: 'steps-deficit',
      kind: 'surprise',
      label: 'patron',
      stage: 3,
    })
  })
})

describe('qualifiedDiscoveries', () => {
  const pattern = (id: string) =>
    ({
      id,
      kind: 'pattern',
      title: id,
      evidence: { bars: [], caption: '', unit: '' },
    }) as unknown as MonthPattern
  const combo = { signals: [{ key: 'sueno' }, { key: 'cuerpo' }] } as unknown as WinningCombo
  const surprise = { id: 'steps-deficit' } as Surprise

  it('el orden del feed: sorpresa → combo → patrones; el primero es el protagonista', () => {
    const q = qualifiedDiscoveries(surprise, combo, [pattern('a'), pattern('b')])
    expect(q.map((d) => d.id)).toEqual(['steps-deficit', 'cuerpo+sueno', 'a', 'b'])
    expect(featuredOf(surprise, combo, [pattern('a')])!.id).toBe(q[0]!.id)
  })

  it('sin nada, nada', () => {
    expect(qualifiedDiscoveries(null, null, [])).toEqual([])
    expect(featuredOf(null, null, [])).toBeNull()
  })
})

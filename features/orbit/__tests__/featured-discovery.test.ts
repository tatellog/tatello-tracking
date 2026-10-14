import { featuredOf, pickSupportPatterns } from '../featured-discovery'
import type { MonthPattern, WinningCombo } from '../month-built'
import type { Surprise } from '../surprise'

/*
 * ST-007 · el destacado de Hoy es EXACTAMENTE el protagonista de Descubre:
 * sorpresa → combo → primer patrón de apoyo; sin ninguno, nada.
 */
const pattern = (id: string, kind: 'pattern' | 'discovery' = 'pattern') =>
  ({
    id,
    kind,
    title: id,
    evidence: { bars: [], caption: '', unit: '' },
  }) as unknown as MonthPattern
const combo = (keys: string[]) =>
  ({
    signals: keys.map((key) => ({ key, label: key })),
    occurrences: 5,
    deficits: 4,
    days: [],
    restDays: 10,
    restDeficits: 3,
  }) as WinningCombo
const surprise = { id: 'steps-deficit' } as Surprise

describe('featuredOf', () => {
  it('la sorpresa manda sobre el combo y los patrones', () => {
    expect(
      featuredOf(surprise, combo(['cuerpo', 'sueno']), [pattern('deficit-daytype')]),
    ).toMatchObject({
      kind: 'surprise',
      id: 'steps-deficit',
    })
  })

  it('sin sorpresa, el combo con su clave estable (keys ordenadas)', () => {
    expect(featuredOf(null, combo(['sueno', 'cuerpo']), [])).toMatchObject({
      kind: 'combo',
      id: 'cuerpo+sueno',
    })
  })

  it('sin sorpresa ni combo, el primer patrón de apoyo', () => {
    expect(
      featuredOf(null, null, [pattern('movement-deficit'), pattern('sleep-deficit')]),
    ).toMatchObject({
      kind: 'pattern',
      id: 'movement-deficit',
    })
  })

  it('sin nada calificado: null (Hoy no promete)', () => {
    expect(featuredOf(null, null, [])).toBeNull()
  })
})

describe('pickSupportPatterns', () => {
  it('quita lo que el combo ya dijo y ordena por relevancia (déficit primero)', () => {
    const all = [
      pattern('training-protein'),
      pattern('sleep-deficit'),
      pattern('movement-deficit'),
      pattern('deficit-daytype'),
      pattern('consistent-sleep', 'discovery'),
    ]
    const ids = pickSupportPatterns(all, combo(['cuerpo', 'sueno'])).map((p) => p.id)
    expect(ids).toEqual(['deficit-daytype', 'training-protein'])
  })

  it('tope: 3 sin combo, 2 con combo', () => {
    const all = [
      'deficit-daytype',
      'movement-deficit',
      'surplus-concentration',
      'sleep-deficit',
    ].map((id) => pattern(id))
    expect(pickSupportPatterns(all, null)).toHaveLength(3)
    expect(pickSupportPatterns(all, combo(['agua']))).toHaveLength(2)
  })
})

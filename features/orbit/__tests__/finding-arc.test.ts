import {
  FINDING_ARC_LABEL,
  FINDING_ARC_STEPS,
  findingArcIndex,
  findingArcStage,
} from '../finding-arc'

/*
 * V-10 · el arco de evidencia: el estado se DERIVA del pipeline, nunca se
 * declara a mano. Confirmado exige recurrencia real o hipótesis confirmada.
 */

const finding = { id: 'f-deficit', category: 'deficit' as const }

describe('findingArcStage', () => {
  it('sin hipótesis ni historia → encontrado (este mes)', () => {
    expect(findingArcStage(finding, {}, [])).toBe('encontrado')
  })

  it('con hipótesis viva que lo referencia directo → investigando', () => {
    const report = {
      hypotheses: [
        {
          id: 'h1',
          text: '',
          confidence: 60,
          status: 'open' as const,
          sourceFindingId: 'f-deficit',
        },
      ],
    }
    expect(findingArcStage(finding, report, [])).toBe('investigando')
  })

  it('con hipótesis viva vía su historia → investigando', () => {
    const report = {
      stories: [{ id: 's1', findingIds: ['f-deficit', 'f-sueno'], chain: [], score: 1 }],
      hypotheses: [
        {
          id: 'h1',
          text: '',
          confidence: 60,
          status: 'experimenting' as const,
          sourceStoryId: 's1',
        },
      ],
    }
    expect(findingArcStage(finding, report, [])).toBe('investigando')
  })

  it('hipótesis de OTRO hallazgo no cuenta', () => {
    const report = {
      hypotheses: [
        { id: 'h1', text: '', confidence: 60, status: 'open' as const, sourceFindingId: 'f-agua' },
      ],
    }
    expect(findingArcStage(finding, report, [])).toBe('encontrado')
  })

  it('hipótesis descartada o inconclusa no sostiene "investigando"', () => {
    const report = {
      hypotheses: [
        {
          id: 'h1',
          text: '',
          confidence: 60,
          status: 'discarded' as const,
          sourceFindingId: 'f-deficit',
        },
      ],
    }
    expect(findingArcStage(finding, report, [])).toBe('encontrado')
  })

  it('recurrencia en un reporte anterior → confirmado', () => {
    expect(findingArcStage(finding, {}, ['deficit'])).toBe('confirmado')
  })

  it('hipótesis confirmada (ciclo R5) → confirmado, aun sin historia', () => {
    const report = {
      hypotheses: [
        {
          id: 'h1',
          text: '',
          confidence: 80,
          status: 'confirmed' as const,
          sourceFindingId: 'f-deficit',
        },
      ],
    }
    expect(findingArcStage(finding, report, [])).toBe('confirmado')
  })

  it('la recurrencia es por categoría, no por id exacto', () => {
    expect(findingArcStage({ id: 'otro-id', category: 'deficit' }, {}, ['deficit'])).toBe(
      'confirmado',
    )
  })
})

describe('el arco visible', () => {
  it('4 pasos, índice correcto por estado ("observado" siempre quedó atrás)', () => {
    expect(FINDING_ARC_STEPS).toHaveLength(4)
    expect(findingArcIndex('encontrado')).toBe(1)
    expect(findingArcIndex('investigando')).toBe(2)
    expect(findingArcIndex('confirmado')).toBe(3)
  })

  it('copy llano: sin ✦, sin porcentajes, sin lenguaje clínico', () => {
    for (const label of Object.values(FINDING_ARC_LABEL)) {
      expect(label).not.toContain('✦')
      expect(label).not.toMatch(/%|\d/)
      expect(label.toLowerCase()).not.toMatch(/atracón|trastorno|disorder/)
    }
  })
})

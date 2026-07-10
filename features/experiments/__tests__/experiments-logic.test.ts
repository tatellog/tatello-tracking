import {
  buildExperimentScaffold,
  canCloseTo,
  canStart,
  clampDuration,
  DEFAULT_DURATION_DAYS,
  isTerminal,
  MAX_DURATION_DAYS,
  type ExperimentStatus,
} from '../logic'

const hyp = (o: { id: string; sourceFindingId?: string }) => ({
  id: o.id,
  sourceFindingId: o.sourceFindingId,
})
const finding = (
  id: string,
  category: Parameters<typeof buildExperimentScaffold>[1]['category'],
) => ({
  id,
  category,
})

describe('buildExperimentScaffold — spec medible, sin prosa (T-B1)', () => {
  it('mapea cada dimensión medible a su métrica, dirección increase, ≤2 semanas', () => {
    const cases = [
      ['deficit', 'deficit_days'],
      ['movimiento', 'workout_days'],
      ['sueno', 'days_slept_7h'],
      ['agua', 'water_goal_days'],
      ['proteina', 'protein_target_days'],
    ] as const
    for (const [dimension, metric] of cases) {
      const plan = buildExperimentScaffold(
        hyp({ id: 'h', sourceFindingId: 'f' }),
        finding('f', dimension),
      )
      expect(plan).not.toBeNull()
      expect(plan!.dimension).toBe(dimension)
      expect(plan!.metric).toBe(metric)
      expect(plan!.direction).toBe('increase')
      expect(plan!.durationDays).toBe(DEFAULT_DURATION_DAYS)
      expect(plan!.durationDays).toBeLessThanOrEqual(MAX_DURATION_DAYS)
    }
  })

  it('NO produce prosa: solo estructura (sin campos de texto prescriptivo)', () => {
    const plan = buildExperimentScaffold(
      hyp({ id: 'h', sourceFindingId: 'f' }),
      finding('f', 'sueno'),
    )
    expect(Object.keys(plan!).sort()).toEqual(['dimension', 'direction', 'durationDays', 'metric'])
  })

  it('alimentacion no da un experimento reversible limpio → null', () => {
    expect(
      buildExperimentScaffold(hyp({ id: 'h', sourceFindingId: 'f' }), finding('f', 'alimentacion')),
    ).toBeNull()
  })

  it('rechaza si la hipótesis apunta a otro finding (integridad del par)', () => {
    expect(
      buildExperimentScaffold(hyp({ id: 'h', sourceFindingId: 'otro' }), finding('f', 'sueno')),
    ).toBeNull()
  })

  it('acepta hipótesis sin sourceFindingId (viene de una historia)', () => {
    const plan = buildExperimentScaffold(hyp({ id: 'h' }), finding('f', 'agua'))
    expect(plan).not.toBeNull()
  })

  it('acota la duración pedida al tope de 2 semanas', () => {
    const plan = buildExperimentScaffold(hyp({ id: 'h' }), finding('f', 'deficit'), {
      durationDays: 30,
    })
    expect(plan!.durationDays).toBe(MAX_DURATION_DAYS)
  })
})

describe('clampDuration', () => {
  it('acota a [1, 14] y enteriza', () => {
    expect(clampDuration(30)).toBe(14)
    expect(clampDuration(7.9)).toBe(7)
    expect(clampDuration(0)).toBe(1)
    expect(clampDuration(-5)).toBe(1)
    expect(clampDuration(NaN)).toBe(0)
  })
})

describe('máquina de estados', () => {
  const all: ExperimentStatus[] = ['running', 'confirmed', 'discarded', 'inconclusive']

  it('isTerminal: los 3 resultados sí, running no', () => {
    expect(isTerminal('running')).toBe(false)
    expect(isTerminal('confirmed')).toBe(true)
    expect(isTerminal('discarded')).toBe(true)
    expect(isTerminal('inconclusive')).toBe(true)
  })

  it('canCloseTo: solo running → terminal; nunca reabrir ni terminal→terminal', () => {
    expect(canCloseTo('running', 'confirmed')).toBe(true)
    expect(canCloseTo('running', 'discarded')).toBe(true)
    expect(canCloseTo('running', 'inconclusive')).toBe(true)
    expect(canCloseTo('running', 'running')).toBe(false) // no cierra a sí mismo
    expect(canCloseTo('confirmed', 'discarded')).toBe(false) // resultado inmutable
    for (const from of all.filter((s) => s !== 'running')) {
      for (const to of all) expect(canCloseTo(from, to)).toBe(false)
    }
  })

  it('canStart: solo si no hay ninguno corriendo (≤1 activo)', () => {
    expect(canStart(0)).toBe(true)
    expect(canStart(1)).toBe(false)
    expect(canStart(2)).toBe(false)
  })
})

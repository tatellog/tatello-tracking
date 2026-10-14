import { parseFeedbackState, recordFeedback } from '../insight-feedback'

/*
 * ST-008 corte 2 · "¿Esto coincide con tus días?": la primera respuesta se
 * queda y no se vuelve a preguntar; lo guardado en el teléfono se lee limpio.
 */
describe('recordFeedback', () => {
  it('guarda la respuesta del hallazgo', () => {
    expect(recordFeedback({}, 'steps-deficit', 'no_match')).toEqual({ 'steps-deficit': 'no_match' })
  })

  it('la primera respuesta se queda', () => {
    const s = recordFeedback({}, 'x', 'matches')
    expect(recordFeedback(s, 'x', 'no_match')).toBe(s)
  })

  it('cada hallazgo tiene la suya', () => {
    const s = recordFeedback(recordFeedback({}, 'x', 'matches'), 'y', 'unsure')
    expect(s).toEqual({ x: 'matches', y: 'unsure' })
  })
})

describe('parseFeedbackState', () => {
  it('descarta valores rotos o desconocidos', () => {
    expect(parseFeedbackState({ x: 'matches', y: 'useful', z: 3 })).toEqual({ x: 'matches' })
    expect(parseFeedbackState(null)).toEqual({})
    expect(parseFeedbackState('basura')).toEqual({})
  })
})

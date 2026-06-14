import {
  selectRevelation,
  transformationCopy,
  patternRevelationCopy,
  RETURN_DEDUP_MS,
  PATTERN_RATE_LIMIT_MS,
  TRANSFORMATION_THRESHOLDS,
} from '../logic'
import type { OrchestratorInput, OrchestratorPattern } from '../logic'

// nowMs fijo · mismo eje que los otros tests del proyecto
const NOW_MS = new Date('2026-05-28T15:00:00').getTime()

// Helpers para construir inputs mínimos
function baseInput(overrides: Partial<OrchestratorInput> = {}): OrchestratorInput {
  return {
    nowMs: NOW_MS,
    transformProgress: 0,
    shownTransformationKinds: [],
    signLabel: 'Leo',
    returnSignal: false,
    lastReturnAtMs: null,
    pattern: null,
    lastPatternAtMs: null,
    ...overrides,
  }
}

const samplePattern: OrchestratorPattern = {
  kind: 'protein_consistent',
  message: 'La proteína apareció constante: la alcanzaste en 5 de los últimos 7 días.',
  title: 'Proteína constante.',
}

// --- selectRevelation: prioridad ---

describe('selectRevelation — prioridad Regreso > Transformación > Patrón', () => {
  test('devuelve tier return cuando hay señal de regreso sin reveal reciente', () => {
    const input = baseInput({ returnSignal: true, lastReturnAtMs: null })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('return')
    expect(result?.kind).toBe('return')
  })

  test('regreso tiene mayor prioridad que transformación y patrón pendientes', () => {
    const input = baseInput({
      returnSignal: true,
      lastReturnAtMs: null,
      transformProgress: 80,
      shownTransformationKinds: [],
      pattern: samplePattern,
      lastPatternAtMs: null,
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('return')
  })

  test('transformación tiene mayor prioridad que patrón cuando no hay regreso', () => {
    const input = baseInput({
      returnSignal: false,
      transformProgress: 60,
      shownTransformationKinds: ['25'],
      pattern: samplePattern,
      lastPatternAtMs: null,
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('transformation')
    expect(result?.kind).toBe('50')
  })

  test('devuelve el umbral de transformación MÁS BAJO no mostrado', () => {
    // progress 80, ya mostró 25 → el siguiente es 50
    const input = baseInput({
      transformProgress: 80,
      shownTransformationKinds: ['25'],
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('transformation')
    expect(result?.kind).toBe('50')
  })

  test('devuelve tier pattern cuando no hay regreso ni transformación pendiente', () => {
    const input = baseInput({
      transformProgress: 0,
      shownTransformationKinds: [],
      pattern: samplePattern,
      lastPatternAtMs: null,
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('pattern')
    expect(result?.kind).toBe(samplePattern.kind)
    expect(result?.message).toBe(samplePattern.message)
    expect(result?.title).toBe(samplePattern.title)
  })

  test('devuelve null cuando no hay nada que mostrar', () => {
    const result = selectRevelation(baseInput())

    expect(result).toBeNull()
  })
})

// --- selectRevelation: rate-limits ---

describe('selectRevelation — rate-limits', () => {
  test('regreso con lastReturnAtMs reciente (< 20h) → no dispara regreso', () => {
    const recentReturn = NOW_MS - RETURN_DEDUP_MS + 1000 // 1 segundo antes del límite
    const input = baseInput({ returnSignal: true, lastReturnAtMs: recentReturn })

    const result = selectRevelation(input)

    expect(result?.tier).not.toBe('return')
  })

  test('regreso con lastReturnAtMs exactamente RETURN_DEDUP_MS atrás → no dispara (límite estricto)', () => {
    // La condición es > RETURN_DEDUP_MS, por tanto en el límite exacto NO dispara
    const exactLimit = NOW_MS - RETURN_DEDUP_MS
    const input = baseInput({ returnSignal: true, lastReturnAtMs: exactLimit })

    const result = selectRevelation(input)

    expect(result?.tier).not.toBe('return')
  })

  test('regreso con lastReturnAtMs > RETURN_DEDUP_MS atrás → sí dispara', () => {
    const oldReturn = NOW_MS - RETURN_DEDUP_MS - 1000
    const input = baseInput({ returnSignal: true, lastReturnAtMs: oldReturn })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('return')
  })

  test('patrón con lastPatternAtMs dentro de 7 días → no dispara patrón', () => {
    const recentPattern = NOW_MS - PATTERN_RATE_LIMIT_MS + 1000
    const input = baseInput({
      pattern: samplePattern,
      lastPatternAtMs: recentPattern,
    })

    const result = selectRevelation(input)

    expect(result).toBeNull()
  })

  test('patrón con lastPatternAtMs exactamente 7 días atrás → sí dispara', () => {
    const exactLimit = NOW_MS - PATTERN_RATE_LIMIT_MS
    const input = baseInput({
      pattern: samplePattern,
      lastPatternAtMs: exactLimit,
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('pattern')
  })

  test('patrón con lastPatternAtMs null → sí dispara (nunca mostrado)', () => {
    const input = baseInput({ pattern: samplePattern, lastPatternAtMs: null })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('pattern')
  })
})

// --- selectRevelation: umbrales de transformación ---

describe('selectRevelation — umbrales de transformación', () => {
  test('progress 24 con ningún umbral mostrado → no hay transformación pendiente', () => {
    const input = baseInput({ transformProgress: 24, shownTransformationKinds: [] })

    const result = selectRevelation(input)

    expect(result).toBeNull()
  })

  test('progress 25 con ningún umbral mostrado → devuelve umbral 25', () => {
    const input = baseInput({ transformProgress: 25, shownTransformationKinds: [] })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('transformation')
    expect(result?.kind).toBe('25')
  })

  test('progress 100 con todos los umbrales ya mostrados → no hay transformación pendiente', () => {
    const input = baseInput({
      transformProgress: 100,
      shownTransformationKinds: ['25', '50', '75', '100'],
    })

    const result = selectRevelation(input)

    expect(result).toBeNull()
  })

  test('progress 100 con 25/50/75 mostrados → devuelve umbral 100', () => {
    const input = baseInput({
      transformProgress: 100,
      shownTransformationKinds: ['25', '50', '75'],
    })

    const result = selectRevelation(input)

    expect(result?.tier).toBe('transformation')
    expect(result?.kind).toBe('100')
  })
})

// --- transformationCopy ---

describe('transformationCopy', () => {
  const SIGN = 'Leo'

  test.each(TRANSFORMATION_THRESHOLDS)(
    'devuelve message y title no vacíos para el umbral %i',
    (threshold) => {
      const copy = transformationCopy(threshold, SIGN)

      expect(copy.message).toBeTruthy()
      expect(copy.title).toBeTruthy()
    },
  )

  test('interpola el signLabel en message y title (umbral 25)', () => {
    const copy = transformationCopy(25, SIGN)

    expect(copy.message).toContain(SIGN)
    expect(copy.title).toContain(SIGN)
  })

  test('interpola el signLabel en message y title (umbral 100)', () => {
    const copy = transformationCopy(100, SIGN)

    expect(copy.message).toContain(SIGN)
    expect(copy.title).toContain(SIGN)
  })

  test('message y title del umbral 50 interpolan el signLabel correctamente', () => {
    const copy = transformationCopy(50, 'Virgo')

    expect(copy.message).toContain('Virgo')
    expect(copy.title).toContain('Virgo')
  })
})

// --- patternRevelationCopy ---

describe('patternRevelationCopy', () => {
  test('protein_consistent: interpola count y windowDays en el message', () => {
    const copy = patternRevelationCopy('protein_consistent', 5, 7)

    expect(copy.message).toContain('5')
    expect(copy.message).toContain('7')
    expect(copy.title).toBeTruthy()
  })

  test('training_consistent: interpola count y windowDays en el message', () => {
    const copy = patternRevelationCopy('training_consistent', 4, 7)

    expect(copy.message).toContain('4')
    expect(copy.message).toContain('7')
    expect(copy.title).toBeTruthy()
  })

  test('sleep_consistent: interpola count y windowDays en el message', () => {
    const copy = patternRevelationCopy('sleep_consistent', 6, 7)

    expect(copy.message).toContain('6')
    expect(copy.message).toContain('7')
    expect(copy.title).toBeTruthy()
  })

  test('night_eating: interpola count y windowDays en el message', () => {
    const copy = patternRevelationCopy('night_eating', 3, 7)

    expect(copy.message).toContain('3')
    expect(copy.message).toContain('7')
    expect(copy.title).toBeTruthy()
  })

  test('kind desconocido cae en el default (night_eating) y retorna copy válido', () => {
    const copy = patternRevelationCopy('unknown_pattern', 2, 7)

    expect(copy.message).toBeTruthy()
    expect(copy.title).toBeTruthy()
  })
})

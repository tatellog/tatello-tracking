import {
  canConfirmIngredients,
  mergeRescan,
  parseDecimalInput,
  perPortionToPer100,
  withTypedMacro,
} from '../review-logic'
import type { ScannedIngredient } from '../scan'

jest.mock('expo-image-manipulator', () => ({}))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
// eslint-disable-next-line import/first
import { ingredientKcal, ingredientProtein, mealTotals } from '../scan'

/*
 * ST-004 · la revisión de una comida escaneada: números con decimales, la
 * porción a per-100, los datos que la etiqueta no trajo y reescanear sin
 * borrar lo agregado a mano.
 */
const ing = (o: Partial<ScannedIngredient> = {}): ScannedIngredient => ({
  id: 'ing-0',
  name: 'Yogurt',
  grams: 150,
  proteinPer100: 9,
  kcalPer100: 97,
  ...o,
})

describe('parseDecimalInput', () => {
  it('"12.5" es 12.5, no 125 (el bug de ×10)', () => {
    expect(parseDecimalInput('12.5')).toBe(12.5)
  })
  it('acepta coma decimal y quita unidades', () => {
    expect(parseDecimalInput('12,5')).toBe(12.5)
    expect(parseDecimalInput('150 g')).toBe(150)
  })
  it('vacío o basura → 0; ".5" → 0.5', () => {
    expect(parseDecimalInput('')).toBe(0)
    expect(parseDecimalInput('abc')).toBe(0)
    expect(parseDecimalInput('.5')).toBe(0.5)
  })
})

describe('porción ↔ per-100', () => {
  it('lo de SU porción se guarda per-100 y vuelve igual', () => {
    const per100 = perPortionToPer100(30, 150) // 30 g de proteína en 150 g
    expect(per100).toBe(20)
    expect(ingredientProtein({ grams: 150, proteinPer100: per100 })).toBe(30)
  })
  it('mealTotals suma lo de cada fila a sus gramos', () => {
    const t = mealTotals([ing(), ing({ id: 'b', grams: 50, proteinPer100: 20, kcalPer100: 400 })])
    expect(t.protein).toBeCloseTo(13.5 + 10)
    expect(t.calories).toBeCloseTo(145.5 + 200)
    expect(ingredientKcal(ing())).toBeCloseTo(145.5)
  })
})

describe('datos que la etiqueta no trajo', () => {
  it('no se puede guardar con un dato faltante', () => {
    expect(canConfirmIngredients([ing({ source: 'etiqueta', missing: ['protein'] })])).toBe(false)
  })
  it('al escribirlo deja de faltar y la fila pasa a "ajustada por ti"', () => {
    const fixed = withTypedMacro(
      ing({ source: 'etiqueta', proteinPer100: 0, missing: ['protein'] }),
      'protein',
      '13.5',
    )
    expect(fixed.missing).toBeUndefined()
    expect(fixed.source).toBe('manual')
    expect(ingredientProtein(fixed)).toBeCloseTo(13.5)
    expect(canConfirmIngredients([fixed])).toBe(true)
  })
  it('un manual sin kcal sigue sin poder guardarse; una lista vacía tampoco', () => {
    expect(canConfirmIngredients([ing({ source: 'manual', kcalPer100: 0 })])).toBe(false)
    expect(canConfirmIngredients([])).toBe(false)
  })
})

describe('mergeRescan', () => {
  it('reescanear conserva lo que ella agregó y reemplaza lo escaneado', () => {
    const current = [
      ing({ id: 'ing-0' }),
      ing({ id: 'ing-171', name: 'Granola', source: 'manual' }),
    ]
    const fresh = [ing({ id: 'ing-0', name: 'Yogurt griego' })]
    const merged = mergeRescan(fresh, current, new Set(['ing-0']))
    expect(merged.map((i) => i.name)).toEqual(['Yogurt griego', 'Granola'])
  })
})

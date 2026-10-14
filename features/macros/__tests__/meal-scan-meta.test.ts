jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
// eslint-disable-next-line import/first
import { mealScanMeta } from '../api'

/* ST-004 · H3/H10: la lectura del scan se guarda con la comida y se lee limpia. */
describe('mealScanMeta', () => {
  it('lee la confianza y la base de la etiqueta', () => {
    expect(
      mealScanMeta({
        ai_raw_response: {
          ingredients: [],
          scan: { confidence: 'media', label: { basis: 'perServing', servingGrams: 30 } },
        },
      }),
    ).toEqual({ confidence: 'media', label: { basis: 'perServing', servingGrams: 30 } })
  })

  it('una comida vieja (sin scan) o un valor roto → null', () => {
    expect(mealScanMeta({ ai_raw_response: { ingredients: [] } })).toBeNull()
    expect(mealScanMeta({ ai_raw_response: null })).toBeNull()
    expect(mealScanMeta({ ai_raw_response: { scan: { confidence: 'altísima' } } })).toBeNull()
  })
})

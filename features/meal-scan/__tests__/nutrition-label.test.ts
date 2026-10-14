import { normalizeLabel } from '../nutrition-label'

/*
 * ST-004 · H3: la conversión de la etiqueta a per-100 la hace código, no el
 * modelo. Lo que falta o es imposible llega como null (se pide, no se inventa).
 */
describe('normalizeLabel', () => {
  it('por 100 g: los números quedan igual y la porción declarada son los gramos', () => {
    expect(
      normalizeLabel('Yogurt', {
        basis: 'per100',
        servingGrams: 150,
        kcal: 97,
        protein: 9,
        sugar: 4,
      }),
    ).toEqual({ name: 'Yogurt', grams: 150, kcalPer100: 97, proteinPer100: 9, sugarPer100: 4 })
  })

  it('por porción: se pasa a per-100 con la porción declarada', () => {
    // Porción de 30 g: 120 kcal, 3 g de proteína → 400 kcal y 10 g por 100 g.
    const r = normalizeLabel('Galletas', {
      basis: 'perServing',
      servingGrams: 30,
      kcal: 120,
      protein: 3,
      sugar: 9,
    })
    expect(r).toMatchObject({ grams: 30, kcalPer100: 400, proteinPer100: 10, sugarPer100: 30 })
  })

  it('por 100 g sin porción declarada: 100 g', () => {
    expect(
      normalizeLabel('Leche', {
        basis: 'per100',
        servingGrams: null,
        kcal: 42,
        protein: 3.4,
        sugar: 5,
      }).grams,
    ).toBe(100)
  })

  it('por porción sin saber la porción: no se inventa la conversión', () => {
    const r = normalizeLabel('Barra', {
      basis: 'perServing',
      servingGrams: null,
      kcal: 200,
      protein: 10,
      sugar: 12,
    })
    expect(r).toMatchObject({ kcalPer100: null, proteinPer100: null, sugarPer100: 0 })
  })

  it('un número que no se leyó llega null; el azúcar que falta es 0', () => {
    const r = normalizeLabel('Jugo', {
      basis: 'per100',
      servingGrams: 250,
      kcal: 45,
      protein: null,
      sugar: null,
    })
    expect(r).toMatchObject({ kcalPer100: 45, proteinPer100: null, sugarPer100: 0 })
  })

  it('un número imposible (45 leído como 450 g de proteína) se pide en vez de guardarse', () => {
    const r = normalizeLabel('Atún', {
      basis: 'per100',
      servingGrams: 140,
      kcal: 116,
      protein: 260,
      sugar: 0,
    })
    expect(r.proteinPer100).toBeNull()
    expect(r.kcalPer100).toBe(116)
  })
})

import { PROTEIN_EQUIVALENTS, suggestProteinSource } from '@/features/macros/proteinEquivalents'

describe('PROTEIN_EQUIVALENTS table', () => {
  it('is non-empty and every row has plausible numbers', () => {
    expect(PROTEIN_EQUIVALENTS.length).toBeGreaterThan(0)
    for (const row of PROTEIN_EQUIVALENTS) {
      expect(row.proteinPer100g).toBeGreaterThan(0)
      expect(row.proteinPer100g).toBeLessThan(100)
      expect(row.food.length).toBeGreaterThan(0)
    }
  })

  it('covers every protein category exactly once or more', () => {
    const categories = new Set(PROTEIN_EQUIVALENTS.map((r) => r.category))
    expect(categories.size).toBeGreaterThanOrEqual(6)
  })
})

describe('suggestProteinSource — snack band (≤ 20g)', () => {
  it('suggests eggs in the morning', () => {
    expect(suggestProteinSource(12, 8)).toMatch(/2 huevos te lo cubren/i)
  })

  it('suggests yogurt or whey in the afternoon (15–18)', () => {
    expect(suggestProteinSource(15, 16)).toMatch(/yogurt griego o whey/i)
  })

  it('suggests tuna or whey in the evening', () => {
    expect(suggestProteinSource(10, 20)).toMatch(/lata de atún o whey/i)
  })

  it('suggests tuna or whey at midday gap (between morning and afternoon bands)', () => {
    expect(suggestProteinSource(15, 13)).toMatch(/lata de atún o whey/i)
  })
})

describe('suggestProteinSource — meal band (21–50g)', () => {
  it('points at the dinner plate after 18:00', () => {
    expect(suggestProteinSource(45, 19)).toMatch(/pollo o pescado a la cena/i)
  })

  it('gives a generic strong-protein nudge during the day', () => {
    expect(suggestProteinSource(45, 14)).toMatch(/algo proteico fuerte/i)
  })
})

describe('suggestProteinSource — catch-up band (> 50g)', () => {
  it('honestly spreads the need across multiple meals', () => {
    const s = suggestProteinSource(80, 14)
    expect(s).toMatch(/varias comidas/i)
    expect(s).toMatch(/pollo|atún|pescado/i)
  })
})

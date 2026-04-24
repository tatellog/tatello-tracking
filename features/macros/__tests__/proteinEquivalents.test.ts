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
    const s = suggestProteinSource(12, 8)
    expect(s).toMatch(/huevos/i)
  })

  it('suggests yogurt or whey in the afternoon', () => {
    const s = suggestProteinSource(15, 16)
    expect(s).toMatch(/yogurt|whey/i)
  })

  it('suggests whey or tuna in the evening', () => {
    const s = suggestProteinSource(10, 20)
    expect(s).toMatch(/whey|atún/i)
  })
})

describe('suggestProteinSource — meal band (21–50g)', () => {
  it('suggests grams of lean protein in the afternoon', () => {
    const s = suggestProteinSource(45, 14)
    expect(s).toMatch(/\d+g/)
    expect(s).toMatch(/magra/i)
  })

  it('calls out dinner explicitly after 18:00', () => {
    const s = suggestProteinSource(45, 19)
    expect(s).toMatch(/cena/i)
    expect(s).toMatch(/pollo|pescado/i)
  })

  it('scales grams roughly linearly with the protein need', () => {
    const small = suggestProteinSource(25, 14)
    const big = suggestProteinSource(48, 14)
    const extractG = (s: string) => Number(s.match(/(\d+)g/)?.[1])
    expect(extractG(big)).toBeGreaterThan(extractG(small))
  })
})

describe('suggestProteinSource — catch-up band (> 50g)', () => {
  it('honestly spreads the need across multiple meals', () => {
    const s = suggestProteinSource(80, 14)
    expect(s).toMatch(/más de 50g/i)
    expect(s).toMatch(/2 comidas/i)
  })
})

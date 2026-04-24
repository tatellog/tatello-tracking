import { deriveMacroMessage } from '@/features/macros/logic'

const TARGETS = { protein_g: 130, calories: 1800 }

describe('deriveMacroMessage — six AC6 scenarios', () => {
  it('1 — morning with no meals → breakfast nudge', () => {
    const msg = deriveMacroMessage({ protein_g: 0, calories: 0 }, TARGETS, 8, 0)
    expect(msg).toMatch(/desayuno/i)
    expect(msg).toMatch(/huevos|yogurt/i)
  })

  it('2 — afternoon with no meals → start proteico', () => {
    const msg = deriveMacroMessage({ protein_g: 0, calories: 0 }, TARGETS, 14, 0)
    expect(msg).toMatch(/media tarde/i)
    expect(msg).toMatch(/proteic/i)
  })

  it('3 — protein goal met, calories still room → calorie space copy', () => {
    const msg = deriveMacroMessage({ protein_g: 135, calories: 1200 }, TARGETS, 15, 3)
    expect(msg).toMatch(/Proteína lista/i)
    expect(msg).toMatch(/cal/i)
    expect(msg).toMatch(/carbo/i)
  })

  it('4 — large protein gap in the evening → dinner suggestion with grams', () => {
    const msg = deriveMacroMessage({ protein_g: 40, calories: 800 }, TARGETS, 19, 2)
    expect(msg).toMatch(/faltan 90g/i)
    // large-gap falls in the >50g band → "más de 50g" copy
    expect(msg).toMatch(/más de 50g/i)
  })

  it('5 — on-track but some protein remaining → encouraging nudge', () => {
    const msg = deriveMacroMessage({ protein_g: 110, calories: 1400 }, TARGETS, 18, 3)
    expect(msg).toMatch(/Vas bien/i)
    expect(msg).toMatch(/\d+g/)
  })

  it('6 — calories significantly over → overshoot copy', () => {
    const msg = deriveMacroMessage({ protein_g: 140, calories: 2100 }, TARGETS, 20, 4)
    expect(msg).toMatch(/Pasaste tu meta/i)
    expect(msg).toMatch(/\d+/)
    expect(msg).toMatch(/entrenas/i)
  })
})

describe('deriveMacroMessage — edge behaviour', () => {
  it('surfaces over-delivery when protein is significantly above target', () => {
    const msg = deriveMacroMessage({ protein_g: 200, calories: 1500 }, TARGETS, 15, 4)
    // proteinPct 1.54 > 1.1 → 'Proteína superada' wins before 'lista'.
    expect(msg).toMatch(/superada/i)
  })

  it('protein super-met and calories in range → positive close', () => {
    const msg = deriveMacroMessage({ protein_g: 155, calories: 1750 }, TARGETS, 21, 4)
    expect(msg).toMatch(/superada|Buen día/i)
  })

  it('mid-day small gap → default summary line', () => {
    const msg = deriveMacroMessage({ protein_g: 50, calories: 1000 }, TARGETS, 13, 2)
    // protein 38% → not on-track-band (needs >=70%), not huge gap (80 > 30)
    // falls in the "large gap during day" branch
    expect(msg).toMatch(/Faltan|Te quedan/)
  })
})

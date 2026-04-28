import { deriveMacroMessage } from '@/features/macros/logic'

const TARGETS = { protein_g: 130, calories: 1800 }

describe('deriveMacroMessage — primary scenarios', () => {
  it('1 — morning with no meals → breakfast nudge', () => {
    const msg = deriveMacroMessage({ protein_g: 0, calories: 0 }, TARGETS, 8, 0)
    expect(msg).toMatch(/día abierto/i)
    expect(msg).toMatch(/huevos|yogurt/i)
  })

  it('2 — afternoon with no meals → start proteico nudge', () => {
    const msg = deriveMacroMessage({ protein_g: 0, calories: 0 }, TARGETS, 14, 0)
    expect(msg).toMatch(/aún no loggeas/i)
    expect(msg).toMatch(/proteic/i)
  })

  it('3 — protein goal met, calories still room → calorie space copy', () => {
    const msg = deriveMacroMessage({ protein_g: 135, calories: 1200 }, TARGETS, 15, 3)
    expect(msg).toMatch(/proteína cerrada/i)
    expect(msg).toMatch(/cal/i)
    expect(msg).toMatch(/cena/i)
  })

  it('4 — large protein gap in the evening → reassuring dinner copy', () => {
    const msg = deriveMacroMessage({ protein_g: 40, calories: 800 }, TARGETS, 19, 2)
    expect(msg).toMatch(/vas atrasada/i)
    expect(msg).toMatch(/90g por delante/i)
    expect(msg).toMatch(/y la pegas/i)
  })

  it('5 — on-track but some protein remaining → encouraging nudge', () => {
    const msg = deriveMacroMessage({ protein_g: 110, calories: 1400 }, TARGETS, 18, 3)
    expect(msg).toMatch(/vas bien/i)
    expect(msg).toMatch(/por cerrar/i)
    expect(msg).toMatch(/\d+g/)
  })

  it('6 — calories significantly over → overshoot copy', () => {
    const msg = deriveMacroMessage({ protein_g: 140, calories: 2100 }, TARGETS, 20, 4)
    expect(msg).toMatch(/te pasaste por/i)
    expect(msg).toMatch(/\d+ cal/)
    expect(msg).toMatch(/entrenaste/i)
  })
})

describe('deriveMacroMessage — edge behaviour', () => {
  it('surfaces over-delivery when protein is significantly above target', () => {
    const msg = deriveMacroMessage({ protein_g: 200, calories: 1500 }, TARGETS, 15, 4)
    // proteinPct 1.54 > 1.1 → 'Proteína superada' wins before 'cerrada'.
    expect(msg).toMatch(/superada/i)
    expect(msg).toMatch(/buen día/i)
  })

  it('protein super-met and calories in range → positive close', () => {
    const msg = deriveMacroMessage({ protein_g: 155, calories: 1750 }, TARGETS, 21, 4)
    expect(msg).toMatch(/superada|buen día/i)
  })

  it('mid-day large gap → daytime distribution copy', () => {
    const msg = deriveMacroMessage({ protein_g: 50, calories: 1000 }, TARGETS, 13, 2)
    // protein 38% with 80g remaining → daytime large-gap branch.
    expect(msg).toMatch(/andas baja/i)
    expect(msg).toMatch(/80g pendientes/i)
  })

  it('late no-meals → ayuno-or-forgot copy', () => {
    const msg = deriveMacroMessage({ protein_g: 0, calories: 0 }, TARGETS, 19, 0)
    expect(msg).toMatch(/día sin loggear/i)
    expect(msg).toMatch(/olvido|ayuno/i)
  })
})

import { buildDayGoal } from '../day-goal'
import { mkSig } from './signals.fixture'

const DAY = '2026-06-28'
const CTX = { proteinTarget: 120, calorieTarget: 1500, waterGoalGlasses: 8 }

const find = <T extends { key: string }>(list: T[], key: string): T | undefined =>
  list.find((x) => x.key === key)

describe('buildDayGoal — héroe del objetivo', () => {
  it('null cuando no hubo ningún registro', () => {
    expect(buildDayGoal(mkSig(DAY, {}), CTX)).toBeNull()
    expect(buildDayGoal(null, CTX)).toBeNull()
  })

  it('incompleto: sin comida o sin meta de calorías', () => {
    const noFood = buildDayGoal(mkSig(DAY, { sleep_minutes: 420 }), CTX)!
    expect(noFood.hero.status).toBe('incomplete')
    expect(noFood.hero.deltaKcal).toBeNull()

    const noTarget = buildDayGoal(mkSig(DAY, { calories: 1200 }), { ...CTX, calorieTarget: null })!
    expect(noTarget.hero.status).toBe('incomplete')
  })

  it('déficit: consumo bajo la meta → status deficit + delta = meta - consumo', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, meal_count: 3 }), CTX)!
    expect(g.hero.status).toBe('deficit')
    expect(g.hero.deltaKcal).toBe(220)
    expect(g.hero.over).toBe(0)
    expect(g.hero.fill).toBeCloseTo(1280 / 1500)
  })

  it('sobre objetivo: consumo sobre la meta → status over + delta = exceso', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1700, meal_count: 3 }), CTX)!
    expect(g.hero.status).toBe('over')
    expect(g.hero.deltaKcal).toBe(200)
    expect(g.hero.fill).toBe(1)
    expect(g.hero.over).toBeCloseTo(200 / 1500)
  })
})

describe('buildDayGoal — evidencia', () => {
  it('el déficit NO se repite en la evidencia (ya es el héroe)', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, meal_count: 2 }), CTX)!
    expect(find(g.evidence, 'deficit')).toBeUndefined()
  })

  it('el conteo de comidas NO es evidencia (Regla #1)', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, meal_count: 3 }), CTX)!
    expect(find(g.evidence, 'meals')).toBeUndefined()
  })

  it('proteína en objetivo, entreno, sueño y agua completa', () => {
    const g = buildDayGoal(
      mkSig(DAY, {
        calories: 1280,
        protein_g: 130,
        trained: true,
        sleep_minutes: 450,
        water_glasses: 8,
      }),
      CTX,
    )!
    expect(find(g.evidence, 'protein')!.label).toBe('Proteína en objetivo')
    expect(find(g.evidence, 'train')).toBeTruthy()
    expect(find(g.evidence, 'sleep')!.detail).toBe('7.5 h')
    expect(find(g.evidence, 'water')!.label).toBe('Agua completa')
  })

  it('proteína en progreso conserva el dato real, sin "en objetivo"', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, protein_g: 90 }), CTX)!
    expect(find(g.evidence, 'protein')!.label).toBe('Proteína')
    expect(find(g.evidence, 'protein')!.detail).toBe('90 / 120 g')
  })

  it('bienestar: frase corta y humana, sin "calma alta/baja"', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, mood: 'good', energy: 5, stress: 1 }), CTX)!
    const w = find(g.evidence, 'wellbeing')!
    expect(w.label).toBe('Te sentiste bien')
    expect(w.detail).toBe('Energía alta')
  })
})

describe('buildDayGoal — lo que aún no aparece', () => {
  it('solo señales diarias; el ciclo nunca se pide como ausencia', () => {
    const g = buildDayGoal(mkSig(DAY, { meal_count: 2 }), CTX)!
    const keys = g.missing.map((m) => m.key)
    expect(keys).toContain('sueno')
    expect(keys).toContain('agua')
    expect(keys).toContain('animo')
    expect(keys).not.toContain('comida') // ya hay comida
    expect(keys).not.toContain('ciclo')
  })
})

describe('buildDayGoal — dirección y porqué', () => {
  it('déficit + proteína → dentro del objetivo, con porqué que sostiene', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, protein_g: 130, trained: true }), CTX)!
    expect(g.direction).toContain('dentro del objetivo')
    expect(find(g.why, 'deficit')!.supports).toBe(true)
    expect(find(g.why, 'protein')!.supports).toBe(true)
    expect(find(g.why, 'train')!.supports).toBe(true)
  })

  it('sobre objetivo → dirección honesta + porqué en contra', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1700 }), CTX)!
    expect(g.direction).toContain('sobre tu objetivo')
    expect(find(g.why, 'over')!.supports).toBe(false)
  })

  it('incompleto → sin porqué', () => {
    const g = buildDayGoal(mkSig(DAY, { sleep_minutes: 420 }), CTX)!
    expect(g.direction).toContain('incompleta')
    expect(g.why).toHaveLength(0)
  })

  it('bajo el piso (restricción) no se valida como dentro del objetivo', () => {
    // 600 < 0.6×1500 = 900 → déficit en el héroe, pero la lectura no celebra.
    const g = buildDayGoal(mkSig(DAY, { calories: 600, protein_g: 130 }), CTX)!
    expect(g.hero.status).toBe('deficit')
    expect(g.direction).not.toContain('dentro del objetivo')
    expect(g.direction).toContain('tomando forma')
    expect(find(g.why, 'deficit')).toBeUndefined()
    // la proteína sí se reconoce; el déficit extremo no.
    expect(find(g.why, 'protein')!.supports).toBe(true)
  })
})

describe('buildDayGoal — héroe palabra-titular', () => {
  it('la palabra es "Déficit" / "Sobre tu objetivo" / "Tu día aún se revela"', () => {
    expect(buildDayGoal(mkSig(DAY, { calories: 1280 }), CTX)!.hero.stateLabel).toBe('Déficit')
    expect(buildDayGoal(mkSig(DAY, { calories: 1700 }), CTX)!.hero.stateLabel).toBe(
      'Sobre tu objetivo',
    )
    expect(buildDayGoal(mkSig(DAY, { sleep_minutes: 420 }), CTX)!.hero.stateLabel).toBe(
      'Tu día aún se revela',
    )
  })

  it('observa en pasado al ver un día anterior (palabra igual, matiz en la línea)', () => {
    const g = buildDayGoal(mkSig(DAY, { calories: 1280, meal_count: 2 }), CTX, { past: true })!
    expect(g.hero.stateLabel).toBe('Déficit')
    expect(g.hero.line).toContain('Ese día')
    expect(g.direction.toLowerCase()).toContain('ese día')
  })
})

import { microReading } from '../micro-reading'

describe('microReading — con dato o silencio (V-01)', () => {
  it('prioriza proteína del día cuando hay meta y dato', () => {
    const r = microReading({
      dayProteinG: 56,
      proteinTarget: 90,
      dayCalories: 978,
      calorieTarget: 1463,
    })
    expect(r?.key).toBe('protein-day')
    expect(r?.text).toContain('56 g')
    expect(r?.text).toContain('90 g')
  })

  it('celebra sin countdown cuando la meta de proteína está cubierta', () => {
    const r = microReading({
      dayProteinG: 96.4,
      proteinTarget: 90,
      dayCalories: 1200,
      calorieTarget: 1463,
    })
    expect(r?.key).toBe('protein-day')
    expect(r?.text).toContain('está cubierta')
  })

  it('cae al margen del día (mismas palabras que Órbita) sin meta de proteína', () => {
    const r = microReading({
      dayProteinG: 56,
      proteinTarget: null,
      dayCalories: 978,
      calorieTarget: 1463,
    })
    expect(r?.key).toBe('deficit-margin')
    expect(r?.text).toContain('485 kcal')
  })

  it('calla en vez de regañar cuando el día quedó sobre el objetivo', () => {
    const r = microReading({
      dayProteinG: null,
      proteinTarget: null,
      dayCalories: 1800,
      calorieTarget: 1463,
    })
    expect(r).toBeNull()
  })

  it('calla sin metas ni datos (nunca relleno)', () => {
    expect(
      microReading({
        dayProteinG: null,
        proteinTarget: null,
        dayCalories: null,
        calorieTarget: null,
      }),
    ).toBeNull()
    expect(
      microReading({
        dayProteinG: 40,
        proteinTarget: null,
        dayCalories: 900,
        calorieTarget: null,
      }),
    ).toBeNull()
  })
})

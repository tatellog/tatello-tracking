import { DAY_VERDICT_CLOSE_HOUR, dayFocus, dayVerdict } from '../day-verdict'

const T = 1463 // piso sano = 0.6 × 1463 ≈ 878

describe('dayVerdict', () => {
  it('de día, con consumo bajo la meta: "Sigues en déficit" (responde la pregunta, sin número)', () => {
    const v = dayVerdict({ consumedCalories: 360, targetCalories: T, hour: 14 })
    expect(v.kind).toBe('open')
    expect(v.title).toBe('Sigues en déficit')
    expect(`${v.title} ${v.line}`).not.toMatch(/\d/)
    expect(v.ringTone).toBe('deficit')
  })

  it('desde las 20:00 bajo el piso sano: poco registrado, nunca en color de logro', () => {
    const v = dayVerdict({ consumedCalories: 360, targetCalories: T, hour: DAY_VERDICT_CLOSE_HOUR })
    expect(v.kind).toBe('low')
    expect(v.ringTone).toBe('incomplete')
    expect(v.title).not.toMatch(/déficit/i)
    expect(v.line).toContain('360 kcal')
    expect(v.cta).toBe('meal')
  })

  it('desde las 20:00 dentro de la franja sana: "Día en déficit"', () => {
    const v = dayVerdict({ consumedCalories: 1200, targetCalories: T, hour: 21 })
    expect(v.kind).toBe('deficit')
    expect(v.title).toBe('Día en déficit')
    expect(v.ringTone).toBe('deficit')
  })

  it('sobre la meta a cualquier hora: oro, sin culpa', () => {
    for (const hour of [13, 22]) {
      const v = dayVerdict({ consumedCalories: 1700, targetCalories: T, hour })
      expect(v.kind).toBe('over')
      expect(v.ringTone).toBe('over')
      expect(`${v.title} ${v.line}`).not.toMatch(/pasaste|exceso/i)
    }
  })

  it('sin comida o sin meta: invita, no juzga', () => {
    expect(dayVerdict({ consumedCalories: 0, targetCalories: T, hour: 9 }).cta).toBe('meal')
    expect(dayVerdict({ consumedCalories: 500, targetCalories: null, hour: 9 }).cta).toBe('target')
  })

  it('un día pasado siempre está cerrado y nunca ofrece registrar', () => {
    const low = dayVerdict({ consumedCalories: 360, targetCalories: T, hour: 9, past: true })
    expect(low.kind).toBe('low')
    expect(low.title).toBe('Ese día quedó con poco registro')
    expect(low.cta).toBeNull()
    const ok = dayVerdict({ consumedCalories: 1200, targetCalories: T, hour: 9, past: true })
    expect(ok.title).toBe('Ese día cerró en déficit')
  })
})

describe('dayFocus', () => {
  const open = dayVerdict({ consumedCalories: 360, targetCalories: T, hour: 14 })

  it('con el día en déficit y proteína pendiente, el foco es la proteína', () => {
    const f = dayFocus({ verdict: open, proteinG: 30, proteinTarget: 141 })
    expect(f?.title).toBe('La proteína')
    expect(f?.body).toContain('Faltan 111 g')
  })

  it('sin foco honesto que dar: proteína cerrada, sobre la meta, poco registro o día pasado', () => {
    expect(dayFocus({ verdict: open, proteinG: 150, proteinTarget: 141 })).toBeNull()
    const over = dayVerdict({ consumedCalories: 1700, targetCalories: T, hour: 14 })
    expect(dayFocus({ verdict: over, proteinG: 30, proteinTarget: 141 })).toBeNull()
    const low = dayVerdict({ consumedCalories: 360, targetCalories: T, hour: 21 })
    expect(dayFocus({ verdict: low, proteinG: 30, proteinTarget: 141 })).toBeNull()
    expect(dayFocus({ verdict: open, proteinG: 30, proteinTarget: 141, past: true })).toBeNull()
  })

  it('nunca receta comida ni rutina', () => {
    const f = dayFocus({ verdict: open, proteinG: 30, proteinTarget: 141 })
    expect(f?.body).not.toMatch(/come |comer |duerme|entrena/i)
  })
})

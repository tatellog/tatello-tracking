import { DAY_CLOSE_HOUR } from '../day-close'
import { tuDiaModel } from '../tu-dia'

const base = {
  consumedCalories: 1400,
  targetCalories: 1546,
  mealCount: 3,
  hour: 14,
  weeklyReadingReady: false,
}

describe('tuDiaModel', () => {
  it('sin comida registrada no hay tarjeta (un día sin registro no se juzga)', () => {
    expect(tuDiaModel({ ...base, mealCount: 0 })).toBeNull()
    expect(tuDiaModel({ ...base, mealCount: 0, hour: 21 })).toBeNull()
  })

  it('sin meta calórica no hay lectura que dar', () => {
    expect(tuDiaModel({ ...base, targetCalories: null })).toBeNull()
  })

  it('de día, en déficit: lectura SIN número', () => {
    const m = tuDiaModel(base)
    expect(m?.kind).toBe('day')
    if (m?.kind !== 'day') return
    expect(m.status).toBe('deficit')
    expect(m.title).not.toMatch(/\d/)
    expect(m.line).not.toMatch(/\d/)
  })

  it('de día, sobre la meta: la tarjeta no desaparece ni juzga', () => {
    const m = tuDiaModel({ ...base, consumedCalories: 1700 })
    expect(m?.kind).toBe('day')
    if (m?.kind !== 'day') return
    expect(m.status).toBe('over')
    expect(m.title).not.toMatch(/\d/)
    expect(`${m.title} ${m.line}`).not.toMatch(/pasaste|sobre tu objetivo/i)
  })

  it('desde las 20:00 con comida, el cierre toma la tarjeta con la cifra', () => {
    const m = tuDiaModel({
      ...base,
      hour: DAY_CLOSE_HOUR,
      closeReading: 'Los martes cenas ligero.',
    })
    expect(m?.kind).toBe('close')
    if (m?.kind !== 'close') return
    expect(m.verdict.kind).toBe('deficit')
    expect(m.title).toMatch(/1,?400/)
    expect(m.reading).toBe('Los martes cenas ligero.')
  })

  it('el cierre omite la micro-observación cuando el motor no tiene nada honesto que decir', () => {
    const m = tuDiaModel({ ...base, hour: 21 })
    expect(m?.kind).toBe('close')
    if (m?.kind !== 'close') return
    expect(m.reading).toBeNull()
  })

  it('la Lectura Semanal sin abrir gana sobre todo lo demás, incluso de noche', () => {
    const m = tuDiaModel({ ...base, hour: 21, weeklyReadingReady: true })
    expect(m?.kind).toBe('weekly')
    // Y aparece aunque no haya comida ese día: es de la semana cerrada.
    expect(tuDiaModel({ ...base, mealCount: 0, weeklyReadingReady: true })?.kind).toBe('weekly')
  })

  // ST-002 · día parcial: debajo del piso sano (60% de la meta) el día está a
  // medio registrar, no "en déficit". Misma regla que el cierre y el calendario.
  it('de día, debajo del piso sano: día abierto, nunca "Vas en déficit"', () => {
    const m = tuDiaModel({ ...base, consumedCalories: 150, mealCount: 1 })
    expect(m?.kind).toBe('day')
    if (m?.kind !== 'day') return
    expect(m.status).toBe('open')
    expect(`${m.title} ${m.line}`).not.toMatch(/déficit/i)
    expect(m.title).not.toMatch(/\d/)
  })

  it('de día, justo en el piso (60%) sí es déficit; un kcal debajo ya no', () => {
    const floor = Math.ceil(1546 * 0.6)
    const at = tuDiaModel({ ...base, consumedCalories: floor })
    const below = tuDiaModel({ ...base, consumedCalories: floor - 1 })
    expect(at?.kind === 'day' && at.status).toBe('deficit')
    expect(below?.kind === 'day' && below.status).toBe('open')
  })
})

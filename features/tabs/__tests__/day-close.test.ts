import { DAY_CLOSE_HOUR, dayCloseCopy, dayCloseVerdict } from '../day-close'

describe('dayCloseVerdict', () => {
  const base = { consumedCalories: 1400, targetCalories: 1546, mealCount: 3, hour: 21 }

  it('no existe antes de las 20:00 (el déficit no es semáforo intradía)', () => {
    expect(dayCloseVerdict({ ...base, hour: DAY_CLOSE_HOUR - 1 })).toBeNull()
    expect(dayCloseVerdict({ ...base, hour: DAY_CLOSE_HOUR })).not.toBeNull()
  })

  it('no existe sin comidas registradas (un día sin registro no se cierra ni se reprocha)', () => {
    expect(dayCloseVerdict({ ...base, mealCount: 0 })).toBeNull()
  })

  it('no existe sin meta calórica', () => {
    expect(dayCloseVerdict({ ...base, targetCalories: null })).toBeNull()
    expect(dayCloseVerdict({ ...base, targetCalories: 0 })).toBeNull()
  })

  it('déficit sano: consumo dentro de [60% × meta, meta] — misma definición que el calendario', () => {
    expect(dayCloseVerdict(base)?.kind).toBe('deficit')
    // Exactamente en la meta sigue siendo déficit.
    expect(dayCloseVerdict({ ...base, consumedCalories: 1546 })?.kind).toBe('deficit')
    // Exactamente en el piso del 60% también.
    expect(dayCloseVerdict({ ...base, consumedCalories: 1546 * 0.6 })?.kind).toBe('deficit')
  })

  it('sobre la meta es superávit (nunca "fallo")', () => {
    expect(dayCloseVerdict({ ...base, consumedCalories: 1700 })?.kind).toBe('surplus')
  })

  it('bajo el piso del 60% es "low" — cuidado, jamás celebrado como déficit', () => {
    expect(dayCloseVerdict({ ...base, consumedCalories: 800 })?.kind).toBe('low')
  })

  it('redondea el consumo para el copy', () => {
    expect(dayCloseVerdict({ ...base, consumedCalories: 1400.6 })?.consumed).toBe(1401)
  })
})

describe('dayCloseCopy', () => {
  it('déficit: números literales + cierre dorado', () => {
    const copy = dayCloseCopy({ kind: 'deficit', consumed: 1400, target: 1546 })
    expect(copy.data).toContain('1,400')
    expect(copy.data).toContain('1,546')
    expect(copy.coach).toContain('dorado')
  })

  it('superávit: sin culpa (nunca "te pasaste")', () => {
    const copy = dayCloseCopy({ kind: 'surplus', consumed: 1800, target: 1546 })
    expect(copy.coach).not.toMatch(/pasaste|exceso|mal/i)
    expect(copy.coach).toContain('Mañana')
  })

  it('low: cuidado anclado al registro (no a la ingesta), con salida práctica', () => {
    const copy = dayCloseCopy({ kind: 'low', consumed: 700, target: 1546 })
    expect(copy.coach).not.toMatch(/dorado|logr/i)
    // Observa el REGISTRO corto, nunca "comiste poco" (línea roja).
    expect(copy.coach).not.toMatch(/comiste|comida/i)
    expect(copy.coach).toContain('agregarlo')
  })
})

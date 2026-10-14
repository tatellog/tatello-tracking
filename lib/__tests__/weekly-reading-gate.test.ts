import { weeklyReadingEnabledFor } from '../featureFlags'

/* ST-010 · la Lectura Semanal abierta a la beta (dueña 14 oct 2026). */
describe('weeklyReadingEnabledFor', () => {
  it('la ve una usuaria beta', () => {
    expect(weeklyReadingEnabledFor('alguien@correo.com', true)).toBe(true)
  })

  it('la ven las cuentas dev aunque no sean beta', () => {
    expect(weeklyReadingEnabledFor('dev@local.test', false)).toBe(true)
  })

  it('no la ve quien no es beta ni dev (o sin perfil todavía)', () => {
    expect(weeklyReadingEnabledFor('alguien@correo.com', false)).toBe(false)
    expect(weeklyReadingEnabledFor('alguien@correo.com', undefined)).toBe(false)
    expect(weeklyReadingEnabledFor(null, null)).toBe(false)
  })
})

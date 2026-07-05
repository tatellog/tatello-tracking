import { weekSeal } from '../week-orbit-logic'
import { mkSig } from './signals.fixture'

// Lunes 6 jul 2026; semana sellada = lun 29 jun → dom 5 jul.
const MONDAY = '2026-07-06'
const SATURDAY = '2026-07-04'

const sig = mkSig

const CTX = { calorieTarget: 1546, proteinTarget: 120 }

describe('weekSeal — la cita del lunes', () => {
  it('solo existe el lunes', () => {
    const prev = [sig('2026-07-01', { meal_count: 2 })]
    expect(weekSeal(prev, SATURDAY, CTX)).toBeNull()
    expect(weekSeal(prev, MONDAY, CTX)).not.toBeNull()
  })

  it('sin datos en la semana pasada no hay sello (nada que fingir)', () => {
    expect(weekSeal([], MONDAY, CTX)).toBeNull()
    // Datos solo de ESTA semana tampoco sellan la pasada.
    expect(weekSeal([sig(MONDAY, { meal_count: 2 })], MONDAY, CTX)).toBeNull()
  })

  it('observa la dimensión protagonista sin denominador "de 7" ni score', () => {
    const seal = weekSeal(
      [
        sig('2026-06-30', { meal_count: 2, calories: 1400 }),
        sig('2026-07-01', { meal_count: 2, calories: 1500 }),
        sig('2026-07-02', { meal_count: 1, calories: 1450, sleep_minutes: 420 }),
      ],
      MONDAY,
      CTX,
    )
    expect(seal?.prevSunday).toBe('2026-07-05')
    // Sujeto = tú ("Registraste comida..."), no la métrica.
    expect(seal?.observation).toContain('Registraste comida')
    expect(seal?.observation).toContain('3 días')
    // Sin examen retroactivo ni veredicto de logro.
    expect(seal?.observation).not.toMatch(/de 7|lograste|fallaste/i)
  })

  it('nombra el día más encendido cuando hay más de un día', () => {
    const seal = weekSeal(
      [
        sig('2026-06-30', { meal_count: 1 }),
        sig('2026-07-02', { meal_count: 2, sleep_minutes: 400, water_glasses: 5 }),
      ],
      MONDAY,
      CTX,
    )
    expect(seal?.observation).toContain('jueves')
  })
})

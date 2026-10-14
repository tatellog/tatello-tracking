import {
  HOY_DISCOVERY_MAX_DAYS,
  hoyDiscoveryModel,
  hoyDiscoveryVisible,
  markHoyDiscoveryOpened,
  markHoyDiscoveryShown,
} from '../hoy-discovery'
import { featuredOf } from '../featured-discovery'
import { stepsDeficit } from '../surprise'
import { addDays, mkSig } from './signals.fixture'

/*
 * ST-007 · el hallazgo en Hoy solo mientras es nuevo (dueña 13 oct 2026): se
 * va al abrirlo o tras mostrarse en 3 días distintos.
 */
describe('hoyDiscoveryVisible', () => {
  it('un hallazgo nunca mostrado se ve', () => {
    expect(hoyDiscoveryVisible({}, 'steps-deficit', '2026-10-13')).toBe(true)
  })

  it('se ve 3 días distintos y al 4o ya no', () => {
    let s = {}
    for (const d of ['2026-10-13', '2026-10-14', '2026-10-15']) {
      expect(hoyDiscoveryVisible(s, 'x', d)).toBe(true)
      s = markHoyDiscoveryShown(s, 'x', d)
    }
    expect(HOY_DISCOVERY_MAX_DAYS).toBe(3)
    expect(hoyDiscoveryVisible(s, 'x', '2026-10-16')).toBe(false)
    // El tercer día sigue siendo suyo hasta que acabe.
    expect(hoyDiscoveryVisible(s, 'x', '2026-10-15')).toBe(true)
  })

  it('abrirlo (en Hoy o en Descubre) lo quita de Hoy', () => {
    const s = markHoyDiscoveryOpened(markHoyDiscoveryShown({}, 'x', '2026-10-13'), 'x')
    expect(hoyDiscoveryVisible(s, 'x', '2026-10-13')).toBe(false)
  })

  it('un hallazgo NUEVO (otro id) vuelve a asomar', () => {
    const s = markHoyDiscoveryOpened({}, 'x')
    expect(hoyDiscoveryVisible(s, 'y', '2026-10-13')).toBe(true)
  })

  it('marcar dos veces el mismo día no suma días', () => {
    const s1 = markHoyDiscoveryShown({}, 'x', '2026-10-13')
    expect(markHoyDiscoveryShown(s1, 'x', '2026-10-13')).toBe(s1)
  })
})

describe('hoyDiscoveryModel', () => {
  it('Hoy solo avisa: etiqueta + título corto, sin números', () => {
    const signals = Array.from({ length: 12 }, (_, i) =>
      mkSig(addDays('2026-06-01', i), {
        meal_count: 2,
        steps: i % 2 === 0 ? 9000 : 2000,
        calories: i % 2 === 0 ? 1400 : 2400,
      }),
    )
    const s = stepsDeficit(signals, { calorieTarget: 1800 })!
    const m = hoyDiscoveryModel(featuredOf(s, null, [])!, 3, signals, { calorieTarget: 1800 })
    expect(m).toEqual({
      label: 'patron',
      eyebrow: 'Nuevo patrón',
      title: 'Más pasos, más días en déficit',
      lookId: 'steps-deficit',
    })
  })

  it('con poca muestra la etiqueta baja a observación', () => {
    const signals = Array.from({ length: 12 }, (_, i) =>
      mkSig(addDays('2026-06-01', i), {
        meal_count: 2,
        steps: i % 2 === 0 ? 9000 : 2000,
        calories: i % 2 === 0 ? 1400 : 2400,
      }),
    )
    const s = stepsDeficit(signals, { calorieTarget: 1800 })!
    const m = hoyDiscoveryModel(featuredOf(s, null, [])!, 2, signals, { calorieTarget: 1800 })
    expect(m.eyebrow).toBe('Nueva observación')
  })
})

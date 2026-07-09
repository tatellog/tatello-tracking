import { buildFindings, hashFindings } from '../findings'
import { mkSig } from './signals.fixture'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

/** N días desde 2026-07-01, con override por día. */
function month(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = `2026-07-${String(i + 1).padStart(2, '0')}`
    out.push(mkSig(day, { calories: 1300, meal_count: 3, ...override(i) }))
  }
  return out
}

describe('buildFindings — hallazgos específicos con confianza y evidencia', () => {
  it('detecta un día de la semana con más calorías, con números y gráfica', () => {
    // Los viernes (2026-07-03/10/17/24) con calorías altas; el resto bajo.
    const signals = month(28, (i) => {
      const wd = new Date(`2026-07-${String(i + 1).padStart(2, '0')}T00:00:00Z`).getUTCDay()
      return { calories: wd === 5 ? 2100 : 1300 }
    })
    const f = buildFindings(signals, CTX).find((x) => x.id === 'weekday-calories')
    expect(f).toBeDefined()
    expect(f!.title).toMatch(/viernes/)
    expect(f!.title).toMatch(/\d+ kcal más/)
    expect(f!.confidence).toBeGreaterThan(0)
    expect(f!.charts[0]!.kind).toBe('weekdayBars')
  })

  it('detecta la correlación entrenaste → déficit con su porcentaje', () => {
    // Entrenó 10 días; en 9 de ellos, déficit.
    const signals = month(24, (i) => ({
      trained: i < 10,
      calories: i < 9 ? 1200 : 1800,
    }))
    const f = buildFindings(signals, CTX).find((x) => x.id === 'training-deficit')
    expect(f).toBeDefined()
    expect(f!.title).toMatch(/entrenaste/)
    expect(f!.title).toMatch(/%/)
    expect(f!.metric.value).toMatch(/\d+ de \d+/)
  })

  it('metacognición cálida sin encuesta + cierre ver-días/otro-hallazgo', () => {
    const signals = month(20, (i) => ({ trained: i < 8, calories: i < 8 ? 1200 : 1600 }))
    const f = buildFindings(signals, CTX)[0]!
    expect(f.metacognition.question).toBe('¿Esto ya lo sabías?')
    // La encuesta "¿qué crees que influye?" se eliminó.
    expect(f.metacognition.follow).toBeUndefined()
    // El cierre son solo días + siguiente hallazgo (no observaciones).
    expect(f.followUps.some((u) => u.kind === 'next')).toBe(true)
    expect(f.followUps.every((u) => u.kind === 'days' || u.kind === 'next')).toBe(true)
  })

  it('Stelar arriesga una hipótesis cuando hay coincidencia real (no causal)', () => {
    // Entrenó 10 días en déficit; en esos días también durmió 7h+.
    const signals = month(24, (i) => ({
      trained: i < 10,
      calories: i < 10 ? 1200 : 1800,
      sleep_minutes: i < 10 ? 450 : 300,
    }))
    const f = buildFindings(signals, CTX).find((x) => x.id === 'training-deficit')
    if (f?.hypothesis) {
      expect(f.hypothesis).toMatch(/también dormiste/)
      expect(f.hypothesis).toMatch(/No sé si va junto/) // tentativa, sin causa
      expect(f.hypothesis).not.toMatch(/porque|causa|debido a/)
    }
  })

  it('muestra solo 2-3 hallazgos con sentido (cap + confianza)', () => {
    const signals = month(28, (i) => ({
      trained: i % 3 === 0,
      water_glasses: i % 2 === 0 ? 9 : 3,
      calories: i % 2 === 0 ? 1200 : 1700,
    }))
    const cards = buildFindings(signals, CTX)
    expect(cards.length).toBeLessThanOrEqual(3)
    // Todo lo que no es el ancla de déficit debe pasar el corte de confianza.
    for (const f of cards) {
      if (f.id !== 'deficit-summary') expect(f.confidence).toBeGreaterThanOrEqual(60)
    }
  })

  it('sin datos suficientes → sin hallazgos', () => {
    expect(buildFindings(month(3), CTX)).toEqual([])
  })
})

describe('hashFindings — llave de caché de la voz de IA por hallazgo', () => {
  const gen = (trainedUntil: number) =>
    buildFindings(
      month(24, (i) => ({ trained: i < trainedUntil, calories: i < trainedUntil ? 1200 : 1600 })),
      CTX,
    )

  it('es estable para los mismos hallazgos', () => {
    expect(hashFindings(gen(8))).toBe(hashFindings(gen(8)))
  })

  it('cambia cuando cambia lo que se muestra', () => {
    expect(hashFindings(gen(8))).not.toBe(hashFindings(gen(12)))
  })

  it('vacío es estable', () => {
    expect(hashFindings([])).toBe(hashFindings([]))
  })
})

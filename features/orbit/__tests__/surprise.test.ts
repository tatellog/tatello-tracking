import {
  proteinTrainingGap,
  rankSurprises,
  rescueAfterOver,
  shortNightEffect,
  stepsDeficit,
  surpriseScore,
  weekdayBreak,
} from '../surprise'
import { addDays, mkSig } from './signals.fixture'

const TARGET = 1800
const OPTS = { calorieTarget: TARGET }
// 2026-06-01 es lunes.
const BASE = '2026-06-01'
const days = (n: number, o: (i: number) => Parameters<typeof mkSig>[1]) =>
  Array.from({ length: n }, (_, i) => mkSig(addDays(BASE, i), o(i)))

describe('shortNightEffect', () => {
  it('noche corta → más calorías ese día (efecto con retraso)', () => {
    const s = shortNightEffect(
      days(12, (i) =>
        i % 3 === 0
          ? { sleep_minutes: 320, calories: 2100 }
          : { sleep_minutes: 450, calories: 1600 },
      ),
    )!
    expect(s.headline).toBe(
      'Después de dormir menos de 6 horas, tu cuerpo pide unas 500 kcal más ese día.',
    )
    expect(s.delayed).toBe(true)
    expect(s.rows[0]).toMatchObject({ value: '2,100 kcal', strong: true })
  })

  it('no hay hallazgo si la diferencia es chica, o con menos de 3 noches cortas', () => {
    expect(
      shortNightEffect(days(12, (i) => ({ sleep_minutes: i % 3 ? 450 : 320, calories: 1650 }))),
    ).toBeNull()
    expect(
      shortNightEffect(
        days(12, (i) => ({ sleep_minutes: i < 2 ? 320 : 450, calories: i < 2 ? 2400 : 1600 })),
      ),
    ).toBeNull()
  })

  it('ignora días parciales (un yogurt suelto no es un promedio)', () => {
    const s = shortNightEffect(
      days(12, (i) =>
        i % 3 === 0
          ? { sleep_minutes: 320, calories: 300 }
          : { sleep_minutes: 450, calories: 1600 },
      ),
    )
    expect(s).toBeNull()
  })
})

describe('proteinTrainingGap', () => {
  it('comer MENOS proteína los días que entrena es sorpresa, no lo esperado', () => {
    const s = proteinTrainingGap(
      days(12, (i) => ({
        calories: 1600,
        trained: i % 2 === 0,
        protein_g: i % 2 === 0 ? 80 : 120,
      })),
    )!
    expect(s.headline).toContain('40 g menos')
    expect(s.expected).toBe(false)
    expect(s.contradicts).toBe(true)
  })
  it('comer más proteína al entrenar es lo esperado', () => {
    const s = proteinTrainingGap(
      days(12, (i) => ({
        calories: 1600,
        trained: i % 2 === 0,
        protein_g: i % 2 === 0 ? 130 : 100,
      })),
    )!
    expect(s.expected).toBe(true)
  })
})

describe('stepsDeficit', () => {
  it('compara la mitad con más pasos contra la otra mitad', () => {
    const s = stepsDeficit(
      days(12, (i) => ({
        steps: i < 6 ? 3000 : 10000,
        calories: i < 6 ? 2200 : 1500,
      })),
      OPTS,
    )!
    expect(s.rows[0]!.value).toBe('6 de 6')
    expect(s.rows[1]!.value).toBe('0 de 6')
    expect(s.expected).toBe(true)
  })
  it('sin pasos, sin hallazgo', () => {
    expect(
      stepsDeficit(
        days(12, () => ({ calories: 1500 })),
        OPTS,
      ),
    ).toBeNull()
  })
})

describe('weekdayBreak', () => {
  it('"no es el fin de semana": el jueves que se rompe contradice la creencia', () => {
    // 4 semanas: los jueves (índice 3) sobre la meta, el resto en déficit.
    const s = weekdayBreak(
      days(28, (i) => ({ calories: i % 7 === 3 ? 2400 : 1500 })),
      OPTS,
    )!
    expect(s.headline).toBe('No es el fin de semana: el día que más se te complica es el jueves.')
    expect(s.contradicts).toBe(true)
    expect(s.rows[0]).toMatchObject({ label: 'Los jueves', value: '0 de 4' })
  })
  it('si es el sábado, es lo esperado', () => {
    const s = weekdayBreak(
      days(28, (i) => ({ calories: i % 7 === 5 ? 2400 : 1500 })),
      OPTS,
    )!
    expect(s.expected).toBe(true)
  })
})

describe('rescueAfterOver', () => {
  it('después de un día sobre la meta vuelve al déficit más que de costumbre', () => {
    // Ciclo de 4 (sobre, déficit, sobre, sobre): el día después de "sobre" no
    // vuelve al déficit más que de costumbre → sin hallazgo.
    const s = rescueAfterOver(
      days(20, (i) => ({ calories: i % 4 === 0 ? 2400 : i % 4 === 1 ? 1500 : 2300 })),
      OPTS,
    )
    expect(s).toBeNull()
    // Alternando sobre / déficit: el día después SIEMPRE vuelve.
    const r = rescueAfterOver(
      days(20, (i) => ({ calories: i % 2 === 0 ? 2400 : 1500 })),
      OPTS,
    )!
    expect(r.rows[0]!.value).toBe('10 de 10')
    expect(r.delayed).toBe(true)
  })
})

describe('rankSurprises', () => {
  it('elige lo sorprendente sobre lo esperado aunque lo esperado sea más grande', () => {
    // Pasos: efecto enorme pero esperado. Noche corta: efecto medio, con retraso.
    const signals = days(24, (i) => ({
      steps: i % 2 === 0 ? 3000 : 11000,
      sleep_minutes: i % 4 === 0 ? 320 : 450,
      calories: i % 4 === 0 ? 2050 : i % 2 === 0 ? 1700 : 1500,
    }))
    const r = rankSurprises(signals, OPTS)
    expect(r.hero?.id).toBe('short-night')
  })

  it('lo ya mostrado como protagonista pierde puntos', () => {
    const s = shortNightEffect(
      days(12, (i) =>
        i % 3 === 0
          ? { sleep_minutes: 320, calories: 2100 }
          : { sleep_minutes: 450, calories: 1600 },
      ),
    )!
    expect(surpriseScore(s, ['short-night'])).toBeCloseTo(surpriseScore(s) / 2)
  })

  it('sin nada sobre el umbral no hay protagonista (nunca se fuerza)', () => {
    expect(
      rankSurprises(
        days(20, () => ({ calories: 1500, sleep_minutes: 450 })),
        OPTS,
      ).hero,
    ).toBeNull()
  })
})

import {
  buildWeekDimensions,
  dimObservation,
  mainDiscovery,
  quietestSignal,
  steadyThings,
  weekAbsences,
  weekEvidence,
  weeklyRhythms,
  weekObservations,
} from '../week-orbit-logic'
import { mkSig } from './signals.fixture'

// Semana de referencia: lunes 2026-06-15 … domingo 2026-06-21.
const MON = '2026-06-15'
const TUE = '2026-06-16'
const WED = '2026-06-17'
const THU = '2026-06-18'
const FRI = '2026-06-19'
const SAT = '2026-06-20'
const SUN = '2026-06-21'
const CTX = { proteinTarget: 130 }

describe('mainDiscovery (descubrimiento principal)', () => {
  it('Constancia cuando la presencia amplia domina', () => {
    const signals = [MON, TUE, WED, THU, FRI, SAT].map((d) => mkSig(d, { meal_count: 2 }))
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.archetype).toBe('constancia')
    expect(d.symbol).toBe('ancla')
    expect(d.headline).toBe('Estuviste presente 6 de 7 días.')
    expect(d.sub).toMatch(/consistente/i)
  })

  it('una dimensión que destaca es el descubrimiento', () => {
    // Solo entrenamiento, lun-mar-mié; hoy viernes (5 días). Movimiento 3/5.
    const signals = [MON, TUE, WED].map((d) => mkSig(d, { trained: true }))
    const d = mainDiscovery(signals, FRI, CTX)
    expect(d.archetype).toBe('movimiento')
    expect(d.symbol).toBe('movimiento')
    expect(d.headline).toBe('Tu cuerpo se movió 3 de 5 días.')
  })

  it('Comienzo cálido con poca evidencia (sin puntaje bajo)', () => {
    const signals = [MON, TUE].map((d) => mkSig(d, { meal_count: 1 }))
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.archetype).toBe('comienzo')
    expect(d.headline).toBe('Apareciste 2 días esta semana.')
  })
})

describe('weekEvidence (¿por qué? · transparente)', () => {
  it('cuenta los días reales de cada señal, solo > 0', () => {
    const signals = [
      mkSig(MON, {
        trained: true,
        meal_count: 2,
        protein_g: 140,
        water_glasses: 5,
        sleep_minutes: 430,
        energy: 4,
        mood: 'good',
        on_period: true,
      }),
      mkSig(TUE, { trained: true, meal_count: 2 }),
    ]
    const ev = weekEvidence(signals, SUN, CTX)
    const text = (k: string) => ev.find((e) => e.key === k)?.text
    expect(text('comida')).toBe('Registraste comida 2 días')
    expect(text('movimiento')).toBe('Entrenaste 2 días')
    expect(text('proteina')).toBe('Alcanzaste tu proteína 1 día')
    expect(text('sueno')).toBe('Dormiste más de 7 h en 1 día')
    expect(text('emociones')).toBe('Anotaste cómo te sentiste 1 día')
    // El ciclo NO es evidencia de hábito (es contexto de Mes), aunque on_period
    // sea true ese día.
    expect(text('ciclo')).toBeUndefined()
  })

  it('sin registros, sin evidencia', () => {
    expect(weekEvidence([], SUN, CTX)).toEqual([])
  })
})

describe('quietestSignal (lo más silencioso)', () => {
  it('la señal menos presente, pero presente', () => {
    const signals = [
      mkSig(MON, { meal_count: 2, water_glasses: 5 }),
      mkSig(TUE, { meal_count: 2 }),
      mkSig(WED, { meal_count: 2 }),
    ]
    const dims = buildWeekDimensions(signals, SUN, CTX)
    const q = quietestSignal(dims)
    expect(q?.key).toBe('agua')
    expect(q?.present).toBe(1)
  })

  it('null si solo una dimensión apareció (sin comparación)', () => {
    const dims = buildWeekDimensions([mkSig(MON, { meal_count: 2 })], SUN, CTX)
    expect(quietestSignal(dims)).toBeNull()
  })
})

describe('weeklyRhythms (distribución por día de la semana)', () => {
  it('entreno al inicio y sueño en fin de semana', () => {
    const signals = [
      mkSig(MON, { trained: true, sleep_minutes: 400 }),
      mkSig(TUE, { trained: true }),
      mkSig(WED, { trained: true }),
      mkSig(SAT, { sleep_minutes: 480 }),
    ]
    const r = weeklyRhythms(signals, SUN)
    expect(r).toContain('Entrenaste más al inicio de la semana.')
    expect(r).toContain('Dormiste más en fin de semana.')
  })

  it('señala el día más callado (el que se rompe) cuando hay contraste', () => {
    // Semana activa salvo el viernes (sin registro) → viernes es el único más bajo.
    const signals = [
      mkSig(MON, { trained: true, meal_count: 2, sleep_minutes: 420, water_glasses: 5 }),
      mkSig(TUE, { meal_count: 2 }),
      mkSig(WED, { meal_count: 2 }),
      mkSig(THU, { meal_count: 2 }),
      // viernes: sin fila
      mkSig(SAT, { meal_count: 2 }),
      mkSig(SUN, { meal_count: 2 }),
    ]
    expect(weeklyRhythms(signals, SUN)).toContain('El viernes fue tu día más callado.')
  })

  it('no señala día callado en una semana pareja (sin contraste)', () => {
    const even = [MON, TUE, WED, THU, FRI, SAT, SUN].map((d) => mkSig(d, { meal_count: 2 }))
    expect(weeklyRhythms(even, SUN).some((l) => /más callado/.test(l))).toBe(false)
  })

  it('vacío demasiado temprano en la semana (<5 días)', () => {
    expect(weeklyRhythms([mkSig(MON, { meal_count: 2 })], TUE)).toEqual([])
  })
})

describe('weekObservations (ritmos + constante, sin sueño duplicado)', () => {
  it('una sola línea de sueño cuando hay banda y distribución a la vez', () => {
    // Banda de sueño (3 noches 7-8h) + fin de semana más alto → ambas funciones
    // emitirían sueño; weekObservations deja solo la banda (más concreta).
    const signals = [
      mkSig(MON, { sleep_minutes: 430 }),
      mkSig(TUE, { sleep_minutes: 440 }),
      mkSig(WED, { sleep_minutes: 450 }),
      mkSig(SAT, { sleep_minutes: 500 }),
    ]
    const obs = weekObservations(signals, SUN)
    const sleepLines = obs.filter((l) => /[Dd]ormiste/.test(l))
    expect(sleepLines.length).toBe(1)
    expect(sleepLines[0]).toMatch(/horas/)
  })
})

describe('steadyThings (lo constante)', () => {
  it('banda de sueño y energía estable', () => {
    const signals = [
      mkSig(MON, { sleep_minutes: 430, energy: 3 }),
      mkSig(TUE, { sleep_minutes: 450, energy: 4 }),
      mkSig(WED, { sleep_minutes: 470, energy: 3 }),
    ]
    const s = steadyThings(signals, SUN)
    expect(s).toContain('Dormiste entre 7 y 8 horas durante 3 días.')
    expect(s).toContain('Tu energía se mantuvo estable.')
  })

  it('sin datos suficientes no afirma nada', () => {
    expect(steadyThings([mkSig(MON, { sleep_minutes: 430 })], SUN)).toEqual([])
  })
})

describe('weekAbsences (la ausencia también cuenta)', () => {
  it('lista lo que nunca apareció (tope 2), sin culpa', () => {
    const signals = [MON, TUE, THU].map((d) => mkSig(d, { meal_count: 2 }))
    const a = weekAbsences(signals, SUN)
    expect(a.length).toBeLessThanOrEqual(2)
    expect(a.some((l) => /agua/i.test(l))).toBe(true)
    expect(a.every((l) => !/deberías|debes/i.test(l))).toBe(true)
  })

  it('semana vacía → sin ausencias (lo cubre el estado vacío)', () => {
    expect(weekAbsences([], SUN)).toEqual([])
  })
})

describe('dimObservation', () => {
  it('escala la frase con el ratio, sin prescribir', () => {
    expect(dimObservation(7, 7)).toMatch(/casi toda/i)
    expect(dimObservation(4, 7)).toMatch(/mayor parte/i)
    expect(dimObservation(1, 7)).toMatch(/algunos días/i)
    expect(dimObservation(0, 7)).toMatch(/aún no/i)
  })
})

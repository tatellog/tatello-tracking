import {
  buildWeekDimensions,
  dimObservation,
  mainDiscovery,
  quietestSignal,
  signalLine,
  steadyThings,
  strongestCoOccurrence,
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

describe('mainDiscovery (descubrimiento principal · v2 híbrido)', () => {
  it('co-ocurrencia gana: movimiento junto a proteína', () => {
    // Entreno + proteína el MISMO día en 4 días; hoy domingo (7 días).
    const signals = [MON, TUE, THU, FRI].map((d) =>
      mkSig(d, { trained: true, protein_g: 140, meal_count: 2 }),
    )
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('cooccurrence')
    expect(d.archetype).toBe('movimiento')
    expect(d.symbol).toBe('movimiento')
    expect(d.title).toBe('Movimiento y proteína')
    expect(d.phrase).toBe('Tu movimiento apareció junto a tu proteína 4 veces esta semana.')
    expect(d.emphasis).toBe('4 veces')
    expect(d.headline).toBe('Coincidieron 4 de 7 días.')
    // Dos timelines: una por señal del par, ambas de 7 celdas.
    expect(d.timelines).toHaveLength(2)
    expect(d.timelines.map((t) => t.key)).toEqual(['movimiento', 'proteina'])
    expect(d.timelines[0]!.cells).toHaveLength(7)
  })

  it('co-ocurrencia con déficit requiere meta calórica (déficit × sueño +7 h)', () => {
    // 1700 kcal con meta 2000 = déficit sano (≥0.6×); sueño 430 min = +7 h.
    const ctx = { proteinTarget: 130, calorieTarget: 2000 }
    const signals = [MON, TUE, WED].map((d) =>
      mkSig(d, { calories: 1700, sleep_minutes: 430, meal_count: 2 }),
    )
    const d = mainDiscovery(signals, SUN, ctx)
    expect(d.kind).toBe('cooccurrence')
    expect(d.archetype).toBe('descanso')
    expect(d.symbol).toBe('sueno')
    expect(d.phrase).toBe('Tu déficit apareció junto a noches de más de 7 h 3 veces esta semana.')

    // Sin meta calórica, el déficit no existe → degrada (no co-ocurrencia).
    const noTarget = mainDiscovery(signals, SUN, { proteinTarget: 130 })
    expect(noTarget.kind).not.toBe('cooccurrence')
  })

  it('presencia cuando hay constancia pero ninguna co-ocurrencia fuerte', () => {
    // Solo comida (una sola señal → no hay par posible). 6/7 días presente.
    const signals = [MON, TUE, WED, THU, FRI, SAT].map((d) => mkSig(d, { meal_count: 2 }))
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('presence')
    expect(d.archetype).toBe('constancia')
    expect(d.symbol).toBe('ancla')
    expect(d.headline).toBe('Apareciste 6 de 7 días.')
    expect(d.timelines).toHaveLength(1)
    expect(d.timelines[0]!.key).toBe('presencia')
  })

  it('comienzo cálido con poca evidencia (sin puntaje bajo)', () => {
    const signals = [MON, TUE].map((d) => mkSig(d, { meal_count: 1 }))
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('comienzo')
    expect(d.archetype).toBe('comienzo')
    expect(d.headline).toBe('Apareciste 2 días esta semana.')
    expect(d.snapshot).toBeNull() // 2 días: sin foto del día
  })

  it('un solo día rico: hero lo reconoce + evidencia es la foto del día', () => {
    // Un único día (lunes) con muchas señales → comienzo, pero sin minimizar.
    const signals = [
      mkSig(MON, {
        meal_count: 3,
        trained: true,
        protein_g: 140,
        sleep_minutes: 430,
        water_glasses: 5,
        energy: 4,
      }),
    ]
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('comienzo')
    expect(d.phrase).toBe('Tu primer día ya dejó huella.')
    expect(d.emphasis).toBe('dejó huella')
    expect(d.snapshot).not.toBeNull()
    expect(d.snapshot!.weekdayLabel).toBe('el lunes')
    // Orden fijo: comida, entreno, proteína, sueño +7 h, agua, energía.
    expect(d.snapshot!.items).toEqual([
      'comida',
      'entreno',
      'proteína',
      'sueño +7 h',
      'agua',
      'energía',
    ])
  })

  it('un solo día pobre (1 señal): foto del día pero hero NO lo sobrevende', () => {
    const signals = [mkSig(MON, { meal_count: 1 })]
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('comienzo')
    expect(d.phrase).toBe('Tu semana apenas toma forma.')
    expect(d.snapshot).not.toBeNull()
    expect(d.snapshot!.items).toEqual(['comida'])
  })

  it('co-ocurrencia por debajo del mínimo (2 días) no gana: degrada a presencia', () => {
    // Entreno+proteína solo 2 días (< MIN 3) pero comida 5 días → presencia.
    const signals = [
      mkSig(MON, { trained: true, protein_g: 140, meal_count: 2 }),
      mkSig(TUE, { trained: true, protein_g: 140, meal_count: 2 }),
      mkSig(WED, { meal_count: 2 }),
      mkSig(THU, { meal_count: 2 }),
      mkSig(FRI, { meal_count: 2 }),
    ]
    const d = mainDiscovery(signals, SUN, CTX)
    expect(d.kind).toBe('presence')
  })
})

describe('strongestCoOccurrence (motor de co-ocurrencia)', () => {
  it('elige el par con más días coincidentes', () => {
    // movimiento×proteína: 4 días. déficit pares: 0 (sin meta calórica).
    const signals = [MON, TUE, THU, FRI].map((d) =>
      mkSig(d, { trained: true, protein_g: 140, meal_count: 2 }),
    )
    const co = strongestCoOccurrence(signals, SUN, CTX)
    expect(co).not.toBeNull()
    expect(co!.pair.a).toBe('movimiento')
    expect(co!.pair.b).toBe('proteina')
    expect(co!.both).toBe(4)
  })

  it('null cuando ninguna co-ocurrencia llega al mínimo', () => {
    const signals = [
      mkSig(MON, { trained: true, protein_g: 140, meal_count: 2 }),
      mkSig(TUE, { trained: true, protein_g: 140, meal_count: 2 }),
    ]
    expect(strongestCoOccurrence(signals, SUN, CTX)).toBeNull()
  })
})

describe('signalLine (línea de cualquier señal de evidencia)', () => {
  it('marca presente solo los días del predicado (déficit con meta)', () => {
    const ctx = { proteinTarget: 130, calorieTarget: 2000 }
    const signals = [
      mkSig(MON, { calories: 1700 }), // déficit sano
      mkSig(TUE, { calories: 2400 }), // superávit → ausente
      mkSig(WED, { calories: 900 }), // por debajo del piso 0.6× → ausente
    ]
    const cells = signalLine(signals, SUN, 'deficit', ctx)
    expect(cells).toHaveLength(7)
    expect(cells[0]!.state).toBe('present') // lunes
    expect(cells[1]!.state).toBe('absent') // martes
    expect(cells[2]!.state).toBe('absent') // miércoles (bajo el piso)
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

describe('weekAbsences (un patrón por descubrir · invitación con premio)', () => {
  it('invita a registrar lo que falta (tope 2), sin culpa ni "no registraste"', () => {
    const signals = [MON, TUE, THU].map((d) => mkSig(d, { meal_count: 2 }))
    const a = weekAbsences(signals, SUN)
    expect(a.length).toBeLessThanOrEqual(2)
    expect(a.some((l) => /hidrataci|agua/i.test(l))).toBe(true)
    // Invitación con premio, no reproche: nada de culpa ("no registraste"), nada
    // de imperativo-orden (anota/registra/marca) ni de promesa (podrás) ni causa
    // (te da chispa). Cada línea abre con una PREGUNTA y ofrece una posibilidad
    // en condicional (podrías / podría / empezarías).
    expect(
      a.every((l) => !/deberías|debes|no registraste|no encontramos|podrás|chispa/i.test(l)),
    ).toBe(true)
    expect(a.every((l) => l.includes('?'))).toBe(true)
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

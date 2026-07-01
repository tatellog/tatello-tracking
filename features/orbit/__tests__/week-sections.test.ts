import {
  confirmedFacts,
  dayTimeline,
  emergingEvidence,
  needsMoreEvidence,
  weekInvitations,
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

const CTX = { proteinTarget: 130, calorieTarget: 2000 }

/** Semana rica para ejercitar todas las secciones (déficit, entreno+proteína,
 *  un pico de calorías el sábado, agua/sueño/energía solo el lunes). */
function richWeek() {
  return [
    mkSig(MON, {
      calories: 1700,
      trained: true,
      protein_g: 140,
      meal_count: 2,
      water_glasses: 5,
      sleep_minutes: 430,
      energy: 4,
    }),
    mkSig(TUE, { calories: 1700, trained: true, protein_g: 140, meal_count: 2 }),
    mkSig(WED, { calories: 1900, meal_count: 2 }),
    mkSig(THU, { calories: 1700, trained: true, protein_g: 140, meal_count: 2 }),
    mkSig(FRI, { calories: 1800, meal_count: 2 }),
    mkSig(SAT, { calories: 2400, meal_count: 3 }),
  ]
}

describe('emergingEvidence (§3 · observaciones con número)', () => {
  it('déficit, proteína en entreno, día de más calorías y señal más callada', () => {
    const out = emergingEvidence(richWeek(), SUN, CTX)
    const texts = out.map((o) => o.text)
    expect(texts).toContain('Tu déficit apareció en 5 de 6 días con comida.')
    expect(texts).toContain('Tu proteína apareció en tus días de entreno 3 de 3 veces.')
    expect(texts).toContain('El sábado fue tu día de más calorías.')
    expect(texts).toContain('Agua apareció solo 1 día.')
    expect(out.length).toBeLessThanOrEqual(4)
  })

  it('sin meta calórica, déficit y día de más calorías no aparecen', () => {
    const out = emergingEvidence(richWeek(), SUN, { proteinTarget: 130 })
    const keys = out.map((o) => o.key)
    expect(keys).not.toContain('deficit')
    expect(keys).not.toContain('hi-cal')
  })
})

describe('confirmedFacts (§4 · hechos puros)', () => {
  it('cuenta entrenos, proteína, registro y días en déficit', () => {
    const texts = confirmedFacts(richWeek(), SUN, CTX).map((o) => o.text)
    expect(texts).toContain('Entrenaste 3 veces.')
    expect(texts).toContain('Alcanzaste tu proteína 3 veces.')
    expect(texts).toContain('Registraste 6 de 7 días.')
    expect(texts).toContain('5 días terminaron en déficit.')
  })

  it('"Registraste cada día" cuando apareciste los días transcurridos', () => {
    const week = [MON, TUE, WED].map((d) => mkSig(d, { meal_count: 1 }))
    const texts = confirmedFacts(week, WED, { proteinTarget: 130 }).map((o) => o.text)
    expect(texts).toContain('Registraste cada día.')
  })
})

describe('needsMoreEvidence (§5 · honestidad)', () => {
  it('señala un par prometedor pero sub-muestreado (agua × déficit)', () => {
    const msg = needsMoreEvidence(richWeek(), SUN, CTX)
    expect(msg).toBe(
      'Todavía no tenemos suficientes datos para saber si tu agua y tu déficit aparecen juntos. Sigue registrando.',
    )
  })

  it('sin meta calórica omite los pares con déficit (cae a sueño × energía)', () => {
    const msg = needsMoreEvidence(richWeek(), SUN, { proteinTarget: 130 })
    expect(msg).toBe(
      'Todavía no tenemos suficientes datos para saber si tu sueño y tu energía aparecen juntos. Sigue registrando.',
    )
  })

  it('semana vacía → null (lo cubre el estado vacío)', () => {
    expect(needsMoreEvidence([], SUN, CTX)).toBeNull()
  })
})

describe('dayTimeline (§6 · etiquetas por día)', () => {
  it('etiqueta cada día con su evidencia; "Sin registros" para días en silencio', () => {
    const rows = dayTimeline(richWeek(), SUN, CTX)
    expect(rows).toHaveLength(7)
    const byLabel = Object.fromEntries(rows.map((r) => [r.weekdayLabel, r]))
    expect(byLabel['Lunes']!.tags).toEqual(['Déficit', 'Proteína', 'Entreno'])
    expect(byLabel['Miércoles']!.tags).toEqual(['Déficit'])
    expect(byLabel['Sábado']!.tags).toEqual(['Por encima de tu meta'])
    expect(byLabel['Domingo']!.state).toBe('absent')
    expect(byLabel['Domingo']!.tags).toEqual(['Sin registros'])
  })

  it('días futuros no llevan etiquetas', () => {
    const rows = dayTimeline([mkSig(MON, { meal_count: 1 })], MON, CTX)
    const future = rows.filter((r) => r.state === 'future')
    expect(future.length).toBe(6) // mar→dom aún no llegan
    expect(future.every((r) => r.tags.length === 0)).toBe(true)
  })
})

describe('weekInvitations (§8 · invitaciones a observar)', () => {
  it('co-ocurrencia + reparto de calorías de fin de semana', () => {
    const out = weekInvitations(richWeek(), SUN, CTX)
    expect(out).toContain('Movimiento y proteína aparecieron juntos la mayor parte de la semana.')
    expect(out).toContain('El fin de semana concentró la mayoría de las calorías extra.')
    expect(out.length).toBeLessThanOrEqual(2)
  })
})

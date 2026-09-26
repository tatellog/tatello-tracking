import {
  comboDayDetail,
  comboFacts,
  comboFocus,
  comboGroupLabel,
  comboHeadline,
  comboLift,
  comboOpening,
  comboWeek,
  comboWeekHook,
  comboWeekLine,
  evidenceDots,
} from '../combo-facts'
import { winningCombo } from '../month-built'
import { addDays, mkSig } from './signals.fixture'

const TARGET = 1800
const OPTS = { calorieTarget: TARGET }
const DEF = 1500 // en déficit sano
const OVER = 2200 // pasó la meta
const TODAY = '2026-09-27' // domingo

/* 40 días que terminan hoy. Sueño + entreno el mismo día → casi siempre en
 * déficit; solo entreno → a medias; el resto → casi nunca. */
function month() {
  const out = []
  for (let i = 0; i < 40; i++) {
    const day = addDays('2026-08-19', i)
    const mode = i % 4
    if (mode === 0) {
      // combo: sueño ≥ 7 h + entreno; uno de cada cinco se pasa
      out.push(
        mkSig(day, { sleep_minutes: 460, trained: true, calories: i % 20 === 0 ? OVER : DEF }),
      )
    } else if (mode === 1) {
      // solo entreno
      out.push(
        mkSig(day, { sleep_minutes: 360, trained: true, calories: i % 3 === 0 ? DEF : OVER }),
      )
    } else {
      out.push(
        mkSig(day, { sleep_minutes: 380, trained: false, calories: mode === 2 ? DEF : OVER }),
      )
    }
  }
  return out
}

describe('comboFacts', () => {
  const signals = month()
  const combo = winningCombo(signals, OPTS)!

  it('el combo existe y se separa de sus otros días', () => {
    expect(combo).not.toBeNull()
    expect(combo.signals.map((s) => s.key).sort()).toEqual(['cuerpo', 'sueno'])
  })

  it('cada hecho trae números reales, su pregunta de reserva y un id estable', () => {
    const facts = comboFacts(signals, combo, OPTS, TODAY)
    const ids = facts.map((f) => f.id)
    expect(ids).toContain('sin:sueno') // solo entreno, sin dormir 7 horas
    expect(ids).toContain('misses')
    for (const f of facts) {
      expect(f.text.length).toBeGreaterThan(10)
      expect(f.question.endsWith('?')).toBe(true)
    }
    const solo = facts.find((f) => f.id === 'sin:sueno')!
    expect(solo.text).toMatch(/^Los días que solo entrenaste, sin dormir 7 horas: \d+ de 10/)
    expect(solo.question).toBe('¿Y si solo entreno?')
  })

  it('los días que no funcionaron dicen cuántos y hacia dónde, con sus fechas', () => {
    const f = comboFacts(signals, combo, OPTS, TODAY).find((x) => x.id === 'misses')!
    expect(f.text).toContain('pasaron tu meta')
    expect(f.days.length).toBeGreaterThan(0)
  })

  it('sin meta de calorías no hay hechos (no se puede hablar de déficit)', () => {
    expect(comboFacts(signals, combo, { calorieTarget: null }, TODAY)).toEqual([])
  })

  it('un lado con menos de 3 días no publica la comparación', () => {
    const few = [
      ...Array.from({ length: 5 }, (_, i) =>
        mkSig(addDays('2026-09-01', i), { sleep_minutes: 460, trained: true, calories: DEF }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        mkSig(addDays('2026-09-10', i), { sleep_minutes: 300, trained: true, calories: OVER }),
      ),
    ]
    const facts = comboFacts(few, combo, OPTS, TODAY)
    expect(facts.some((f) => f.id === 'sin:sueno')).toBe(false)
    expect(facts.find((f) => f.id === 'misses')?.text).toBe(
      'Los 5 días que lo juntaste cerraron en déficit. Ninguno se salió.',
    )
  })
})

describe('lo fijo del chat', () => {
  const combo = {
    signals: [
      { key: 'sueno', label: 'Sueño' },
      { key: 'cuerpo', label: 'Entreno' },
    ],
    occurrences: 11,
    deficits: 7,
    days: ['2026-08-03', '2026-09-24'],
    restDays: 30,
    restDeficits: 9,
  }

  it('la apertura cuenta la evidencia y el punto de comparación', () => {
    expect(comboOpening(combo)).toEqual([
      'Tu patrón más repetido: dormir 7 horas o más y entrenar el mismo día.',
      'Pasó 11 días entre el 3 ago y el 24 sep. En 7 cerraste en déficit.',
      'Tus otros días: 9 de 30 en déficit.',
    ])
  })

  it('el foco es el hábito junto, sin cifras de meta', () => {
    expect(comboFocus(combo)).toBe('Juntar en un mismo día dormir 7 horas o más y entrenar.')
  })
})

describe('comboWeek', () => {
  const signals = month()
  const combo = winningCombo(signals, OPTS)!

  it('cuenta la semana en curso contra lo típico de sus semanas fuertes', () => {
    const w = comboWeek(signals, combo, OPTS, TODAY)!
    expect(w.daysLeft).toBe(1) // domingo
    expect(w.typical).not.toBeNull()
    expect(['reached', 'onTrack', 'short']).toContain(w.state)
  })

  it('las líneas de estado no culpan y dicen lo que falta', () => {
    expect(comboWeekLine({ done: 1, typical: 3, daysLeft: 4, state: 'onTrack' })).toBe(
      'Esta semana van 1 de 3. Quedan 4 días.',
    )
    expect(comboWeekLine({ done: 3, typical: 3, daysLeft: 2, state: 'reached' })).toContain(
      'lo que suelen tener tus mejores semanas',
    )
    expect(comboWeekLine({ done: 0, typical: 3, daysLeft: 1, state: 'short' })).toContain(
      'suma igual',
    )
    expect(comboWeekLine({ done: 2, typical: null, daysLeft: 3, state: 'noRef' })).toBe(
      'Esta semana ya lo juntaste 2 veces.',
    )
    expect(comboWeekLine(null)).toBeNull()
  })
})

describe('comboDayDetail', () => {
  const signals = month()
  const combo = winningCombo(signals, OPTS)!
  it('resume el día tocado: sueño, entreno, déficit y si coincidió el patrón', () => {
    const d = comboDayDetail(signals, combo, OPTS, '2026-08-23')
    expect(d).toMatchObject({ sleepMinutes: 460, trained: true, deficit: true, comboHit: true })
  })
  it('un día sin comida no dice déficit', () => {
    const d = comboDayDetail([mkSig('2026-09-01', { trained: true })], combo, OPTS, '2026-09-01')
    expect(d.deficit).toBeNull()
  })
})

describe('la tarjeta del patrón', () => {
  const base = {
    signals: [
      { key: 'sueno', label: 'Sueño' },
      { key: 'cuerpo', label: 'Entreno' },
    ],
    days: [],
  }

  it('el titular dice el hallazgo sin exagerar la diferencia', () => {
    // 5/8 contra 3/9: 1.9 veces → "casi el doble", no "el doble".
    const c = { ...base, occurrences: 8, deficits: 5, restDays: 9, restDeficits: 3 }
    expect(comboHeadline(c)).toBe(
      'Cuando duermes 7 horas y entrenas, cierras en déficit casi el doble.',
    )
    expect(comboLift({ ...c, deficits: 6 })).toBe('el doble') // 0.75 / 0.33
    expect(comboLift({ ...c, restDeficits: 5 })).toBe('más seguido')
    expect(comboLift({ ...c, restDeficits: 0 })).toBe('mucho más seguido')
    expect(comboGroupLabel(c)).toBe('Con los dos')
  })

  it('los puntos son un día cada uno; con muchos días se escalan', () => {
    expect(evidenceDots(8, 5)).toEqual([true, true, true, true, true, false, false, false])
    const scaled = evidenceDots(30, 9)
    expect(scaled).toHaveLength(12)
    expect(scaled.filter(Boolean)).toHaveLength(4)
    expect(evidenceDots(0, 0)).toEqual([])
  })

  it('el gancho de la semana compara contra tus mejores semanas, sin culpa', () => {
    expect(comboWeekHook({ done: 1, typical: 3, daysLeft: 3, state: 'onTrack' })).toBe(
      'Esta semana lo juntaste 1 vez. Tus mejores semanas, 3.',
    )
    expect(comboWeekHook({ done: 0, typical: 2, daysLeft: 5, state: 'onTrack' })).toBe(
      'Esta semana todavía no lo juntas. Tus mejores semanas, 2.',
    )
    expect(comboWeekHook({ done: 3, typical: 3, daysLeft: 1, state: 'reached' })).toContain(
      'como tus mejores semanas',
    )
    expect(comboWeekHook({ done: 0, typical: null, daysLeft: 4, state: 'noRef' })).toBeNull()
  })
})

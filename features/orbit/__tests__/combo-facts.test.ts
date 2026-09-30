import {
  comboDayDetail,
  comboFacts,
  comboFocus,
  comboGroupLabel,
  comboHeadline,
  comboLift,
  comboLiftBadge,
  comboOpening,
  comboWeek,
  comboWeekDots,
  comboDayCards,
  comboKcalGap,
  comboToday,
  comboTodayHighlight,
  fmtKcalDelta,
  comboWeekMeter,
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
      'Tus demás días: 9 de 30 en déficit.',
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
      'Esta semana van 1 de 3.',
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

  it('nunca cuenta los días que quedan', () => {
    for (const state of ['onTrack', 'short', 'noRef'] as const) {
      for (const done of [0, 1]) {
        const line = comboWeekLine({
          done,
          typical: state === 'noRef' ? null : 3,
          daysLeft: 4,
          state,
        })
        expect(line ?? '').not.toMatch(/quedan/i)
      }
    }
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
    expect(comboGroupLabel(c)).toBe('Con sueño de 7 h y entreno')
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

describe('la tarjeta visual', () => {
  const base = {
    signals: [
      { key: 'sueno', label: 'Sueño' },
      { key: 'cuerpo', label: 'Entreno' },
    ],
    days: [],
    occurrences: 8,
    deficits: 5,
    restDays: 9,
    restDeficits: 3,
  }
  it('el número grande nunca redondea hacia arriba', () => {
    expect(comboLiftBadge(base)).toBe('casi 2×')
    expect(comboLiftBadge({ ...base, deficits: 6 })).toBe('2×')
    expect(comboLiftBadge({ ...base, deficits: 8, restDeficits: 2 })).toBe('más de 2×')
    expect(comboLiftBadge({ ...base, restDeficits: 4 })).toBe('1,4×')
    expect(comboLiftBadge({ ...base, restDeficits: 0 })).toBe('mucho más')
  })
  it('la semana en puntos: lo hecho contra tus mejores semanas', () => {
    expect(comboWeekDots({ done: 1, typical: 3, daysLeft: 3, state: 'onTrack' })).toEqual([
      true,
      false,
      false,
    ])
    expect(comboWeekDots({ done: 4, typical: 3, daysLeft: 1, state: 'reached' })).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect(comboWeekDots({ done: 0, typical: null, daysLeft: 5, state: 'noRef' })).toEqual([])
    expect(comboWeekDots(null)).toEqual([])
  })
})

describe('la semana como medidor', () => {
  it('en camino: estrellas contra tus mejores semanas, sin abrir con 0', () => {
    expect(comboWeekMeter({ done: 0, typical: 2, daysLeft: 5, state: 'onTrack' })).toEqual({
      stars: [false, false],
      count: null,
      note: 'Tus mejores semanas lo juntan 2 veces.',
      reached: false,
    })
    expect(comboWeekMeter({ done: 1, typical: 2, daysLeft: 5, state: 'onTrack' })).toEqual({
      stars: [true, false],
      count: '1 de 2',
      note: 'Con uno más, igualas tus mejores semanas.',
      reached: false,
    })
  })
  it('cumplida va en oro y no sube la vara', () => {
    const m = comboWeekMeter({ done: 3, typical: 2, daysLeft: 2, state: 'reached' })!
    expect(m.reached).toBe(true)
    expect(m.stars).toEqual([true, true, true])
    expect(m.note).toBe('Ya es una de tus mejores semanas.')
  })
  it('si ya no alcanza, suma sin culpa', () => {
    expect(comboWeekMeter({ done: 0, typical: 3, daysLeft: 1, state: 'short' })!.note).toBe(
      'Cada día que lo juntes suma.',
    )
  })
  it('sin referencia: solo lo encendido, sin meta', () => {
    expect(comboWeekMeter({ done: 2, typical: null, daysLeft: 3, state: 'noRef' })).toEqual({
      stars: [true, true],
      count: null,
      note: '2 veces esta semana',
      reached: false,
    })
    expect(comboWeekMeter({ done: 0, typical: null, daysLeft: 3, state: 'noRef' })!.stars).toEqual(
      [],
    )
    expect(comboWeekMeter(null)).toBeNull()
  })
})

describe('comboToday', () => {
  const combo = {
    signals: [
      { key: 'sueno', label: 'Sueño' },
      { key: 'cuerpo', label: 'Entreno' },
    ],
    days: [],
    occurrences: 8,
    deficits: 5,
    restDays: 9,
    restDeficits: 3,
  }
  it('enciende lo que ya pasó hoy, en el orden del combo', () => {
    const sigs = [mkSig(TODAY, { sleep_minutes: 450, trained: false })]
    expect(comboToday(sigs, combo, OPTS, TODAY)).toEqual([
      { key: 'sueno', status: 'on', value: '7 h 30', fromWatch: false },
      { key: 'cuerpo', status: 'open', value: null, fromWatch: false },
    ])
  })
  it('descanso no es ✓ ni pendiente; una noche corta ya registrada queda cerrada', () => {
    const sigs = [mkSig(TODAY, { sleep_minutes: 370, trained: false, rested: true })]
    expect(comboToday(sigs, combo, OPTS, TODAY)).toEqual([
      { key: 'sueno', status: 'closed', value: '6 h 10', fromWatch: false },
      { key: 'cuerpo', status: 'rest', value: 'Descanso', fromWatch: false },
    ])
  })
  it('sin registro de hoy, todo apagado', () => {
    expect(comboToday([], combo, OPTS, TODAY).every((h) => h.status === 'open')).toBe(true)
  })
})

describe('tu día fuerte', () => {
  const signals = month()
  const combo = winningCombo(signals, OPTS)!

  it('el reloj marca lo que encendió', () => {
    const sigs = [
      mkSig(TODAY, {
        sleep_minutes: 450,
        sleep_source: 'wearable',
        trained: true,
        workout_source: 'manual',
      }),
    ]
    expect(comboToday(sigs, combo, OPTS, TODAY).map((h) => [h.key, h.fromWatch])).toEqual(
      combo.signals.map((s) => [s.key, s.key === 'sueno']),
    )
  })

  it('la prueba en kcal: el patrón queda más abajo de la meta que el resto', () => {
    const gap = comboKcalGap(signals, combo, OPTS)!
    expect(gap.withAvg).toBeLessThan(gap.restAvg)
    expect(Math.abs(gap.withAvg % 10)).toBe(0)
  })

  it('nunca publica una prueba que desmiente el patrón', () => {
    // Los días sin el patrón quedan MÁS abajo: la comparación no nace.
    const flipped = signals.map((s) =>
      comboToday([s], combo, OPTS, s.day!).every((h) => h.status === 'on')
        ? { ...s, calories: 2400 }
        : s,
    )
    expect(comboKcalGap(flipped, combo, OPTS)).toBeNull()
  })

  it('sin meta o sin muestra no hay comparación', () => {
    expect(comboKcalGap(signals, combo, {})).toBeNull()
    expect(comboKcalGap(signals.slice(0, 6), combo, OPTS)).toBeNull()
  })

  it('tus días reales, el más reciente primero', () => {
    const cards = comboDayCards(signals, combo, OPTS, 3)
    expect(cards).toHaveLength(3)
    expect(cards[0]!.day > cards[1]!.day).toBe(true)
    expect(cards[0]!.workout).toBe('Entreno')
    expect(typeof cards[0]!.deficit).toBe('boolean')
    expect(cards[0]!.label).toMatch(/^(lun|mar|mié|jue|vie|sáb|dom) \d{1,2}$/)
  })

  it('formatea el delta con signo tipográfico', () => {
    expect(fmtKcalDelta(-1310)).toBe('−1,310 kcal')
    expect(fmtKcalDelta(80)).toBe('+80 kcal')
    expect(fmtKcalDelta(0)).toBe('0 kcal')
  })
})

describe('la frase de Tu smartwatch', () => {
  const h = (
    key: string,
    status: 'on' | 'open' | 'rest' | 'closed',
    value: string | null = null,
  ) => ({
    key,
    status,
    value,
    fromWatch: false,
  })
  it('noche corta + entreno: nombra lo que pasó y la receta, sin culpa', () => {
    expect(comboTodayHighlight([h('sueno', 'closed', '6 h 18'), h('cuerpo', 'on', 'Fuerza')])).toBe(
      'Dormiste 6 h 18 y entrenaste. Tus días fuertes empiezan con 7 h de sueño.',
    )
  })
  it('todo cumplido', () => {
    expect(comboTodayHighlight([h('sueno', 'on', '7 h 30'), h('cuerpo', 'on', 'Fuerza')])).toBe(
      'Dormiste 7 h 30 y entrenaste. Hoy ya es día fuerte.',
    )
  })
  it('a la mitad: qué lo completaría', () => {
    expect(comboTodayHighlight([h('sueno', 'on', '7 h 30'), h('cuerpo', 'open')])).toBe(
      'Dormiste 7 h 30. Con el entreno, hoy sería día fuerte.',
    )
  })
  it('descanso', () => {
    expect(comboTodayHighlight([h('sueno', 'on', '7 h 30'), h('cuerpo', 'rest', 'Descanso')])).toBe(
      'Dormiste 7 h 30 y hoy descansas. Mañana puede ser día fuerte.',
    )
  })
  it('sin nada que contar, sin frase', () => {
    expect(comboTodayHighlight([h('sueno', 'open'), h('cuerpo', 'open')])).toBeNull()
    expect(comboTodayHighlight([])).toBeNull()
  })
})

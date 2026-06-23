import { deriveDimensions } from '../logic'
import {
  brightestToday,
  formatLongDate,
  presentChips,
  tomorrowFocus,
  weakestToday,
} from '../present-logic'
import { mkSig, STRONG } from './signals.fixture'

const DAY = '2026-05-16'

// deriveDimensions necesita contexto; sin macro targets `alimento` usa el
// conteo de comidas, y ciclo se gatea fuera salvo que lo pidamos.
const ctx = { calorieTarget: null, proteinTarget: null, cycleEnabled: true }
const dims = (o = {}) => deriveDimensions(mkSig(DAY, o), ctx)

describe('brightestToday', () => {
  it('null cuando nada se registró', () => {
    expect(brightestToday(dims({}), mkSig(DAY, {}))).toBeNull()
  })

  it('elige la dimensión registrada con más brillo (Movimiento)', () => {
    const s = mkSig(DAY, { trained: true, energy: 2 })
    const hero = brightestToday(dims({ trained: true, energy: 2 }), s)
    expect(hero?.key).toBe('cuerpo')
    expect(hero?.label).toBe('Movimiento')
  })

  it('NUNCA elige ciclo como héroe (estar en periodo no es un logro)', () => {
    // on_period da brillo 0.82 (alto), pero ciclo se excluye del héroe;
    // gana la siguiente dimensión registrada (comida).
    const s = mkSig(DAY, { on_period: true, meal_count: 2 })
    const hero = brightestToday(dims({ on_period: true, meal_count: 2 }), s)
    expect(hero?.key).not.toBe('ciclo')
    expect(hero?.key).toBe('alimento')
  })

  it('null si lo único registrado es el ciclo', () => {
    const s = mkSig(DAY, { on_period: true })
    expect(brightestToday(dims({ on_period: true }), s)).toBeNull()
  })

  it('NUNCA elige energía (auto-rating), aunque tenga el brillo más alto', () => {
    // energía 5 → brillo 1.0 (máximo), pero es auto-rating: el héroe premia
    // ACCIONES. Gana la comida (acción registrada).
    const o = { energy: 5, meal_count: 2 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    expect(hero?.key).not.toBe('energia')
    expect(hero?.key).toBe('alimento')
  })

  it('null si solo hay auto-ratings (energía/mente), sin acción', () => {
    const o = { energy: 5, mood: 'good', motivation: 5 }
    expect(brightestToday(dims(o), mkSig(DAY, o))).toBeNull()
  })

  it('con comida y sueño bien hechos, gana COMIDA (prioridad del objetivo)', () => {
    // meal_count 3 → ~1.0 y sueño 7.5h → ~1.0: ambos "bien". Prioridad: comida.
    const o = { meal_count: 3, sleep_minutes: 450 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    expect(hero?.key).toBe('alimento')
  })

  it('sin comida, entre sueño y movimiento bien hechos gana SUEÑO', () => {
    const o = { trained: true, sleep_minutes: 450 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    expect(hero?.key).toBe('sueno')
  })

  it('si nada llega a "bien", gana lo de mayor brillo (lo mejor que hubo)', () => {
    // comida 1 (~0.57) vs sueño 5h (~0.38): ninguno ≥ 0.7 → gana el más brillante.
    const o = { meal_count: 1, sleep_minutes: 300 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    expect(hero?.key).toBe('alimento')
  })

  it('héroe Comida: ancla la proteína a TU meta cuando existe', () => {
    const o = { meal_count: 3, protein_g: 86 }
    const hero = brightestToday(dims(o), mkSig(DAY, o), { proteinTarget: 120 })
    expect(hero?.key).toBe('alimento')
    expect(hero?.detail).toMatch(/86 g de proteína de tu meta de 120 g/)
    expect(hero?.observation).toBe('Tu plato sostuvo el día.')
  })

  it('héroe Comida: sin meta de proteína, el dato va solo (sin inventar meta)', () => {
    const o = { meal_count: 2, protein_g: 40 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    expect(hero?.detail).toMatch(/40 g de proteína hoy/)
    expect(hero?.detail).not.toMatch(/meta/)
  })

  it('héroe Comida: sin proteína registrada, cae al conteo de comidas', () => {
    const o = { meal_count: 2 }
    const hero = brightestToday(dims(o), mkSig(DAY, o), { proteinTarget: 120 })
    expect(hero?.detail).toBe('2 comidas registradas.')
  })

  it('héroe Sueño: el detalle reporta las horas reales', () => {
    const o = { trained: true, sleep_minutes: 450 }
    const hero = brightestToday(dims(o), mkSig(DAY, o))
    // sueño gana por prioridad sobre movimiento cuando ambos están "bien".
    expect(hero?.key).toBe('sueno')
    expect(hero?.detail).toMatch(/7\.5 h/)
  })
})

describe('presentChips', () => {
  it('lista señales con su dato concreto, incluidas proteína y agua', () => {
    const s = mkSig(DAY, { meal_count: 3, energy: 4, protein_g: 62, water_glasses: 6 })
    const chips = presentChips(s, { cycleEnabled: true })
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c.value]))
    expect(byKey.comida).toBe('3 comidas')
    expect(byKey.energia).toBe('Buena')
    expect(byKey.proteina).toBe('62 g')
    expect(byKey.agua).toBe('6 vasos')
  })

  it('excluye el héroe y el más débil (no se cuenta dos veces)', () => {
    const s = mkSig(DAY, { trained: true, meal_count: 2, sleep_minutes: 300 })
    const chips = presentChips(s, { cycleEnabled: true, excludeKeys: ['cuerpo', 'sueno'] })
    const keys = chips.map((c) => c.key)
    expect(keys).not.toContain('cuerpo')
    expect(keys).not.toContain('sueno')
    expect(keys).toContain('comida')
  })

  it('singulariza una comida y un vaso', () => {
    const chips = presentChips(mkSig(DAY, { meal_count: 1, water_glasses: 1 }), {})
    const byKey = Object.fromEntries(chips.map((c) => [c.key, c.value]))
    expect(byKey.comida).toBe('1 comida')
    expect(byKey.agua).toBe('1 vaso')
  })

  it('Mente deriva palabra real (no "Anotado") de motivación/estrés', () => {
    const impulso = presentChips(mkSig(DAY, { motivation: 5 }), {})
    expect(impulso.find((c) => c.key === 'mente')?.value).toBe('Con impulso')
    const calma = presentChips(mkSig(DAY, { stress: 1 }), {})
    expect(calma.find((c) => c.key === 'mente')?.value).toBe('En calma')
    const mood = presentChips(mkSig(DAY, { mood: 'good' }), {})
    expect(mood.find((c) => c.key === 'mente')?.value).toBe('Bien')
  })

  it('ciclo solo con el gate abierto', () => {
    const closed = presentChips(mkSig(DAY, { on_period: true }), { cycleEnabled: false })
    expect(closed.some((c) => c.key === 'ciclo')).toBe(false)
    const open = presentChips(mkSig(DAY, { on_period: true }), { cycleEnabled: true })
    expect(open.some((c) => c.key === 'ciclo')).toBe(true)
  })

  it('vacío sin señales', () => {
    expect(presentChips(null)).toEqual([])
    expect(presentChips(mkSig(DAY, {}))).toEqual([])
  })
})

describe('weakestToday', () => {
  it('elige la dimensión registrada de menor brillo, distinta del héroe', () => {
    const s = mkSig(DAY, { trained: true, sleep_minutes: 300 })
    const weak = weakestToday(dims({ trained: true, sleep_minutes: 300 }), s, {
      excludeKey: 'cuerpo',
    })
    expect(weak?.key).toBe('sueno')
    expect(weak?.value).toBe('5.0 h registradas')
    expect(weak?.suggestion).toMatch(/descansar/i)
  })

  it('un auto-rating bajo SÍ puede ser "lo que menos apareció" (nota suave)', () => {
    // energía 2 → 0.4 (parcial). Con el entreno como héroe, energía baja
    // aparece como lo que menos apareció, con su sugerencia gentil.
    const o = { trained: true, energy: 2 }
    const weak = weakestToday(dims(o), mkSig(DAY, o), { excludeKey: 'cuerpo' })
    expect(weak?.key).toBe('energia')
    expect(weak?.suggestion).toMatch(/recargar/i)
  })

  it('null en un día redondo (todo brillante)', () => {
    const s = mkSig(DAY, STRONG)
    const hero = brightestToday(dims(STRONG), s)
    expect(weakestToday(dims(STRONG), s, { excludeKey: hero?.key })).toBeNull()
  })

  it('null sin señales', () => {
    expect(weakestToday(dims({}), mkSig(DAY, {}))).toBeNull()
  })
})

describe('tomorrowFocus', () => {
  it('deriva el foco de lo que menos apareció', () => {
    const weak = { key: 'sueno' as const, label: 'Sueño', value: '5.0 h', suggestion: '' }
    expect(tomorrowFocus(weak)).toMatch(/dormir mejor/i)
  })

  it('null cuando no hay dimensión floja', () => {
    expect(tomorrowFocus(null)).toBeNull()
  })
})

describe('formatLongDate', () => {
  it('formatea en español sin correrse por timezone', () => {
    expect(formatLongDate('2026-05-16')).toBe('Sábado, 16 de mayo')
    expect(formatLongDate('2026-06-21')).toBe('Domingo, 21 de junio')
  })

  it('cadena vacía ante fecha inválida', () => {
    expect(formatLongDate('not-a-date')).toBe('')
  })
})

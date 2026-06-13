import { stateForPct, calculateTodayUniverseRewards, detailForAttribute } from '../universe-rewards'
import type { UniverseInput } from '../universe-rewards'

// Fixture base — sobreescribe solo los campos relevantes en cada test.
const base: UniverseInput = {
  proteinG: 0,
  proteinTarget: null,
  mealCount: 0,
  waterGlasses: 0,
  waterGoalGlasses: 8,
  sleepMinutes: null,
  restedToday: false,
  energy: null,
  hasWellbeingSignal: false,
  localHour: 12,
}

// ─────────────────────────────────────────────────────────────────────────────
// stateForPct
// ─────────────────────────────────────────────────────────────────────────────

describe('stateForPct', () => {
  it('retorna empty para 0', () => {
    expect(stateForPct(0)).toBe('empty')
  })

  it('retorna empty para valores negativos', () => {
    expect(stateForPct(-5)).toBe('empty')
  })

  it('retorna partial para 1', () => {
    expect(stateForPct(1)).toBe('partial')
  })

  it('retorna partial para 69', () => {
    expect(stateForPct(69)).toBe('partial')
  })

  it('retorna almost para 70', () => {
    expect(stateForPct(70)).toBe('almost')
  })

  it('retorna almost para 99', () => {
    expect(stateForPct(99)).toBe('almost')
  })

  it('retorna complete para 100', () => {
    expect(stateForPct(100)).toBe('complete')
  })

  it('retorna complete para valores por encima de 100 (pct ya clampeado antes, pero la función lo protege igual)', () => {
    expect(stateForPct(120)).toBe('complete')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Energía
// ─────────────────────────────────────────────────────────────────────────────

describe('Energía — con objetivo de proteína', () => {
  it('calcula pct 87 y estado almost con microcopy de gramos faltantes (proteinG=118, target=135)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 118,
      proteinTarget: 135,
      mealCount: 3,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(87)
    expect(energia.state).toBe('almost')
    expect(energia.microcopy).toBe('17 g y tu Energía llega.')
  })

  it('faltante grande (> 20 g) en almost → microcopy genérico, sin número', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 100,
      proteinTarget: 140, // 71% → almost, faltan 40 g
      mealCount: 2,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.state).toBe('almost')
    expect(energia.microcopy).toBe('Casi se alinea.')
  })

  it('faltante chico pero de noche (localHour >= 21) → microcopy genérico, sin número', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 118,
      proteinTarget: 135,
      mealCount: 3,
      localHour: 22,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.state).toBe('almost')
    expect(energia.microcopy).toBe('Casi se alinea.')
  })

  it('proteína 0 con mealCount > 0 → pct mínimo 12 partial en vez de quedarse en calma', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 0,
      proteinTarget: 135,
      mealCount: 2,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(12)
    expect(energia.state).toBe('partial')
  })

  it('poca proteína nunca muestra menos barra que cero proteína (Math.max del floor)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 8, // 8/120 = 7% sin floor — debe subir a 12
      proteinTarget: 120,
      mealCount: 1,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(12)
    expect(energia.state).toBe('partial')
  })

  it('proteína 0 y mealCount 0 → empty', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 0,
      proteinTarget: 135,
      mealCount: 0,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(0)
    expect(energia.state).toBe('empty')
  })

  it('objetivo alcanzado exactamente → complete con microcopy estándar', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 135,
      proteinTarget: 135,
      mealCount: 4,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(100)
    expect(energia.state).toBe('complete')
    expect(energia.microcopy).toBe('Hoy se cerró.')
  })

  it('faltante mínimo de 1 g — redondea hacia arriba (proteinG=99, target=100)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinG: 99,
      proteinTarget: 100,
      mealCount: 3,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.state).toBe('almost')
    expect(energia.microcopy).toBe('1 g y tu Energía llega.')
  })
})

describe('Energía — sin objetivo de proteína (fallback mealCount)', () => {
  it('1 comida → 33 pct partial', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinTarget: null,
      mealCount: 1,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(33)
    expect(energia.state).toBe('partial')
  })

  it('3 comidas → 100 pct complete', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinTarget: null,
      mealCount: 3,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(100)
    expect(energia.state).toBe('complete')
  })

  it('0 comidas → 0 pct empty', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      proteinTarget: null,
      mealCount: 0,
    })
    const energia = result.find((a) => a.key === 'energia')!

    expect(energia.pct).toBe(0)
    expect(energia.state).toBe('empty')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Claridad
// ─────────────────────────────────────────────────────────────────────────────

describe('Claridad — agua', () => {
  it('0 vasos → empty', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      waterGlasses: 0,
      waterGoalGlasses: 8,
    })
    const claridad = result.find((a) => a.key === 'claridad')!

    expect(claridad.state).toBe('empty')
  })

  it('meta alcanzada exactamente → complete', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      waterGlasses: 8,
      waterGoalGlasses: 8,
    })
    const claridad = result.find((a) => a.key === 'claridad')!

    expect(claridad.pct).toBe(100)
    expect(claridad.state).toBe('complete')
    expect(claridad.microcopy).toBe('Hoy se cerró.')
  })

  it('falta 1 vaso en almost → microcopy singular', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      waterGlasses: 7,
      waterGoalGlasses: 8,
    })
    const claridad = result.find((a) => a.key === 'claridad')!

    expect(claridad.state).toBe('almost')
    expect(claridad.microcopy).toBe('Un vaso y llega.')
  })

  it('faltan 2 vasos en almost → microcopy plural', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      waterGlasses: 6,
      waterGoalGlasses: 8,
    })
    const claridad = result.find((a) => a.key === 'claridad')!

    expect(claridad.state).toBe('almost')
    expect(claridad.microcopy).toBe('2 vasos y llega.')
  })

  it('goal 0 se protege con Math.max(1, …) — no explota con división por cero', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      waterGlasses: 0,
      waterGoalGlasses: 0,
    })
    const claridad = result.find((a) => a.key === 'claridad')!

    expect(claridad.pct).toBe(0)
    expect(claridad.state).toBe('empty')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Estabilidad
// ─────────────────────────────────────────────────────────────────────────────

describe('Estabilidad — sueño y descanso', () => {
  it('sleepMinutes null y restedToday false → empty con pct 0', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: null,
      restedToday: false,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(0)
    expect(estabilidad.state).toBe('empty')
  })

  it('sleepMinutes null + restedToday true → 10 pct partial (solo el bonus)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: null,
      restedToday: true,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(10)
    expect(estabilidad.state).toBe('partial')
  })

  it('420 min (7 h, la noche de referencia) → 100 pct complete', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: 420,
      restedToday: false,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(100)
    expect(estabilidad.state).toBe('complete')
  })

  it('330 min (5.5 h) → 79 pct almost sin microcopy de faltante concreto (anoche no es accionable)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: 330,
      restedToday: false,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(79)
    expect(estabilidad.state).toBe('almost')
    expect(estabilidad.microcopy).toBe('Casi se alinea.')
  })

  it('480 min + restedToday no supera 100 (clamp en tope)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: 480,
      restedToday: true,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(100)
    expect(estabilidad.state).toBe('complete')
  })

  it('dormir más de 7 h (600 min) no resta — se queda en 100', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      sleepMinutes: 600,
      restedToday: false,
    })
    const estabilidad = result.find((a) => a.key === 'estabilidad')!

    expect(estabilidad.pct).toBe(100)
    expect(estabilidad.state).toBe('complete')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Brillo
// ─────────────────────────────────────────────────────────────────────────────

describe('Brillo — check-in de bienestar', () => {
  it('energy=3 → 100 pct complete (el nivel no importa, registrarlo es el ritual)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      energy: 3,
      hasWellbeingSignal: false,
    })
    const brillo = result.find((a) => a.key === 'brillo')!

    expect(brillo.pct).toBe(100)
    expect(brillo.state).toBe('complete')
  })

  it('energy=1 → 100 pct complete (nivel bajo vale igual que nivel alto)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      energy: 1,
      hasWellbeingSignal: false,
    })
    const brillo = result.find((a) => a.key === 'brillo')!

    expect(brillo.pct).toBe(100)
    expect(brillo.state).toBe('complete')
  })

  it('energy null + hasWellbeingSignal → 70 pct almost (pull suave hacia el check-in de energía)', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      energy: null,
      hasWellbeingSignal: true,
    })
    const brillo = result.find((a) => a.key === 'brillo')!

    expect(brillo.pct).toBe(70)
    expect(brillo.state).toBe('almost')
    expect(brillo.microcopy).toBe('Casi se alinea.')
  })

  it('sin ninguna señal de bienestar → 0 pct empty', () => {
    const result = calculateTodayUniverseRewards({
      ...base,
      energy: null,
      hasWellbeingSignal: false,
    })
    const brillo = result.find((a) => a.key === 'brillo')!

    expect(brillo.pct).toBe(0)
    expect(brillo.state).toBe('empty')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateTodayUniverseRewards — estructura del resultado
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateTodayUniverseRewards — estructura y orden', () => {
  it('devuelve los 4 atributos en orden energia, claridad, estabilidad, brillo con labels correctos', () => {
    const result = calculateTodayUniverseRewards(base)

    expect(result).toHaveLength(4)
    expect(result.map((a) => a.key)).toEqual(['energia', 'claridad', 'estabilidad', 'brillo'])
    expect(result.map((a) => a.label)).toEqual(['Energía', 'Claridad', 'Estabilidad', 'Brillo'])
  })

  it('solo Brillo es gesto (encendido/en calma); el resto es esfuerzo proporcional', () => {
    const byKey = Object.fromEntries(
      calculateTodayUniverseRewards(base).map((a) => [a.key, a.kind]),
    )
    expect(byKey).toEqual({
      energia: 'progress',
      claridad: 'progress',
      estabilidad: 'progress',
      brillo: 'gesture',
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// detailForAttribute — el "de dónde viene" al tocar un card
// ─────────────────────────────────────────────────────────────────────────────

describe('detailForAttribute', () => {
  it('energia con objetivo: proteína + comidas', () => {
    const d = detailForAttribute('energia', {
      ...base,
      proteinG: 87.4,
      proteinTarget: 135,
      mealCount: 3,
    })
    // El hecho primero ("X g hoy"), el objetivo como referencia secundaria
    // — nunca "X de Y", que enmarca déficit / countdown.
    expect(d.lines).toEqual([
      { label: 'Proteína', value: '87 g hoy' },
      { label: 'Tu objetivo', value: '135 g' },
      { label: 'Comidas', value: '3 registradas' },
    ])
  })

  it('energia con 1 comida usa singular', () => {
    const d = detailForAttribute('energia', {
      ...base,
      proteinG: 20,
      proteinTarget: 135,
      mealCount: 1,
    })
    expect(d.lines[2]).toEqual({ label: 'Comidas', value: '1 registrada' })
  })

  it('energia sin objetivo: solo comidas registradas, sin "de 3"', () => {
    const d = detailForAttribute('energia', { ...base, mealCount: 2 })
    expect(d.lines).toEqual([{ label: 'Comidas', value: '2 registradas' }])
  })

  it('claridad: vasos hoy + meta secundaria, sin "de"', () => {
    const d = detailForAttribute('claridad', { ...base, waterGlasses: 6, waterGoalGlasses: 8 })
    expect(d.lines).toEqual([
      { label: 'Vasos', value: '6 hoy' },
      { label: 'Tu meta', value: '8' },
    ])
  })

  it('estabilidad con sueño: horas y minutos', () => {
    const d = detailForAttribute('estabilidad', { ...base, sleepMinutes: 435 })
    expect(d.lines).toEqual([{ label: 'Dormiste', value: '7 h 15 min' }])
  })

  it('estabilidad con horas exactas omite los minutos', () => {
    const d = detailForAttribute('estabilidad', { ...base, sleepMinutes: 420 })
    expect(d.lines).toEqual([{ label: 'Dormiste', value: '7 h' }])
  })

  it('estabilidad sin registro no acusa, y suma la línea de descanso', () => {
    const d = detailForAttribute('estabilidad', { ...base, restedToday: true })
    expect(d.lines).toEqual([
      { label: 'Dormiste', value: 'Aún sin registro' },
      { label: 'Descanso', value: 'Hoy ✓' },
    ])
  })

  it('brillo: hecho / una señal / te espera', () => {
    expect(detailForAttribute('brillo', { ...base, energy: 3 }).lines[0]?.value).toBe('Hecho ✓')
    expect(
      detailForAttribute('brillo', { ...base, hasWellbeingSignal: true }).lines[0]?.value,
    ).toBe('Una señal tuya ✓')
    expect(detailForAttribute('brillo', base).lines[0]?.value).toBe('Te espera')
  })

  it('cada atributo trae su esencia en voz del coach', () => {
    for (const key of ['energia', 'claridad', 'estabilidad', 'brillo'] as const) {
      expect(detailForAttribute(key, base).essence.length).toBeGreaterThan(0)
    }
  })
})

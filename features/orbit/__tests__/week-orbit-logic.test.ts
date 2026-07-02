import {
  appearanceCount,
  buildAppearanceLine,
  buildWeekDimensions,
  buildWeekFindings,
  daysAhead,
  isoTwoWeekRange,
  isoWeekRange,
  mondayOf,
  mostRepeated,
  needsAttention,
  risingSignal,
  dimDeficitBridge,
  WEEK_DIM_ORDER,
  weekDirection,
  weekLever,
  weekSilhouette,
} from '../week-orbit-logic'
import { mkSig } from './signals.fixture'

// Semana de referencia: lunes 2026-06-15 … domingo 2026-06-21.
const MON = '2026-06-15'
const TUE = '2026-06-16'
const WED = '2026-06-17'
const THU = '2026-06-18'
const FRI = '2026-06-19'
const SUN = '2026-06-21'
const CTX = { proteinTarget: 130 }

describe('fechas ISO (lunes-primero)', () => {
  it('mondayOf cae en lunes para cualquier día de la semana', () => {
    expect(mondayOf(SUN)).toBe(MON)
    expect(mondayOf(WED)).toBe(MON)
    expect(mondayOf(MON)).toBe(MON)
  })

  it('isoWeekRange va de lunes a hoy', () => {
    expect(isoWeekRange(WED)).toEqual({ from: MON, to: WED })
  })

  it('isoTwoWeekRange arranca el lunes de la semana pasada', () => {
    expect(isoTwoWeekRange(SUN)).toEqual({ from: '2026-06-08', to: SUN })
  })
})

describe('daysAhead (§0 · la ventana abierta)', () => {
  it('cuenta los días que faltan DESPUÉS de hoy (lienzo, no cuota)', () => {
    expect(daysAhead(MON)).toBe(6)
    expect(daysAhead(WED)).toBe(4)
    expect(daysAhead(SUN)).toBe(0)
  })
})

describe('weekDirection (§0 · rumbo vs la semana pasada)', () => {
  const lastWeek = (d: number, o: object) => mkSig(`2026-06-${String(8 + d).padStart(2, '0')}`, o)

  it('null cuando la semana pasada no tiene con qué comparar', () => {
    const signals = [mkSig(MON, { meal_count: 1 }), mkSig(TUE, { meal_count: 1 })]
    expect(weekDirection(signals, WED, CTX)).toBeNull()
  })

  it('rising cuando el ritmo creció ≥2 vs la misma ventana pasada', () => {
    const signals = [
      lastWeek(0, { meal_count: 1 }), // semana pasada: 1 día de ritmo
      mkSig(MON, { meal_count: 1, water_glasses: 5 }),
      mkSig(TUE, { meal_count: 1, water_glasses: 5 }),
      mkSig(WED, { meal_count: 1, water_glasses: 5 }),
    ]
    expect(weekDirection(signals, SUN, CTX)?.state).toBe('rising')
  })

  it('softer cuando el ritmo bajó ≥2 en la misma ventana', () => {
    const signals = [
      lastWeek(0, { meal_count: 1, water_glasses: 5 }),
      lastWeek(1, { meal_count: 1, water_glasses: 5 }),
      lastWeek(2, { meal_count: 1, water_glasses: 5 }),
      mkSig(MON, { meal_count: 1 }), // esta semana: 1 día
    ]
    expect(weekDirection(signals, WED, CTX)?.state).toBe('softer')
  })

  it('steady cuando el ritmo se mantiene dentro de la banda', () => {
    const signals = [
      lastWeek(0, { meal_count: 1, water_glasses: 5 }),
      mkSig(MON, { meal_count: 1, water_glasses: 5 }),
    ]
    expect(weekDirection(signals, MON, CTX)?.state).toBe('steady')
  })

  it('energía NO cuenta para el ritmo (coherencia con Mes)', () => {
    // Semana pasada 1 día de comida; esta semana el mismo 1 día de comida pero
    // +energía extra. Como energía no entra al ritmo, sigue steady (no rising).
    const signals = [
      lastWeek(0, { meal_count: 1 }),
      mkSig(MON, { meal_count: 1, energy: 4 }),
      mkSig(TUE, { energy: 4 }),
      mkSig(WED, { energy: 4 }),
    ]
    expect(weekDirection(signals, SUN, CTX)?.state).toBe('steady')
  })
})

describe('weekSilhouette (§S · la forma de los 7 días)', () => {
  const CTX_CAL = { proteinTarget: 130, calorieTarget: 2000 }

  it('devuelve 7 celdas L-M-M-J-V-S-D con estado por día', () => {
    const cells = weekSilhouette([mkSig(MON, { meal_count: 1 })], WED, CTX)
    expect(cells).toHaveLength(7)
    expect(cells.map((c) => c.letter)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D'])
    expect(cells[0]?.state).toBe('past') // MON < WED
    expect(cells[2]?.state).toBe('today') // WED
    expect(cells[3]?.state).toBe('future') // THU > WED
    expect(cells[3]?.fullness).toBe(0)
    expect(cells[0]?.fullness).toBeGreaterThan(0) // MON registró comida
  })

  it('un día en déficit emite luz (deficit true); el superávit no', () => {
    const cells = weekSilhouette(
      [
        mkSig(MON, { calories: 1500, meal_count: 2 }),
        mkSig(TUE, { calories: 2400, meal_count: 2 }),
      ],
      WED,
      CTX_CAL,
    )
    expect(cells.find((c) => c.date === MON)?.deficit).toBe(true) // 1500 en [1200,2000]
    expect(cells.find((c) => c.date === TUE)?.deficit).toBe(false) // 2400 superávit
  })

  it('sin meta calórica ningún día marca déficit', () => {
    const cells = weekSilhouette([mkSig(MON, { calories: 1500, meal_count: 2 })], WED, CTX)
    expect(cells.every((c) => c.deficit === false)).toBe(true)
  })

  it('la plenitud crece con más señales del día', () => {
    const cells = weekSilhouette(
      [mkSig(MON, { meal_count: 1 }), mkSig(TUE, { meal_count: 1, trained: true })],
      WED,
      CTX,
    )
    const mon = cells.find((c) => c.date === MON)
    const tue = cells.find((c) => c.date === TUE)
    expect((tue?.fullness ?? 0) > (mon?.fullness ?? 0)).toBe(true)
  })
})

describe('weekLever (§8 · palanca de los próximos días)', () => {
  const CTX_CAL = { proteinTarget: 130, calorieTarget: 2000 }
  const SAT = '2026-06-20'

  it('finde con exceso → palanca del finde', () => {
    const signals = [
      mkSig(MON, { calories: 1800, meal_count: 2 }),
      mkSig(TUE, { calories: 1800, meal_count: 2 }),
      mkSig(WED, { calories: 1800, meal_count: 2 }),
      mkSig(SAT, { calories: 2600, meal_count: 3 }),
    ]
    expect(weekLever(signals, SUN, CTX_CAL)?.focus).toContain('finde')
  })

  it('entre semana firme (sin excesos) → palanca de sostener', () => {
    const signals = [
      mkSig(MON, { calories: 1700, meal_count: 2 }),
      mkSig(TUE, { calories: 1700, meal_count: 2 }),
      mkSig(WED, { calories: 1700, meal_count: 2 }),
    ]
    expect(weekLever(signals, WED, CTX_CAL)?.focus).toContain('Entre semana')
  })

  it('sin señal suficiente → null', () => {
    expect(weekLever([mkSig(MON, { meal_count: 1 })], MON, { proteinTarget: 130 })).toBeNull()
  })
})

describe('dimDeficitBridge (§2 · puente hábito↔déficit del panel)', () => {
  const CTX_CAL = { proteinTarget: 130, calorieTarget: 2000 }

  it('proteína: de los días con proteína, cuántos fueron también déficit', () => {
    const signals = [
      mkSig(MON, { protein_g: 140, calories: 1500, meal_count: 2 }),
      mkSig(TUE, { protein_g: 140, calories: 1400, meal_count: 2 }),
      mkSig(WED, { protein_g: 140, calories: 2400, meal_count: 2 }), // proteína sí, déficit no
    ]
    const b = dimDeficitBridge('proteina', signals, WED, CTX_CAL)
    expect(b).toContain('Tu proteína')
    expect(b).toContain('junto a tu déficit')
    expect(b).toContain('2 de 3')
    expect(b).toContain('esta semana')
  })

  it('null para dims que no son de transformación (agua)', () => {
    const signals = [
      mkSig(MON, { water_glasses: 5, calories: 1500 }),
      mkSig(TUE, { water_glasses: 5, calories: 1500 }),
    ]
    expect(dimDeficitBridge('agua', signals, TUE, CTX_CAL)).toBeNull()
  })

  it('null sin meta calórica', () => {
    const signals = [
      mkSig(MON, { protein_g: 140, calories: 1500 }),
      mkSig(TUE, { protein_g: 140, calories: 1500 }),
    ]
    expect(dimDeficitBridge('proteina', signals, TUE, { proteinTarget: 130 })).toBeNull()
  })

  it('null si hay muy poca co-ocurrencia', () => {
    const signals = [mkSig(MON, { protein_g: 140, calories: 2400 })] // proteína pero superávit
    expect(dimDeficitBridge('proteina', signals, MON, CTX_CAL)).toBeNull()
  })
})

describe('risingSignal (Señal Naciente vs. semana pasada)', () => {
  // Semana pasada: lun 2026-06-08 … dom 2026-06-14.
  const lastWeek = (d: number, o: object) => mkSig(`2026-06-${String(8 + d).padStart(2, '0')}`, o)

  it('detecta la dimensión que más creció en la misma ventana', () => {
    const signals = [
      // Semana pasada: agua 1 día.
      lastWeek(0, { water_glasses: 5, meal_count: 1 }),
      // Esta semana: agua 4 días (creció +3).
      mkSig(MON, { water_glasses: 5, meal_count: 1 }),
      mkSig(TUE, { water_glasses: 5 }),
      mkSig(WED, { water_glasses: 5 }),
      mkSig(THU, { water_glasses: 5 }),
    ]
    const r = risingSignal(signals, SUN, CTX)
    expect(r?.key).toBe('agua')
    expect(r?.last).toBe(1)
    expect(r?.current).toBe(4)
  })

  it('compara la MISMA ventana de días transcurridos (no semana completa)', () => {
    // Hoy = martes (2 días): solo cuentan lun+mar de cada semana.
    const signals = [
      lastWeek(0, { meal_count: 1 }), // lun pasado (en ventana) → base de comparación
      lastWeek(4, { trained: true }), // vie pasado: FUERA de la ventana lun-mar → se ignora
      mkSig(MON, { trained: true }),
      mkSig(TUE, { trained: true }), // hoy=mar → movimiento 2 esta semana, 0 en la ventana pasada
    ]
    const r = risingSignal(signals, TUE, CTX)
    expect(r?.key).toBe('movimiento')
    expect(r?.last).toBe(0)
    expect(r?.current).toBe(2)
  })

  it('null sin base de comparación (semana pasada vacía)', () => {
    const signals = [mkSig(MON, { water_glasses: 5 }), mkSig(TUE, { water_glasses: 5 })]
    expect(risingSignal(signals, SUN, CTX)).toBeNull()
  })

  it('null si nada creció lo suficiente (ruido 0→1)', () => {
    const signals = [
      lastWeek(0, { meal_count: 1 }),
      mkSig(MON, { meal_count: 1, water_glasses: 5 }),
    ]
    // comida igual (1 vs 1), agua +1 (0→1) < MIN_RISE.
    expect(risingSignal(signals, SUN, CTX)).toBeNull()
  })
})

describe('buildWeekDimensions', () => {
  it('cuenta días presentes por dimensión, total = días transcurridos', () => {
    // Semana completa (domingo): movimiento 2, comida 3, proteína 2, agua 1.
    const signals = [
      mkSig(MON, { trained: true, meal_count: 3, protein_g: 140, water_glasses: 5 }),
      mkSig(TUE, { meal_count: 2, protein_g: 100 }),
      mkSig(WED, { trained: true, meal_count: 1, protein_g: 130 }),
    ]
    const dims = buildWeekDimensions(signals, SUN, CTX)
    const by = (k: string) => dims.find((d) => d.key === k)!
    expect(dims.map((d) => d.key)).toEqual([...WEEK_DIM_ORDER])
    expect(by('movimiento').present).toBe(2)
    expect(by('comida').present).toBe(3)
    expect(by('proteina').present).toBe(2) // 140 y 130 ≥ 130; 100 no
    expect(by('agua').present).toBe(1)
    expect(by('sueno').present).toBe(0)
    expect(by('comida').total).toBe(7) // domingo → 7 días transcurridos
    expect(by('comida').ratio).toBeCloseTo(3 / 7)
  })

  it('total = días transcurridos a media semana (miércoles → 3)', () => {
    const dims = buildWeekDimensions([mkSig(MON, { meal_count: 1 })], WED, CTX)
    expect(dims[0]!.total).toBe(3)
  })

  it('ignora señales fuera de la semana en curso', () => {
    const lastWeek = '2026-06-08'
    const dims = buildWeekDimensions(
      [mkSig(lastWeek, { trained: true }), mkSig(MON, { trained: true })],
      SUN,
      CTX,
    )
    expect(dims.find((d) => d.key === 'movimiento')?.present).toBe(1)
  })

  it('sin meta de proteína, basta con registrarla', () => {
    const dims = buildWeekDimensions([mkSig(MON, { protein_g: 40 })], SUN, {
      proteinTarget: null,
    })
    expect(dims.find((d) => d.key === 'proteina')?.present).toBe(1)
  })
})

describe('mostRepeated / needsAttention', () => {
  const signals = [
    mkSig(MON, { trained: true, meal_count: 2, water_glasses: 4, protein_g: 140 }),
    mkSig(TUE, { trained: true, meal_count: 2 }),
    mkSig(WED, { meal_count: 2 }),
  ]
  // Conteos: comida 3, movimiento 2, proteína 1, agua 1, sueño 0 (mín. único).
  const dims = buildWeekDimensions(signals, SUN, CTX)

  it('mostRepeated elige la dimensión con más días (comida 3)', () => {
    expect(mostRepeated(dims)?.dim.key).toBe('comida')
    expect(mostRepeated(dims)?.line).toMatch(/comidas/i)
  })

  it('needsAttention elige la de menos días, distinta del tope', () => {
    expect(needsAttention(dims)?.dim.key).toBe('sueno')
  })

  it('mostRepeated es null cuando nada apareció', () => {
    const empty = buildWeekDimensions([], SUN, CTX)
    expect(mostRepeated(empty)).toBeNull()
    expect(needsAttention(empty)).toBeNull()
  })

  it('needsAttention se suprime en semana redonda (todo presente cada día)', () => {
    const perfect = buildWeekDimensions(
      [
        mkSig(MON, {
          trained: true,
          meal_count: 1,
          protein_g: 130,
          water_glasses: 8,
          sleep_minutes: 450,
          energy: 4, // energía también presente → semana redonda en las 6 dims
        }),
      ],
      MON, // lunes: total = 1, y todo presente ese día
      CTX,
    )
    expect(needsAttention(perfect)).toBeNull()
  })
})

describe('buildAppearanceLine', () => {
  it('marca presente / ausente / futuro en orden lunes-primero', () => {
    const signals = [mkSig(MON, { trained: true }), mkSig(WED, { meal_count: 1 })]
    const line = buildAppearanceLine(signals, THU) // hoy = jueves
    expect(line.map((c) => c.letter)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D'])
    expect(line.map((c) => c.state)).toEqual([
      'present', // L
      'absent', // M (martes, sin registro)
      'present', // M (miércoles)
      'absent', // J (hoy, sin registro aún)
      'future', // V
      'future', // S
      'future', // D
    ])
    expect(appearanceCount(line)).toBe(2)
  })
})

describe('buildWeekFindings', () => {
  it('detecta mejor sueño en días de entreno cuando hay margen', () => {
    const signals = [
      mkSig(MON, { trained: true, sleep_minutes: 460 }),
      mkSig(TUE, { trained: true, sleep_minutes: 450 }),
      mkSig(WED, { sleep_minutes: 380 }),
    ]
    const findings = buildWeekFindings(signals, SUN)
    expect(findings.some((f) => f.key === 'trained-sleep')).toBe(true)
  })

  it('no afirma correlación de sueño sin margen suficiente', () => {
    const signals = [
      mkSig(MON, { trained: true, sleep_minutes: 400 }),
      mkSig(TUE, { trained: true, sleep_minutes: 405 }),
      mkSig(WED, { sleep_minutes: 400 }),
    ]
    expect(buildWeekFindings(signals, SUN).some((f) => f.key === 'trained-sleep')).toBe(false)
  })

  it('reporta la mejor racha de comida (consecutiva) y los días que apareciste', () => {
    const signals = [
      mkSig(MON, { meal_count: 2 }),
      mkSig(TUE, { meal_count: 1 }),
      mkSig(WED, { meal_count: 3 }),
      mkSig(FRI, { trained: true }), // gap el jueves corta la racha
    ]
    const findings = buildWeekFindings(signals, SUN)
    const streak = findings.find((f) => f.key === 'meal-streak')
    expect(streak?.text).toMatch(/3 días/)
    const appeared = findings.find((f) => f.key === 'appeared')
    expect(appeared?.text).toMatch(/Estuviste presente 4 días/)
  })

  it('sin datos no inventa hallazgos', () => {
    expect(buildWeekFindings([], SUN)).toEqual([])
  })
})

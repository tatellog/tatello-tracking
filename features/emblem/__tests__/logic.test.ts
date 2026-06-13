import {
  dailyCoachLine,
  EMBLEM_STAGES,
  stageForProgress,
  stageIndexForProgress,
  TRANSFORM_TOTAL_POINTS,
  TRANSFORM_WEIGHTS,
  transformProgressForPoints,
} from '../logic'

const FORBIDDEN = /falta|debes|deberías|atrás|incompleto|atracón|trastorno/i

describe('TRANSFORM_WEIGHTS', () => {
  it('un día perfecto suma 30 puntos', () => {
    const total = Object.values(TRANSFORM_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(30)
  })

  it('entrenar pesa más que cualquier otra fuente individual', () => {
    const { trained, ...rest } = TRANSFORM_WEIGHTS
    for (const v of Object.values(rest)) expect(trained).toBeGreaterThan(v)
  })

  // Los ejemplos canónicos de la regla de negocio: la constelación de A
  // está más llena (12 vs 8 entrenos), pero el Leo de B está más
  // revelado — el emblema es la suma de hábitos, no solo ejercicio.
  it('Usuario A — 12 entrenos y nada más → 120 pts', () => {
    expect(12 * TRANSFORM_WEIGHTS.trained).toBe(120)
  })

  it('Usuario B — 8 entrenos + 20 días de hábitos → 360 pts (más que A)', () => {
    const b =
      8 * TRANSFORM_WEIGHTS.trained +
      20 * TRANSFORM_WEIGHTS.proteinTarget +
      20 * TRANSFORM_WEIGHTS.sleepLogged +
      20 * TRANSFORM_WEIGHTS.energyLogged +
      20 * TRANSFORM_WEIGHTS.dailyCheckin
    expect(b).toBe(360)
    expect(b).toBeGreaterThan(120)
  })
})

describe('transformProgressForPoints', () => {
  it('0 puntos → 0%', () => {
    expect(transformProgressForPoints(0)).toBe(0)
  })

  it('el total exacto → 100%', () => {
    expect(transformProgressForPoints(TRANSFORM_TOTAL_POINTS)).toBe(100)
  })

  it('599/600 → 99% (completo solo cuando se completó de verdad)', () => {
    expect(transformProgressForPoints(599)).toBe(99)
  })

  it('clamp por arriba: los puntos siguen tras el 100%', () => {
    expect(transformProgressForPoints(2400)).toBe(100)
  })

  it('valores basura → 0', () => {
    expect(transformProgressForPoints(-50)).toBe(0)
    expect(transformProgressForPoints(NaN)).toBe(0)
    expect(transformProgressForPoints(Infinity)).toBe(0) // no finito → 0
  })

  it('Usuario B (360 pts) cae en "Se revela"', () => {
    const pct = transformProgressForPoints(360)
    expect(pct).toBe(60)
    expect(stageForProgress(pct).key).toBe('revela')
  })
})

describe('stageForProgress', () => {
  it.each([
    [0, 'despierta'],
    [25, 'despierta'],
    [26, 'forma'],
    [50, 'forma'],
    [51, 'revela'],
    [75, 'revela'],
    [76, 'casi'],
    [99, 'casi'],
    [100, 'completo'],
  ] as const)('%i%% → etapa %s', (pct, key) => {
    expect(stageForProgress(pct).key).toBe(key)
  })

  it('clamp fuera de rango', () => {
    expect(stageForProgress(-10).key).toBe('despierta')
    expect(stageForProgress(140).key).toBe('completo')
  })

  it('las etapas están ordenadas y cubren 0–100', () => {
    expect(EMBLEM_STAGES[0]?.minPct).toBe(0)
    for (let i = 1; i < EMBLEM_STAGES.length; i++) {
      expect(EMBLEM_STAGES[i]!.minPct).toBeGreaterThan(EMBLEM_STAGES[i - 1]!.minPct)
    }
  })

  it('ningún mensaje ni línea del pool castiga ni usa lenguaje clínico', () => {
    for (const s of EMBLEM_STAGES) {
      expect(s.message).not.toMatch(FORBIDDEN)
      for (const line of s.lines) expect(line).not.toMatch(FORBIDDEN)
    }
  })

  it('la canónica (message) es la primera del pool', () => {
    for (const s of EMBLEM_STAGES) expect(s.lines[0]).toBe(s.message)
  })
})

describe('dailyCoachLine', () => {
  it('siempre devuelve una línea del pool de la etapa vigente', () => {
    for (let seed = 0; seed < 10; seed++) {
      const line = dailyCoachLine(60, seed) // "revela"
      expect(stageForProgress(60).lines).toContain(line)
    }
  })

  it('es determinista por día: misma semilla → misma línea', () => {
    expect(dailyCoachLine(40, 12345)).toBe(dailyCoachLine(40, 12345))
  })

  it('rota dentro de la etapa: días consecutivos no repiten en un pool de 3', () => {
    const a = dailyCoachLine(40, 0)
    const b = dailyCoachLine(40, 1)
    expect(a).not.toBe(b)
  })

  it('semilla no finita o negativa cae a una línea válida, sin reventar', () => {
    expect(stageForProgress(40).lines).toContain(dailyCoachLine(40, NaN))
    expect(stageForProgress(40).lines).toContain(dailyCoachLine(40, -7))
  })
})

describe('stageIndexForProgress', () => {
  it('0 absoluto → -1, calma (el despertar requiere el primer hábito)', () => {
    expect(stageIndexForProgress(0)).toBe(-1)
    expect(stageIndexForProgress(-5)).toBe(-1)
    expect(stageIndexForProgress(NaN)).toBe(-1)
  })

  it('el índice es DISCRETO: dentro de una etapa no se mueve', () => {
    expect(stageIndexForProgress(1)).toBe(stageIndexForProgress(25))
    expect(stageIndexForProgress(30)).toBe(stageIndexForProgress(50))
    expect(stageIndexForProgress(60)).toBe(stageIndexForProgress(75))
  })

  it('cruzar etapa sube el índice en 1', () => {
    expect(stageIndexForProgress(1)).toBe(0)
    expect(stageIndexForProgress(26)).toBe(1)
    expect(stageIndexForProgress(51)).toBe(2)
    expect(stageIndexForProgress(76)).toBe(3)
    expect(stageIndexForProgress(100)).toBe(4)
  })

  it('clamp por arriba: más de 100 sigue siendo la última etapa', () => {
    expect(stageIndexForProgress(140)).toBe(4)
  })
})

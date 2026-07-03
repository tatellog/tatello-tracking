import {
  correlationForKind,
  daysInDeficit,
  deficitTrajectoryRead,
  detectMonthPatterns,
  finalPhrase,
  habitReveal,
  monthCalendar,
  monthChange,
  monthDiscoveries,
  monthReveals,
  monthShiftSummary,
  revealDayMap,
  revealFocus,
  monthVerdict,
  presenceSummary,
  proteinAdherence,
  winningCombo,
} from '../month-built'
import { addDays, mkSig, monIdxUTC } from './signals.fixture'

const BASE = '2026-06-01' // lunes

/** n días consecutivos desde BASE, cada uno con el override dado. */
const month = (n: number, o: (i: number) => Parameters<typeof mkSig>[1]) =>
  Array.from({ length: n }, (_, i) => mkSig(addDays(BASE, i), o(i)))

const TARGET = 1800 // meta de calorías de prueba (déficit = [1080, 1800])

describe('daysInDeficit', () => {
  it('cuenta días en déficit sobre días con comida (no días del mes)', () => {
    // 20 días con comida: 12 en déficit (1500), 8 en superávit (2400).
    const signals = month(20, (i) => ({ meal_count: 2, calories: i < 12 ? 1500 : 2400 }))
    const d = daysInDeficit(signals, { calorieTarget: TARGET })!
    expect(d.foodLoggedDays).toBe(20)
    expect(d.deficitDays).toBe(12)
    expect(d.rate).toBeCloseTo(0.6)
    // media de (target − consumo): (12·300 + 8·(−600)) / 20 = −60.
    expect(d.avgDeficitKcal).toBe(-60)
  })

  it('el denominador excluye días sin comida registrada', () => {
    // 10 días presentes (solo entreno), 6 con comida en déficit.
    const signals = month(10, (i) => ({
      trained: true,
      meal_count: i < 6 ? 2 : 0,
      calories: i < 6 ? 1400 : null,
    }))
    const d = daysInDeficit(signals, { calorieTarget: TARGET })!
    expect(d.foodLoggedDays).toBe(6)
    expect(d.deficitDays).toBe(6)
  })

  it('el piso de 60% no celebra restricción extrema', () => {
    // 900 kcal < 0.6·1800 = 1080 → NO cuenta como déficit sano.
    const signals = month(10, () => ({ meal_count: 2, calories: 900 }))
    const d = daysInDeficit(signals, { calorieTarget: TARGET })!
    expect(d.deficitDays).toBe(0)
  })

  it('cuenta los días por encima de la meta ("me pasé")', () => {
    const signals = month(20, (i) => ({ meal_count: 2, calories: i < 12 ? 1500 : 2400 }))
    const d = daysInDeficit(signals, { calorieTarget: TARGET })!
    expect(d.overDays).toBe(8) // 8 días en 2400 > 1800
  })

  it('null sin meta o sin días con comida', () => {
    expect(
      daysInDeficit(
        month(10, () => ({ meal_count: 2, calories: 1400 })),
        {},
      ),
    ).toBeNull()
    expect(
      daysInDeficit(
        month(10, () => ({ trained: true })),
        { calorieTarget: TARGET },
      ),
    ).toBeNull()
  })
})

describe('monthVerdict', () => {
  const verdictFor = (deficitDays: number, food: number) =>
    monthVerdict({
      deficitDays,
      foodLoggedDays: food,
      overDays: food - deficitDays,
      rate: deficitDays / food,
      avgDeficitKcal: 0,
    })

  it('lee de un vistazo si fue buen mes, sin juzgar', () => {
    expect(verdictFor(18, 20)).toMatch(/casi todo el mes/i) // 90%
    expect(verdictFor(12, 20)).toMatch(/más días en déficit/i) // 60%
    expect(verdictFor(8, 20)).toMatch(/parejo/i) // 40%
    expect(verdictFor(2, 20)).toMatch(/mantenimiento/i) // 10%
    // Nunca "mes malo" / culpa.
    expect(verdictFor(2, 20)).not.toMatch(/malo|fracaso|fallaste|mal/i)
  })

  it('null con muy pocos días (la lectura sería ruido)', () => {
    expect(verdictFor(3, 5)).toBeNull()
  })
})

describe('proteinAdherence', () => {
  it('cuenta días que llegaron a la meta de proteína', () => {
    const signals = month(12, (i) => ({ meal_count: 2, protein_g: i < 8 ? 130 : 90 }))
    const p = proteinAdherence(signals, { proteinTarget: 120 })!
    expect(p.hit).toBe(8)
    expect(p.logged).toBe(12)
  })

  it('null sin meta o sin proteína registrada', () => {
    expect(
      proteinAdherence(
        month(10, () => ({ protein_g: 130 })),
        {},
      ),
    ).toBeNull()
    expect(
      proteinAdherence(
        month(10, () => ({ meal_count: 2 })),
        { proteinTarget: 120 },
      ),
    ).toBeNull()
  })
})

describe('revealDayMap (los días concretos por dimensión)', () => {
  it('devuelve las fechas reales que cumplen el criterio simple de cada señal', () => {
    const D = '2026-06-10'
    const sig = [
      mkSig(D, { trained: true, meal_count: 2, calories: 1700, sleep_minutes: 430 }),
      mkSig(addDays(D, 1), { trained: true, meal_count: 2, calories: 1700 }),
      mkSig(addDays(D, 2), { meal_count: 2, calories: 2400 }), // superávit, sin entreno
    ]
    const m = revealDayMap(sig, { calorieTarget: 2000 })
    expect(m.deficit).toEqual([D, addDays(D, 1)])
    expect(m.movimiento).toEqual([D, addDays(D, 1)])
    expect(m.registro).toHaveLength(3)
    expect(m.sueno).toEqual([D])
  })
})

describe('revealFocus (lo más cerca de encender)', () => {
  const it_ = (key: string, count: number) => ({ key, label: key, colorKey: key, count, total: 20 })

  it('elige la pendiente más cerca del umbral (≥ mínimo)', () => {
    const f = revealFocus({ revealed: [], pending: [it_('sueno', 5), it_('agua', 2)] })
    expect(f?.key).toBe('sueno')
    expect(f?.threshold).toBe(8)
  })
  it('el déficit tiene prioridad si califica', () => {
    const f = revealFocus({ revealed: [], pending: [it_('sueno', 6), it_('deficit', 5)] })
    expect(f?.key).toBe('deficit')
  })
  it('null cuando nada está lo bastante cerca (evita presión en día 3)', () => {
    expect(revealFocus({ revealed: [], pending: [it_('agua', 2)] })).toBeNull()
  })
  it('excluye registro (vive en Presencia)', () => {
    expect(revealFocus({ revealed: [], pending: [it_('registro', 6)] })).toBeNull()
  })
})

describe('deficitTrajectoryRead (conclusión + foco del norte)', () => {
  it('creció hacia el final', () => {
    const t = deficitTrajectoryRead([1, 1, 4, 5])
    expect(t.state).toBe('grew')
    expect(t.focusLabel).toBe('Para la próxima')
    expect(t.takeaway).toMatch(/más al final/)
  })
  it('se desvaneció (más al inicio)', () => {
    const t = deficitTrajectoryRead([5, 4, 1, 1])
    expect(t.state).toBe('faded')
    expect(t.takeaway).toMatch(/más al inicio/)
    expect(t.focus).toBeTruthy()
  })
  it('parejo → reencuadre de fortaleza, sin foco-tarea', () => {
    const t = deficitTrajectoryRead([3, 3, 3, 3])
    expect(t.state).toBe('steady')
    expect(t.focusLabel).toBe('Lo que esto dice')
  })
  it('poca data → sin foco, cálido', () => {
    const t = deficitTrajectoryRead([1, 0, 0, 1])
    expect(t.state).toBe('low')
    expect(t.focus).toBeNull()
  })
})

describe('presenceSummary', () => {
  it('cuenta presencia y rachas, separadas de la transformación', () => {
    const p = presenceSummary(month(10, () => ({ meal_count: 2, calories: 1500 })))!
    expect(p.presentDays).toBe(10)
    expect(p.foodDays).toBe(10)
    expect(p.longestStreak).toBe(10)
    expect(p.currentStreak).toBe(10)
  })

  it('un hueco rompe la racha más larga, la actual cuenta desde el último día', () => {
    // Días 0–4 y 6–9 presentes; el 5 ausente (sin fila).
    const signals = month(10, () => ({ trained: true })).filter((_, i) => i !== 5)
    const p = presenceSummary(signals)!
    expect(p.presentDays).toBe(9)
    expect(p.longestStreak).toBe(5) // 0..4
    expect(p.currentStreak).toBe(4) // 6..9 (termina en el último día)
  })

  it('returns = bloques de días consecutivos − 1 (veces que volviste tras una pausa)', () => {
    // Sin huecos → 0 regresos.
    expect(presenceSummary(month(10, () => ({ trained: true })))!.returns).toBe(0)
    // Dos huecos (faltan el 3 y el 7) → 3 bloques → 2 regresos.
    const gapped = month(10, () => ({ trained: true })).filter((_, i) => i !== 3 && i !== 7)
    expect(presenceSummary(gapped)!.returns).toBe(2)
  })

  it('trail = RLE del primer al último día presente (presente/hueco alternados)', () => {
    // Sin huecos: un solo tramo presente.
    expect(presenceSummary(month(10, () => ({ trained: true })))!.trail).toEqual([
      { present: true, length: 10 },
    ])
    // Huecos en el 3 y el 7: presente 0-2, hueco 3, presente 4-6, hueco 7, presente 8-9.
    const gapped = month(10, () => ({ trained: true })).filter((_, i) => i !== 3 && i !== 7)
    expect(presenceSummary(gapped)!.trail).toEqual([
      { present: true, length: 3 },
      { present: false, length: 1 },
      { present: true, length: 3 },
      { present: false, length: 1 },
      { present: true, length: 2 },
    ])
  })

  it('null sin días', () => {
    expect(presenceSummary([])).toBeNull()
  })
})

describe('detectMonthPatterns · descubrimientos (constancias del motor)', () => {
  it('mes apenas formado (<8 días) → sin patrones', () => {
    expect(detectMonthPatterns(month(5, () => ({ meal_count: 2 })))).toEqual([])
  })

  it('consume los patrones POSITIVOS del motor (proteína/movimiento/sueño)', () => {
    const signals = month(16, (i) => ({
      trained: i < 10, // 10 días → training_consistent (≥8)
      protein_g: i < 12 ? 100 : null, // 12 días en meta
      sleep_minutes: i < 9 ? 420 : 300, // 9 noches ≥7h
      meal_count: 2,
    }))
    const ps = detectMonthPatterns(signals, { proteinTarget: 90 })
    expect(ps.find((p) => p.id === 'consistent-training')).toBeTruthy()
    expect(ps.find((p) => p.id === 'consistent-protein')).toBeTruthy()
    expect(ps.find((p) => p.id === 'consistent-sleep')).toBeTruthy()
    const prot = ps.find((p) => p.id === 'consistent-protein')!
    expect(prot.evidence.bars.find((b) => b.label === 'Proteína')?.highlight).toBe(true)
    expect(prot.evidence.bars.find((b) => b.label === 'Proteína')?.value).toBe(12)
  })

  it('el descubrimiento de movimiento trae la evidencia de rachas', () => {
    // 12 entrenos consecutivos desde el día 0 → racha más larga 12.
    const signals = month(16, (i) => ({ trained: i < 12, meal_count: 2 }))
    const train = detectMonthPatterns(signals).find((p) => p.id === 'consistent-training')!
    expect(train.notes?.some((n) => /Continuidad más larga: 12 días/.test(n))).toBe(true)
    // El manifiesto prohíbe el lenguaje de "racha" (presión de streak).
    expect(train.notes?.some((n) => /racha/i.test(n))).toBe(false)
  })

  it('el descubrimiento de sueño trae el promedio de horas dormidas', () => {
    // 12 noches a 450 min (7.5 h) → "Promedio: 7.5 h por noche".
    const signals = month(16, (i) => ({ sleep_minutes: i < 12 ? 450 : null, meal_count: 2 }))
    const sleep = detectMonthPatterns(signals).find((p) => p.id === 'consistent-sleep')!
    expect(sleep.notes?.some((n) => /Promedio: 7\.5 h por noche/.test(n))).toBe(true)
  })

  it('sin meta de proteína, el patrón de proteína no dispara', () => {
    const signals = month(16, () => ({ protein_g: 100, meal_count: 2 }))
    const ps = detectMonthPatterns(signals)
    expect(ps.find((p) => p.id === 'consistent-protein')).toBeUndefined()
  })

  it('todo descubrimiento es una constancia positiva, ninguno una carencia', () => {
    const signals = month(14, (i) => ({
      meal_count: 2,
      sleep_minutes: i < 9 ? 360 : null,
      water_glasses: i < 3 ? 2 : 0,
    }))
    const ps = detectMonthPatterns(signals)
    for (const p of ps.filter((x) => x.kind === 'discovery')) {
      expect(p.title).not.toMatch(/silenciosa|menos|faltó/i)
    }
  })
})

describe('detectMonthPatterns · patrones accionables (correlaciones)', () => {
  it('déficit por tipo de día: fuerte entre semana (déficit L-V, superávit finde)', () => {
    // Lun–vie en déficit (1400), sáb–dom en superávit (2400) → entre semana fuerte.
    const signals = month(14, (i) => {
      const wd = monIdxUTC(addDays(BASE, i))
      return { meal_count: 2, calories: wd < 5 ? 1400 : 2400 }
    })
    const p = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (p) => p.id === 'deficit-daytype',
    )!
    expect(p).toBeTruthy()
    expect(p.kind).toBe('pattern')
    // Veredicto: fortaleza (entre semana) → margen (el fin de semana), sin jerga.
    expect(p.title).toMatch(/Entre semana te sostiene/)
    expect(p.title).toMatch(/fin de semana es donde tienes margen/)
    // La forma por día de semana viaja para la gráfica (7 días) + el lado fuerte.
    expect(p.weekdayShape?.week).toHaveLength(7)
    expect(p.weekdayShape?.strongSide).toBe('weekday')
  })

  it('déficit por tipo de día nombra la FALLA: flaquea entre semana (fuerte el finde)', () => {
    // Inverso: entre semana en superávit (2400), finde en déficit (1400) → entre
    // semana es el lado DÉBIL. La promesa "dónde fallas".
    const signals = month(14, (i) => {
      const wd = monIdxUTC(addDays(BASE, i))
      return { meal_count: 2, calories: wd < 5 ? 2400 : 1400 }
    })
    const p = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (p) => p.id === 'deficit-daytype',
    )!
    expect(p).toBeTruthy()
    // El veredicto nombra el margen (la falla) en llano: entre semana.
    expect(p.title).toMatch(/Entre semana es donde tienes margen/)
  })

  it('superávit concentrado en fin de semana (cuando la tasa de déficit es pareja)', () => {
    // Todos en superávit (tasa de déficit 0 en ambos → no dispara deficit-daytype);
    // el finde concentra el mayor exceso (1900 vs 2800).
    const signals = month(14, (i) => {
      const wd = monIdxUTC(addDays(BASE, i))
      return { meal_count: 2, calories: wd < 5 ? 1900 : 2800 }
    })
    const ps = detectMonthPatterns(signals, { calorieTarget: TARGET })
    expect(ps.some((p) => p.id === 'deficit-daytype')).toBe(false)
    const we = ps.find((p) => p.id === 'surplus-concentration')!
    expect(we).toBeTruthy()
    expect(we.kind).toBe('pattern')
    expect(we.evidence.unit).toBe('kcal')
    expect(we.title).toMatch(/fin de semana/)
  })

  it('sueño ≥7h × déficit cuando el efecto es marcado', () => {
    // 6 días bien dormidos en déficit, 6 mal dormidos en superávit.
    const signals = month(12, (i) => ({
      meal_count: 2,
      sleep_minutes: i < 6 ? 450 : 360,
      calories: i < 6 ? 1400 : 2200,
    }))
    const sd = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (p) => p.id === 'sleep-deficit',
    )!
    expect(sd).toBeTruthy()
    expect(sd.kind).toBe('pattern')
  })

  it('entreno × proteína cuando los días de entreno promedian más proteína', () => {
    const signals = month(12, (i) => ({
      meal_count: 2,
      trained: i % 2 === 0,
      protein_g: i % 2 === 0 ? 150 : 120,
    }))
    const tp = detectMonthPatterns(signals).find((p) => p.id === 'training-protein')!
    expect(tp).toBeTruthy()
    expect(tp.evidence.bars.find((b) => b.label === 'Con entreno')?.value).toBe(150)
    expect(tp.evidence.bars.find((b) => b.label === 'Sin entreno')?.value).toBe(120)
  })

  it('movimiento × déficit cuando el déficit aparece más los días de movimiento', () => {
    // Días de movimiento en déficit (1400); sin movimiento en superávit (2400).
    const signals = month(12, (i) => ({
      meal_count: 2,
      trained: i % 2 === 0,
      calories: i % 2 === 0 ? 1400 : 2400,
    }))
    const p = detectMonthPatterns(signals, { calorieTarget: TARGET }).find(
      (p) => p.id === 'movement-deficit',
    )!
    expect(p).toBeTruthy()
    expect(p.kind).toBe('pattern')
    expect(p.title).toMatch(/entrenaste/)
    // Barras por TASA: con entreno 6/6, sin entreno 0/6.
    expect(p.evidence.bars.find((b) => b.label === 'Con entreno')?.total).toBe(6)
  })

  it('correlationForKind conecta el patrón de constancia con su correlación al déficit', () => {
    const signals = month(12, (i) => ({
      meal_count: 2,
      trained: i % 2 === 0,
      calories: i % 2 === 0 ? 1400 : 2400,
    }))
    const corr = correlationForKind(signals, { calorieTarget: TARGET }, 'training_consistent')
    expect(corr).toBeTruthy()
    expect(corr!.bars.find((b) => b.label === 'Con entreno')?.total).toBe(6)
    expect(corr!.insight).toMatch(/déficit/)
    // Un kind sin correlación mapeada → null (cae a la tira de frecuencia).
    expect(correlationForKind(signals, { calorieTarget: TARGET }, 'protein_consistent')).toBeNull()
  })

  it('NO existe el patrón decorativo "Dormiste más de 7 h en N noches"', () => {
    // Era un conteo sin acción (insight decorativo, prohibido por el doc).
    const signals = month(16, (i) => ({ sleep_minutes: i < 10 ? 440 : 360, meal_count: 2 }))
    expect(detectMonthPatterns(signals).some((p) => p.id === 'sleep-7h')).toBe(false)
  })

  it('todo patrón accionable trae su "lo que te dice" (why = el lever)', () => {
    // Lun–vie en déficit (1400), finde en superávit (2400) → dispara
    // deficit-weekday y weekend-surplus, ambos con why.
    const signals = month(14, (i) => {
      const wd = monIdxUTC(addDays(BASE, i))
      return { meal_count: 2, calories: wd < 5 ? 1400 : 2400 }
    })
    const patterns = detectMonthPatterns(signals, { calorieTarget: TARGET }).filter(
      (p) => p.kind === 'pattern',
    )
    expect(patterns.length).toBeGreaterThan(0)
    for (const p of patterns) expect(p.why && p.why.length > 0).toBeTruthy()
  })
})

describe('habitReveal', () => {
  it('cuenta días por dimensión (sin Energía ni Ciclo), ordenado desc', () => {
    const signals = month(20, (i) => ({
      meal_count: 2, // comida 20
      trained: i < 12, // movimiento 12
      sleep_minutes: i < 15 ? 400 : null, // sueño 15
      protein_g: i < 8 ? 90 : null, // proteína 8
      water_glasses: i < 5 ? 4 : 0, // agua 5
      energy: i < 18 ? 3 : null, // energía: ya NO es dimensión de Mes
      on_period: i < 4 ? true : null, // ciclo: contexto, no hábito
    }))
    const r = habitReveal(signals)
    expect(r.map((h) => h.count)).toEqual([...r.map((h) => h.count)].sort((a, b) => b - a))
    const by = Object.fromEntries(r.map((h) => [h.key, h.count]))
    expect(by.comida).toBe(20)
    expect(by.cuerpo).toBe(12)
    expect(by.sueno).toBe(15)
    expect(by.proteina).toBe(8)
    expect(by.agua).toBe(5)
    // Energía y Ciclo no son dimensiones de presencia en Mes.
    expect(by.energia).toBeUndefined()
    expect(by.ciclo).toBeUndefined()
  })

  it('cubre las 5 dimensiones de presencia (sin energía ni ciclo) aunque estén en cero', () => {
    const r = habitReveal(month(5, () => ({ meal_count: 1 })))
    expect(r).toHaveLength(5)
    expect(r.some((h) => h.key === 'energia')).toBe(false)
    expect(r.some((h) => h.key === 'ciclo')).toBe(false)
    expect(r.find((h) => h.key === 'agua')?.count).toBe(0)
  })
})

describe('winningCombo', () => {
  it('encuentra la fórmula más grande que coincidió y terminó en déficit', () => {
    // 12 días con sueño≥7h + proteína en meta + entrenó; 9 en déficit, 3 superávit.
    const signals = month(12, (i) => ({
      meal_count: 2,
      calories: i < 9 ? 1400 : 2400,
      sleep_minutes: 450,
      protein_g: 140,
      trained: true,
    }))
    const c = winningCombo(signals, { calorieTarget: TARGET, proteinTarget: 130 })!
    expect(c).toBeTruthy()
    expect(c.signals.map((s) => s.key).sort()).toEqual(['cuerpo', 'proteina', 'sueno'])
    expect(c.occurrences).toBe(12)
    expect(c.deficits).toBe(9)
  })

  it('null si la combinación no terminó en déficit la mayoría de las veces', () => {
    // Hábitos presentes pero todos en superávit → no "funcionó".
    const signals = month(10, () => ({
      meal_count: 2,
      calories: 2400,
      sleep_minutes: 450,
      trained: true,
    }))
    expect(winningCombo(signals, { calorieTarget: TARGET })).toBeNull()
  })

  it('null sin meta de calorías', () => {
    const signals = month(10, () => ({
      meal_count: 2,
      calories: 1400,
      trained: true,
      sleep_minutes: 450,
    }))
    expect(winningCombo(signals, {})).toBeNull()
  })
})

describe('monthDiscoveries', () => {
  it('🌙 sueño ≥7h presente en los días en déficit, con su evidencia', () => {
    // 12 días en déficit (1400); 9 con ≥7h de sueño, 3 con menos.
    const signals = month(12, (i) => ({
      meal_count: 2,
      calories: 1400,
      sleep_minutes: i < 9 ? 450 : 360,
    }))
    const d = monthDiscoveries(signals, { calorieTarget: TARGET }).find(
      (x) => x.id === 'sleep-in-deficit',
    )!
    expect(d).toBeTruthy()
    expect(d.icon).toBe('🌙')
    expect(d.title).toMatch(/9 de tus 12 días en déficit/)
  })

  it('📈 segunda mitad con menos días sobre la meta', () => {
    // Días 1-10 en superávit (2400), 16-25 en déficit (1400).
    const signals = month(25, (i) => ({
      meal_count: 2,
      calories: i < 10 ? 2400 : 1400,
    }))
    const d = monthDiscoveries(signals, { calorieTarget: TARGET }).find(
      (x) => x.id === 'second-half',
    )!
    expect(d).toBeTruthy()
    expect(d.title).toMatch(/segunda mitad/i)
  })

  it('comparte a lo sumo 4 hallazgos', () => {
    const signals = month(20, (i) => ({
      meal_count: 2,
      calories: i < 14 ? 1400 : 2400,
      sleep_minutes: 450,
      trained: i % 2 === 0,
      protein_g: i % 2 === 0 ? 150 : 120,
    }))
    expect(
      monthDiscoveries(signals, { calorieTarget: TARGET, proteinTarget: 130 }).length,
    ).toBeLessThanOrEqual(4)
  })
})

describe('monthCalendar', () => {
  // Junio 2026 empieza lunes (leadOffset 0), 30 días. Hoy = día 15.
  const TODAY = '2026-06-15'
  const at = (d: number, o: Parameters<typeof mkSig>[1]) =>
    mkSig(`2026-06-${String(d).padStart(2, '0')}`, o)

  it('clasifica cada día y cuenta el déficit de ESTE mes', () => {
    const signals = [
      ...[1, 2, 3, 4, 5].map((d) => at(d, { meal_count: 2, calories: 1400 })), // déficit
      ...[6, 7, 8].map((d) => at(d, { meal_count: 2, calories: 2400 })), // superávit
      at(9, { meal_count: 1, calories: 900 }), // muy bajo (<60% de 1800)
      // 10..15 sin calorías; 16..30 futuro
    ]
    const cal = monthCalendar(signals, { today: TODAY, calorieTarget: 1800 })!
    expect(cal.leadOffset).toBe(0)
    expect(cal.days).toHaveLength(30)
    expect(cal.deficitDays).toBe(5)
    expect(cal.dataDays).toBe(9) // 5 déficit + 3 superávit + 1 bajo
    expect(cal.hasLow).toBe(true)
    expect(cal.days[0]!.status).toBe('deficit')
    expect(cal.days[5]!.status).toBe('surplus')
    expect(cal.days[8]!.status).toBe('low')
    expect(cal.days[9]!.status).toBe('none') // día 10 sin datos
    expect(cal.days[14]!.isToday).toBe(true) // día 15 = hoy
    expect(cal.days[13]!.isToday).toBe(false)
    expect(cal.days[20]!.future).toBe(true) // día 21 aún por venir
    expect(cal.days[20]!.status).toBe('none')
  })

  it('null sin meta de calorías o sin un solo día con comida', () => {
    const signals = [at(1, { meal_count: 2, calories: 1400 })]
    expect(monthCalendar(signals, { today: TODAY })).toBeNull()
    expect(
      monthCalendar([at(1, { trained: true })], { today: TODAY, calorieTarget: 1800 }),
    ).toBeNull()
  })
})

describe('monthShiftSummary', () => {
  const cat = (key: string, w1: number, w4: number) => ({
    key,
    label: key,
    colorKey: key,
    weeks: [
      { week: 1, count: w1, registered: w1, total: 7, weekEnd: '2026-06-07' },
      { week: 2, count: 0, registered: 0, total: 7, weekEnd: '2026-06-14' },
      { week: 3, count: 0, registered: 0, total: 7, weekEnd: '2026-06-21' },
      { week: 4, count: w4, registered: w4, total: 7, weekEnd: '2026-06-28' },
    ],
    conclusion: '',
    improved: w4 > w1,
  })

  it('nombra las dimensiones que más subieron (semana 1 → 4)', () => {
    const s = monthShiftSummary([cat('deficit', 2, 6), cat('sueno', 1, 5), cat('agua', 4, 4)])!
    expect(s).toMatch(/Al final del mes aparecieron/)
    expect(s).toMatch(/más días en déficit/)
    expect(s).toMatch(/buen sueño/)
  })

  it('parejo cuando nada subió de forma marcada', () => {
    expect(monthShiftSummary([cat('deficit', 3, 3), cat('agua', 4, 4)])).toMatch(/parejo/i)
  })

  it('si el déficit (norte) BAJÓ, lo nombra y no lo esconde', () => {
    // déficit cae 6→2; aunque la proteína suba, el cierre NO celebra solo eso.
    const s = monthShiftSummary([cat('deficit', 6, 2), cat('proteina', 0, 3)])!
    expect(s).toMatch(/déficit/i)
    expect(s).toMatch(/al inicio/i)
    expect(s).not.toMatch(/^Al final del mes aparecieron/)
    // reconoce lo que emergió, sin usarlo para tapar la caída.
    expect(s).toMatch(/proteína/i)
  })

  it('déficit que baja solo (sin nada que suba) se nombra sin compensar', () => {
    const s = monthShiftSummary([cat('deficit', 6, 2), cat('agua', 4, 4)])!
    expect(s).toMatch(/déficit/i)
    expect(s).not.toMatch(/emergieron/i)
  })

  it('null sin categorías', () => {
    expect(monthShiftSummary([])).toBeNull()
  })
})

describe('monthReveals', () => {
  it('separa lo revelado (★) de lo pendiente (○) con las frases correctas', () => {
    // 16 días: déficit ≥8, registro ≥8, sueño estable ≥8; sin proteína/agua/movimiento.
    const signals = month(16, (i) => ({
      meal_count: 2,
      calories: 1400, // 16 días en déficit
      sleep_minutes: i < 12 ? 420 : null, // sueño estable
    }))
    const r = monthReveals(signals, { calorieTarget: 1800 })
    const revealedKeys = r.revealed.map((x) => x.key)
    expect(revealedKeys).toContain('deficit')
    expect(revealedKeys).toContain('registro')
    expect(revealedKeys).toContain('sueno')
    expect(r.revealed.find((x) => x.key === 'deficit')?.label).toBe('Déficit constante')
    const pendingKeys = r.pending.map((x) => x.key)
    expect(pendingKeys).toContain('proteina')
    expect(pendingKeys).toContain('agua')
    expect(pendingKeys).toContain('movimiento')
    expect(r.pending.find((x) => x.key === 'agua')?.label).toBe('Agua')
  })

  it('sin meta de calorías, el déficit no puede revelarse (cae en pendiente)', () => {
    const signals = month(16, () => ({ meal_count: 2, calories: 1400 }))
    const r = monthReveals(signals, {})
    expect(r.pending.map((x) => x.key)).toContain('deficit')
    expect(r.revealed.map((x) => x.key)).not.toContain('deficit')
  })

  it('siempre cubre las 6 dimensiones entre reveladas y pendientes', () => {
    const r = monthReveals(
      month(3, () => ({ meal_count: 1 })),
      {},
    )
    expect(r.revealed.length + r.pending.length).toBe(6)
  })
})

describe('monthChange', () => {
  const TODAY = '2026-06-28'
  // 28 días que terminan hoy, con `perWeek[w]` días "buenos" en cada semana
  // (semana 1 = la más antigua). `mark` aplica el override de un día bueno/malo.
  const buildWeeks = (
    perWeek: [number, number, number, number],
    mark: (good: boolean) => Parameters<typeof mkSig>[1],
  ) =>
    Array.from({ length: 28 }, (_, off) => {
      const week = 4 - Math.floor(off / 7) // 1..4
      const good = off % 7 < perWeek[week - 1]!
      return mkSig(addDays(TODAY, -off), mark(good))
    })

  it('déficit que sube: conclusión de avance, anclada a la semana del cambio', () => {
    const signals = buildWeeks([1, 3, 5, 6], (good) => ({
      meal_count: 2,
      calories: good ? 1400 : 2400,
    }))
    const cats = monthChange(signals, { today: TODAY, calorieTarget: 1800 })
    const def = cats.find((c) => c.key === 'deficit')!
    expect(def).toBeTruthy()
    expect(def.weeks.map((w) => w.count)).toEqual([1, 3, 5, 6])
    expect(def.weeks[0]!.total).toBe(7)
    expect(def.improved).toBe(true)
    expect(def.conclusion).toMatch(/segunda semana/i) // el salto fue en la semana 2
  })

  it('registered = días registrados, no 7 fijos ("no registré" ≠ "no logré")', () => {
    // Semana más reciente (off 0..6): 3 días con comida (2 en déficit), 4 sin comida.
    const signals = Array.from({ length: 7 }, (_, off) => {
      const hasFood = off < 3
      const inDeficit = off < 2
      return mkSig(
        addDays(TODAY, -off),
        hasFood ? { meal_count: 2, calories: inDeficit ? 1400 : 2400 } : { trained: true },
      )
    })
    const def = monthChange(signals, { today: TODAY, calorieTarget: 1800 }).find(
      (c) => c.key === 'deficit',
    )!
    const w4 = def.weeks[3]! // la semana más reciente
    expect(w4.count).toBe(2) // 2 días en déficit
    expect(w4.registered).toBe(3) // 3 días con comida (no 7) → 4 días sin registro NO cuentan
    expect(w4.total).toBe(7)
  })

  it('sin meta de calorías, déficit NO aparece como categoría', () => {
    const signals = buildWeeks([1, 3, 5, 6], (good) => ({
      meal_count: 2,
      calories: good ? 1400 : 2400,
    }))
    expect(monthChange(signals, { today: TODAY }).some((c) => c.key === 'deficit')).toBe(false)
  })

  it('una semana pico → "tu mejor semana fue la …"', () => {
    const signals = buildWeeks([2, 2, 6, 2], (good) => ({ trained: good }))
    const train = monthChange(signals, { today: TODAY }).find((c) => c.key === 'entreno')!
    expect(train.weeks.map((w) => w.count)).toEqual([2, 2, 6, 2])
    expect(train.conclusion).toMatch(/tercera semana fue la más consistente/i)
    expect(train.improved).toBe(true)
    // Nunca "mejor" (califica las demás como peores) ni "racha".
    expect(train.conclusion).not.toMatch(/mejor|racha/i)
  })

  it('mes parejo → "se mantuvo parejo", sin avance', () => {
    const signals = buildWeeks([4, 4, 4, 4], (good) => ({ trained: good }))
    const train = monthChange(signals, { today: TODAY }).find((c) => c.key === 'entreno')!
    expect(train.conclusion).toMatch(/parejo/i)
    expect(train.improved).toBe(false)
  })

  it('muy pocos datos → "aún hay poco con qué comparar"', () => {
    const signals = buildWeeks([0, 1, 0, 1], (good) => ({ trained: good }))
    const train = monthChange(signals, { today: TODAY }).find((c) => c.key === 'entreno')!
    expect(train.conclusion).toMatch(/poco con qué comparar/i)
    expect(train.improved).toBe(false)
  })

  it('una categoría sin un solo buen día se omite', () => {
    const signals = buildWeeks([0, 0, 0, 0], (good) => ({ trained: good, meal_count: 1 }))
    expect(monthChange(signals, { today: TODAY }).some((c) => c.key === 'entreno')).toBe(false)
  })
})

describe('finalPhrase', () => {
  it('escala la frase con los días presentes y todas se sostienen con datos', () => {
    expect(finalPhrase(month(20, () => ({ meal_count: 1 })))).toMatch(/constancia/i)
    expect(finalPhrase(month(12, () => ({ meal_count: 1 })))).toMatch(/repetiste/i)
    expect(finalPhrase(month(4, () => ({ meal_count: 1 })))).toMatch(/evidencia/i)
  })

  it('null sin días', () => {
    expect(finalPhrase([])).toBeNull()
  })
})

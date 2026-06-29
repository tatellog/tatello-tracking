import { buildDayState, selectDayStateKey, signalStrengths } from '../day-state'
import { mkSig } from './signals.fixture'

const DAY = '2026-06-28'
// Metas para resolver "déficit logrado" / "proteína cumplida".
const CTX = { proteinTarget: 120, calorieTarget: 1500, waterGoalGlasses: 8 }

const stars = (s: ReturnType<typeof mkSig>, ctx = CTX) =>
  Object.fromEntries(signalStrengths(s, ctx).map((x) => [x.key, x.stars]))

describe('selectDayStateKey — los 7 estados', () => {
  it('null cuando no hubo ningún registro', () => {
    expect(selectDayStateKey(mkSig(DAY, {}), CTX)).toBeNull()
    expect(buildDayState(mkSig(DAY, {}), CTX)).toBeNull()
  })

  it('Presencia: registró ≥1 pero ninguna señal llegó a ★★★', () => {
    const s = mkSig(DAY, { meal_count: 1, water_glasses: 1 })
    const st = stars(s)
    expect(Math.max(...Object.values(st))).toBeLessThan(3)
    expect(selectDayStateKey(s, CTX)).toBe('presencia')
  })

  it('Constancia: ≥4 señales presentes (continuidad)', () => {
    const s = mkSig(DAY, {
      trained: true, // movimiento
      sleep_minutes: 420, // recuperación
      meal_count: 2, // nutrición
      water_glasses: 8, // agua
    })
    expect(signalStrengths(s, CTX).filter((x) => x.present).length).toBeGreaterThanOrEqual(4)
    expect(selectDayStateKey(s, CTX)).toBe('constancia')
  })

  it('Energía: el movimiento domina (entrenó, nada más)', () => {
    expect(selectDayStateKey(mkSig(DAY, { trained: true }), CTX)).toBe('energia')
  })

  it('Recuperación: el descanso domina (durmió bien + descansó)', () => {
    const s = mkSig(DAY, { sleep_minutes: 480, rested: true })
    expect(stars(s).recuperacion).toBe(5)
    expect(selectDayStateKey(s, CTX)).toBe('recuperacion')
  })

  it('Nutrición: la comida domina (3 comidas + proteína + déficit)', () => {
    const s = mkSig(DAY, { meal_count: 3, protein_g: 130, calories: 1300 })
    expect(stars(s).nutricion).toBe(5)
    expect(selectDayStateKey(s, CTX)).toBe('nutricion')
  })

  it('Equilibrio: dos señales parejas en ★★★, nada dominó', () => {
    const s = mkSig(DAY, { sleep_minutes: 390, meal_count: 3, protein_g: 90 })
    const st = stars(s)
    expect(st.recuperacion).toBe(3)
    expect(st.nutricion).toBe(3)
    expect(selectDayStateKey(s, CTX)).toBe('equilibrio')
  })

  it('NUNCA celebra restricción extrema como déficit (línea roja)', () => {
    // 617 / 1463 kcal = 42% de la meta → no es evidencia ni suma ★.
    const extreme = mkSig(DAY, { meal_count: 1, calories: 617 })
    expect(buildDayState(extreme, CTX)!.evidence.map((e) => e.label)).not.toContain(
      'Tu déficit del día',
    )
    // Un déficit sano (≥60% de la meta) SÍ cuenta.
    const sane = mkSig(DAY, { meal_count: 1, calories: 1100 })
    expect(buildDayState(sane, CTX)!.evidence.map((e) => e.label)).toContain('Tu déficit del día')
  })

  it('Exploración: lo más fuerte fueron señales suaves (check-in completo)', () => {
    const s = mkSig(DAY, { energy: 4, mood: 'good', motivation: 4, stress: 2 })
    expect(stars(s).bienestar).toBe(5)
    expect(selectDayStateKey(s, CTX)).toBe('exploracion')
  })
})

describe('buildDayState — ensamblado', () => {
  it('evidencia y ausencias salen sólo de lo registrado', () => {
    const s = mkSig(DAY, { trained: true, sleep_minutes: 468, meal_count: 3, energy: 4 })
    const day = buildDayState(s, CTX)!
    expect(day.key).toBe('constancia')
    // Evidencia presente
    const labels = day.evidence.map((e) => e.label)
    expect(labels).toContain('Entrenaste')
    expect(labels).toContain('Dormiste')
    expect(labels).toContain('Registraste tus comidas')
    expect(day.evidence.find((e) => e.label === 'Dormiste')?.detail).toMatch(/7\.8 horas/)
    // Ausencias: sólo señales DIARIAS. Agua sin registro aparece; sueño no (se
    // registró). El ciclo NUNCA aparece como ausencia diaria (no es señal diaria).
    const absent = day.absent.map((a) => a.key)
    expect(absent).toContain('agua')
    expect(absent).not.toContain('ciclo')
    expect(absent).not.toContain('sueno')
    // Transparencia: fuerzas ordenadas desc, sueño arriba
    expect(day.strengths[0]!.stars).toBeGreaterThanOrEqual(day.strengths[1]!.stars)
    // Cierre estable
    expect(day.closing.length).toBeGreaterThan(0)
  })

  it('driver = la señal que CAUSÓ el estado; null si nace de amplitud/paridad', () => {
    // Estados de una sola señal → driver = esa señal (se resalta al explicar).
    expect(buildDayState(mkSig(DAY, { trained: true }), CTX)!.driver).toBe('movimiento')
    expect(buildDayState(mkSig(DAY, { sleep_minutes: 480, rested: true }), CTX)!.driver).toBe(
      'recuperacion',
    )
    expect(
      buildDayState(mkSig(DAY, { meal_count: 3, protein_g: 130, calories: 1300 }), CTX)!.driver,
    ).toBe('nutricion')
    expect(
      buildDayState(mkSig(DAY, { energy: 4, mood: 'good', motivation: 4, stress: 2 }), CTX)!.driver,
    ).toBe('bienestar')
    // Amplitud/paridad/sólo-registro → sin solista (no se resalta ninguna barra).
    const constancia = mkSig(DAY, {
      trained: true,
      sleep_minutes: 420,
      meal_count: 2,
      water_glasses: 8,
    })
    expect(buildDayState(constancia, CTX)!.driver).toBeNull()
    const equilibrio = mkSig(DAY, { sleep_minutes: 390, meal_count: 3, protein_g: 90 })
    expect(buildDayState(equilibrio, CTX)!.driver).toBeNull()
    expect(buildDayState(mkSig(DAY, { meal_count: 1, water_glasses: 1 }), CTX)!.driver).toBeNull()
  })

  it('la evidencia de bienestar/descanso muestra el dato real, no un verbo vacío', () => {
    // Bienestar: el label dice cómo te sentiste; el detalle resume lo demás.
    const w = buildDayState(mkSig(DAY, { mood: 'good', energy: 4, stress: 2 }), CTX)!
    const wb = w.evidence.find((e) => e.label.startsWith('Te sentiste'))!
    expect(wb.label).toBe('Te sentiste bien')
    expect(wb.detail).toBe('Energía alta · calma alta')
    // Descanso: label claro + qué alimenta (sin inventar cifra).
    const r = buildDayState(mkSig(DAY, { rested: true, water_glasses: 2 }), CTX)!
    const rest = r.evidence.find((e) => e.label === 'Día de descanso')!
    expect(rest.detail).toBe('Recuperación')
  })

  it('título nunca etiqueta a la persona ("predominó", no "eres/fuiste")', () => {
    const keys = ['energia', 'recuperacion', 'nutricion', 'presencia'] as const
    const samples = {
      energia: mkSig(DAY, { trained: true }),
      recuperacion: mkSig(DAY, { sleep_minutes: 480, rested: true }),
      nutricion: mkSig(DAY, { meal_count: 3, protein_g: 130, calories: 1300 }),
      presencia: mkSig(DAY, { meal_count: 1, water_glasses: 1 }),
    }
    for (const k of keys) {
      const day = buildDayState(samples[k], CTX)!
      expect(day.key).toBe(k)
      expect(day.title.toLowerCase()).toMatch(/predominó/)
      expect(day.title.toLowerCase()).not.toMatch(/eres|fuiste disciplinad/)
    }
  })
})

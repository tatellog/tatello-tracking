import { addDays, mkSig } from '../../orbit/__tests__/signals.fixture'
import {
  formatMinutes,
  movementWeek,
  todayWorkout,
  trainingDeficitBridge,
} from '../workout-insights'

const TZ = 'America/Mexico_City'
const TODAY = '2026-09-30' // miércoles

// Sesión a las 12:00 locales (18:00 UTC) del día dado.
const w = (day: string, type: string, min: number, kcal = 200) => ({
  external_id: `${day}-${type}-${min}`,
  activity: null,
  started_at: `${day}T18:00:00Z`,
  ended_at: `${day}T19:00:00Z`,
  workout_type: type,
  duration_min: min,
  energy_kcal: kcal,
})

describe('todayWorkout', () => {
  it('sin entreno hoy no hay hero', () => {
    expect(todayWorkout([w('2026-09-29', 'fuerza', 40)], TODAY, TZ)).toBeNull()
  })

  it('compara contra TU promedio de ese tipo, sin contar hoy', () => {
    const t = todayWorkout(
      [
        w('2026-09-20', 'fuerza', 40),
        w('2026-09-23', 'fuerza', 50),
        w('2026-09-27', 'fuerza', 45),
        w('2026-09-28', 'cardio', 90),
        w(TODAY, 'fuerza', 60, 279),
      ],
      TODAY,
      TZ,
    )!
    expect(t).toMatchObject({ type: 'fuerza', name: 'Fuerza', totalMinutes: 60, kcal: 279 })
    expect(t.average).toBe(45)
  })

  it('con menos de 3 sesiones previas no hay promedio ni marca', () => {
    const t = todayWorkout([w('2026-09-27', 'fuerza', 30), w(TODAY, 'fuerza', 60)], TODAY, TZ)!
    expect(t.average).toBeNull()
    expect(t.record).toBeNull()
  })

  it('marca personal: la más larga en N semanas', () => {
    const t = todayWorkout(
      [
        w('2026-08-05', 'fuerza', 70),
        w('2026-09-02', 'fuerza', 40),
        w('2026-09-16', 'fuerza', 45),
        w('2026-09-23', 'fuerza', 50),
        w(TODAY, 'fuerza', 60),
      ],
      TODAY,
      TZ,
    )!
    expect(t.record).toBe('Tu sesión de fuerza más larga en 8 semanas')
  })

  it('varios entrenos: suma el día, el principal es el más largo', () => {
    const t = todayWorkout([w(TODAY, 'cardio', 20), w(TODAY, 'fuerza', 45)], TODAY, TZ)!
    expect(t).toMatchObject({ type: 'fuerza', totalMinutes: 65, sessions: 2 })
  })
})

describe('movementWeek', () => {
  const ws = [
    w('2026-09-28', 'fuerza', 50), // lunes
    w(TODAY, 'cardio', 30), // miércoles
    // 4 semanas anteriores: 2, 3, 2, 3 sesiones
    ...['2026-09-22', '2026-09-24'].map((d) => w(d, 'fuerza', 40)),
    ...['2026-09-15', '2026-09-16', '2026-09-18'].map((d) => w(d, 'fuerza', 40)),
    ...['2026-09-08', '2026-09-10'].map((d) => w(d, 'fuerza', 40)),
    ...['2026-09-01', '2026-09-02', '2026-09-04'].map((d) => w(d, 'cardio', 40)),
  ]
  const week = movementWeek(ws, TODAY, TZ)

  it('siete días de lunes a domingo, hoy marcado y el futuro aparte', () => {
    expect(week.days.map((d) => d.initial).join('')).toBe('LMXJVSD')
    expect(week.days[2]).toMatchObject({ day: TODAY, isToday: true, minutes: 30, type: 'cardio' })
    expect(week.days[1]).toMatchObject({ minutes: 0, type: null })
    expect(week.days[3]!.isFuture).toBe(true)
  })

  it('cuenta la semana y su mezcla, sin racha', () => {
    expect(week).toMatchObject({ sessions: 2, strength: 1, totalMinutes: 80 })
  })

  it('tu ritmo sale de tus 4 semanas anteriores', () => {
    expect(week.rhythm).toBe('2 a 3 por semana')
  })
})

describe('trainingDeficitBridge', () => {
  const TARGET = 1800
  // 20 días: entrenados con fuerza → déficit; sin entreno → arriba de la meta.
  const signals = Array.from({ length: 20 }, (_, i) => {
    const day = addDays('2026-09-01', i)
    return i % 2 === 0
      ? mkSig(day, { trained: true, workout_type: 'fuerza', calories: 1500 })
      : mkSig(day, { trained: false, calories: i % 4 === 1 ? 1500 : 2200 })
  })

  it('nombra la fuerza cuando la evidencia la sostiene', () => {
    expect(trainingDeficitBridge(signals, TARGET, 'fuerza')).toBe(
      'Tus días con fuerza cierras en déficit más seguido.',
    )
  })

  it('sin foco de fuerza habla del entreno en general', () => {
    expect(trainingDeficitBridge(signals, TARGET, 'cardio')).toBe(
      'Los días que entrenas cierras en déficit más seguido.',
    )
  })

  it('sin meta, sin muestra o sin diferencia, no dice nada', () => {
    expect(trainingDeficitBridge(signals, null, 'fuerza')).toBeNull()
    expect(trainingDeficitBridge(signals.slice(0, 5), TARGET, 'fuerza')).toBeNull()
    const flat = signals.map((s) => ({ ...s, calories: 1500 }))
    expect(trainingDeficitBridge(flat, TARGET, 'fuerza')).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('formatea en horas y minutos', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(160)).toBe('2 h 40')
    expect(formatMinutes(120)).toBe('2 h')
  })
})

describe('sin duplicados', () => {
  it('el mismo entreno con IDs distintos (Garmin lo reescribe) cuenta una vez', () => {
    const dup = (id: string) => ({ ...w(TODAY, 'fuerza', 54, 270), external_id: id })
    const t = todayWorkout([dup('a'), dup('b'), dup('c'), w(TODAY, 'cardio', 21, 172)], TODAY, TZ)!
    expect(t.list).toHaveLength(2)
    expect(t.totalMinutes).toBe(75)
    expect(t.kcal).toBe(442)
    const week = movementWeek([dup('a'), dup('b'), dup('c')], TODAY, TZ)
    expect(week.sessions).toBe(1)
    expect(week.totalMinutes).toBe(54)
  })
})

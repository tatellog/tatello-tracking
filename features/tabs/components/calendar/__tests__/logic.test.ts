import {
  buildCalendarDays,
  dayNumOf,
  weekdayIdxOf,
  type BuildCalendarDaysArgs,
  type CalendarEvent,
  type DaySignal,
} from '../logic'

const TODAY = '2026-06-14' // domingo
const base = (over: Partial<BuildCalendarDaysArgs> = {}): BuildCalendarDaysArgs => ({
  today: TODAY,
  span: 7,
  trainedDates: [],
  signalsByDay: {},
  eventsByDay: {},
  todayWorkoutCompleted: false,
  ...over,
})

const dayOf = (days: ReturnType<typeof buildCalendarDays>, date: string) =>
  days.find((d) => d.date === date)!

describe('buildCalendarDays · scaffolding', () => {
  test('devuelve `span` días, oldest-first, terminando en hoy', () => {
    const days = buildCalendarDays(base())
    expect(days).toHaveLength(7)
    expect(days[0]!.date).toBe('2026-06-08')
    expect(days[6]!.date).toBe(TODAY)
    expect(days[6]!.isToday).toBe(true)
  })

  test('dayNum y weekdayIdx correctos (14 jun 2026 = domingo)', () => {
    expect(dayNumOf(TODAY)).toBe(14)
    expect(weekdayIdxOf(TODAY)).toBe(0)
  })
})

describe('buildCalendarDays · status', () => {
  test('día entrenado → trained', () => {
    const days = buildCalendarDays(base({ trainedDates: ['2026-06-10'] }))
    expect(dayOf(days, '2026-06-10').status).toBe('trained')
  })

  test('día con rested (y sin entreno) → rested', () => {
    const days = buildCalendarDays(base({ signalsByDay: { '2026-06-11': { rested: true } } }))
    expect(dayOf(days, '2026-06-11').status).toBe('rested')
  })

  test('sin nada → empty', () => {
    expect(dayOf(buildCalendarDays(base()), '2026-06-09').status).toBe('empty')
  })

  test('trained tiene precedencia sobre rested (estrella ≡ constelación)', () => {
    const days = buildCalendarDays(
      base({ trainedDates: ['2026-06-12'], signalsByDay: { '2026-06-12': { rested: true } } }),
    )
    expect(dayOf(days, '2026-06-12').status).toBe('trained')
  })

  test('hoy se fuerza a trained si todayWorkoutCompleted aunque no esté en workouts', () => {
    const days = buildCalendarDays(base({ todayWorkoutCompleted: true }))
    expect(dayOf(days, TODAY).status).toBe('trained')
  })

  test('override local optimista gana sobre todo', () => {
    const days = buildCalendarDays(
      base({ trainedDates: ['2026-06-10'], overrides: { '2026-06-10': 'rested' } }),
    )
    expect(dayOf(days, '2026-06-10').status).toBe('rested')
  })
})

describe('buildCalendarDays · registered (presencia, no valores)', () => {
  test('mapea cada dimensión por presencia', () => {
    const sig: DaySignal = {
      meal_count: 2,
      water_glasses: 5,
      sleep_minutes: 420,
      energy: 4,
      weight_kg: 60,
      on_period: true,
    }
    const r = dayOf(
      buildCalendarDays(base({ signalsByDay: { '2026-06-13': sig } })),
      '2026-06-13',
    ).registered
    expect(r).toEqual({
      comida: true,
      agua: true,
      sueno: true,
      energia: true,
      peso: true,
      ciclo: true,
    })
  })

  test('meal_count 0 y water 0 NO cuentan como registro', () => {
    const r = dayOf(
      buildCalendarDays(
        base({ signalsByDay: { '2026-06-13': { meal_count: 0, water_glasses: 0 } } }),
      ),
      '2026-06-13',
    ).registered
    expect(r.comida).toBe(false)
    expect(r.agua).toBe(false)
  })

  test('on_period false → ciclo false', () => {
    const r = dayOf(
      buildCalendarDays(base({ signalsByDay: { '2026-06-13': { on_period: false } } })),
      '2026-06-13',
    ).registered
    expect(r.ciclo).toBe(false)
  })

  test('sin señales → todo false', () => {
    expect(dayOf(buildCalendarDays(base()), '2026-06-09').registered).toEqual({
      comida: false,
      agua: false,
      sueno: false,
      energia: false,
      peso: false,
      ciclo: false,
    })
  })
})

describe('buildCalendarDays · events', () => {
  test('adjunta eventos del día; vacío si no hay', () => {
    const ev: CalendarEvent[] = [
      { id: 'a', title: 'Leo despertó' },
      { id: 'b', title: 'Volviste después de una pausa' },
    ]
    const days = buildCalendarDays(base({ eventsByDay: { '2026-06-12': ev } }))
    expect(dayOf(days, '2026-06-12').events).toHaveLength(2)
    expect(dayOf(days, '2026-06-12').events[0]!.title).toBe('Leo despertó')
    expect(dayOf(days, '2026-06-11').events).toEqual([])
  })
})

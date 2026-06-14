/*
 * Lógica PURA del calendario de Hoy (el "editor oficial de la constelación").
 * Fusiona tres fuentes —días entrenados (workouts), señales del día
 * (daily_signals) y revelaciones (eventos)— en un arreglo de días listo para
 * pintar. Sin side effects, sin hooks: testeable en jest.
 *
 * Regla de negocio: la constelación se llena SOLO con `trained`. Por eso el
 * status `trained` tiene precedencia sobre `rested` — la estrella del strip y
 * la constelación nunca discrepan. `rested` es válido pero no enciende estrella.
 */

import { buildTrailingDays } from '../constellation/data/month-grid'

export type DayStatus = 'empty' | 'trained' | 'rested'

/** Presencia (no valores) de cada dimensión registrada ese día. El panel
 *  responde "¿qué pasó?" con checks, nunca con métricas (kcal/gramos/horas). */
export type DayRegistered = {
  comida: boolean
  agua: boolean
  sueno: boolean
  energia: boolean
  peso: boolean
  ciclo: boolean
}

export type CalendarEvent = { id: string; title: string }

export type CalendarDay = {
  /** ISO 'YYYY-MM-DD'. */
  date: string
  dayNum: number
  /** 0..6 (0=Dom) — letra inicial del día. */
  weekdayIdx: number
  isToday: boolean
  status: DayStatus
  registered: DayRegistered
  /** [] si no hubo eventos ese día. */
  events: CalendarEvent[]
}

/** Subconjunto de daily_signals que el calendario necesita por día. */
export type DaySignal = {
  rested?: boolean | null
  meal_count?: number | null
  water_glasses?: number | null
  sleep_minutes?: number | null
  energy?: number | null
  weight_kg?: number | null
  on_period?: boolean | null
}

export type BuildCalendarDaysArgs = {
  /** Hoy en zona local, 'YYYY-MM-DD'. */
  today: string
  span: number
  /** Fechas con entrenamiento (de la tabla workouts). */
  trainedDates: readonly string[]
  /** daily_signals indexado por fecha. */
  signalsByDay: Readonly<Record<string, DaySignal>>
  /** Eventos (revelaciones) indexados por fecha local. */
  eventsByDay: Readonly<Record<string, CalendarEvent[]>>
  /** Hoy se trata como entrenado aunque aún no esté en `trainedDates`
   *  (espejo del optimismo del toggle principal). */
  todayWorkoutCompleted: boolean
  /** Override local optimista por fecha (acción del calendario en curso). */
  overrides?: Readonly<Record<string, DayStatus>>
}

/** Día de la semana local (0=Dom) de una fecha 'YYYY-MM-DD'. Evita el drift
 *  de medianoche UTC al oeste de UTC que mete `new Date('YYYY-MM-DD')`. */
export function weekdayIdxOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

export function dayNumOf(iso: string): number {
  return Number(iso.split('-')[2]) || 1
}

function registeredFor(sig: DaySignal | undefined): DayRegistered {
  return {
    comida: (sig?.meal_count ?? 0) > 0,
    agua: (sig?.water_glasses ?? 0) > 0,
    sueno: sig?.sleep_minutes != null,
    energia: sig?.energy != null,
    peso: sig?.weight_kg != null,
    ciclo: sig?.on_period === true,
  }
}

export function buildCalendarDays(args: BuildCalendarDaysArgs): CalendarDay[] {
  const { today, span, trainedDates, signalsByDay, eventsByDay, todayWorkoutCompleted, overrides } =
    args

  const cells = buildTrailingDays(today, trainedDates, span)

  return cells.map((cell) => {
    const sig = signalsByDay[cell.date]
    const trained = cell.trained || (cell.isToday && todayWorkoutCompleted)

    // Precedencia: override local > trained > rested > empty.
    let status: DayStatus
    const override = overrides?.[cell.date]
    if (override) {
      status = override
    } else if (trained) {
      status = 'trained'
    } else if (sig?.rested === true) {
      status = 'rested'
    } else {
      status = 'empty'
    }

    return {
      date: cell.date,
      dayNum: dayNumOf(cell.date),
      weekdayIdx: weekdayIdxOf(cell.date),
      isToday: cell.isToday,
      status,
      registered: registeredFor(sig),
      events: eventsByDay[cell.date] ?? [],
    }
  })
}

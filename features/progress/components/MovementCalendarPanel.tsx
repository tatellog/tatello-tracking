import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'

import { track } from '@/lib/analytics'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { monthCalendar } from '@/features/orbit/month-built'
import { dayNumOf, weekdayIdxOf, type CalendarDay } from '@/features/tabs/components/calendar/logic'
import { useCalendarDays } from '@/features/tabs/components/calendar/useCalendarDays'
import { requestCalendarDay } from '@/features/tabs/pending-calendar-day'
import { todayInTimezone } from '@/lib/time'

import { buildConstanciaMonth, monthKeyBack, spanFromMonthStart } from '../constancia-logic'
import { ConstanciaCalendar } from './ConstanciaCalendar'
import { DayHistorySheet } from './DayHistorySheet'

// Hasta dónde se puede navegar hacia atrás (meses).
const MAX_MONTHS_BACK = 12

/*
 * Tu constancia: el calendario del mes + la hoja de cada día (rediseño dueña
 * 4 oct 2026). Los días salen de useCalendarDays con una ventana que llega
 * hasta el 1 del mes visto, así el reloj (daily_signals.trained), el descanso,
 * las calorías y los eventos están en cualquier mes navegado. Nada se muta
 * aquí: "Editar día" lleva a Hoy dentro de la ventana editable de 30 días.
 */
export function MovementCalendarPanel() {
  const router = useRouter()
  const today = todayInTimezone()
  const [monthsBack, setMonthsBack] = useState(0)
  const monthKey = monthKeyBack(today, monthsBack)
  const span = Math.max(62, spanFromMonthStart(monthKey, today))
  const { days: calendarDays } = useCalendarDays({
    span,
    today,
    todayWorkoutCompleted: false,
  })
  const dayByDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of calendarDays) m.set(d.date, d)
    return m
  }, [calendarDays])
  const targets = useMacroTargets().data
  const calorieTarget = targets?.calories ?? null
  const proteinTarget = targets?.protein_g ?? null
  const month = buildConstanciaMonth(monthKey, today, dayByDate, calorieTarget)
  // El calendario es EL MISMO de Descubre › Mes: mismas señales (la query de
  // historia ya cacheada por useCalendarDays), mismo monthCalendar y mismo
  // aro de entreno (manual o del reloj).
  const history = useSignalsHistory(span).data
  const monthSignals = useMemo(
    () => (history ?? []).filter((s) => s.day != null && s.day.startsWith(monthKey)),
    [history, monthKey],
  )
  const firstDataDay = useMemo(() => {
    let min: string | null = null
    for (const s of history ?? []) {
      if (s.day == null) continue
      if ((s.meal_count ?? 0) <= 0 && (s.calories ?? 0) <= 0) continue
      if (min == null || s.day < min) min = s.day
    }
    return min
  }, [history])
  const trainedDays = useMemo(
    () => new Set(monthSignals.filter((s) => s.trained && s.day).map((s) => s.day!)),
    [monthSignals],
  )
  // Mes pasado → su "día 31": todo el mes visible, sin futuro ni "hoy".
  const glance = monthCalendar(monthSignals, {
    today: monthsBack === 0 ? today : `${monthKey}-31`,
    calorieTarget,
    firstDataDay,
  })

  const [historyDay, setHistoryDay] = useState<CalendarDay | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  // Ventana editable = últimos 30 días: solo ahí "Editar día" lleva a editar.
  const editableFrom = useMemo(() => isoDaysAgo(today, 29), [today])
  const sheetEditable = historyDay != null && historyDay.date >= editableFrom

  const openHistoryDay = useCallback(
    (date: string) => {
      const day = dayByDate.get(date) ?? emptyDay(date, today)
      setHistoryDay(day)
      setSheetVisible(true)
      track('history_day_opened', { date, status: day.status })
    },
    [dayByDate, today],
  )
  // Cierra el sheet PRIMERO (desmonta el Modal en foco) y navega en el
  // siguiente frame: navegar con el Modal montado lo deja huérfano.
  const seeDayInHoy = useCallback(
    (date: string) => {
      setSheetVisible(false)
      requestCalendarDay(date)
      requestAnimationFrame(() => router.navigate('/(tabs)'))
    },
    [router],
  )
  const openDetail = useCallback(
    (path: '/workout-day' | '/sleep', date: string) => {
      setSheetVisible(false)
      requestAnimationFrame(() => router.push({ pathname: path, params: { date } }))
    },
    [router],
  )

  return (
    <>
      <ConstanciaCalendar
        // Como en Descubre: el año solo cuando no es el actual.
        monthLabel={
          monthKey.slice(0, 4) === today.slice(0, 4) ? month.label.split(' ')[0]! : month.label
        }
        glance={glance}
        trainedDays={trainedDays}
        monthName={month.label.split(' ')[0]!.toLowerCase()}
        stats={{ trained: month.trainedDays, rested: month.restedDays }}
        canGoBack={monthsBack < MAX_MONTHS_BACK}
        canGoForward={monthsBack > 0}
        onBack={() => setMonthsBack((n) => Math.min(MAX_MONTHS_BACK, n + 1))}
        onForward={() => setMonthsBack((n) => Math.max(0, n - 1))}
        onDayPress={openHistoryDay}
      />
      <DayHistorySheet
        visible={sheetVisible}
        day={historyDay}
        editable={sheetEditable}
        calorieTarget={calorieTarget}
        proteinTarget={proteinTarget}
        onClose={() => setSheetVisible(false)}
        onSeeDay={seeDayInHoy}
        onNavigate={openDetail}
      />
    </>
  )
}

// Fecha ISO `n` días antes de `today` (medianoche local, sin drift UTC).
function isoDaysAgo(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Día sin señales (fuera de la ventana cargada): todo vacío, lectura honesta.
function emptyDay(date: string, today: string): CalendarDay {
  return {
    date,
    dayNum: dayNumOf(date),
    weekdayIdx: weekdayIdxOf(date),
    isToday: date === today,
    status: 'empty',
    registered: {
      comida: false,
      agua: false,
      sueno: false,
      energia: false,
      peso: false,
      ciclo: false,
    },
    values: {
      mealCount: null,
      proteinG: null,
      calories: null,
      waterGlasses: null,
      sleepMinutes: null,
      energy: null,
      weightKg: null,
      onPeriod: false,
      workoutType: null,
    },
    events: [],
  }
}

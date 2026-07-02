import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'

import { track } from '@/lib/analytics'
import { dayNumOf, weekdayIdxOf, type CalendarDay } from '@/features/tabs/components/calendar/logic'
import { useCalendarDays } from '@/features/tabs/components/calendar/useCalendarDays'
import { requestCalendarDay } from '@/features/tabs/pending-calendar-day'
import { todayInTimezone } from '@/lib/time'

import { DayHistorySheet } from './DayHistorySheet'
import { MovementConstellation, type DayMark, type DayMeta } from './MovementConstellation'

/*
 * El calendario de Movimiento + su sheet de Historia (tap en un día → detalle
 * SOLO-LECTURA). Extraído del Tab Progreso para vivir en su propia pantalla
 * full-screen (`/movement-calendar`). Autocontenido: sus propios hooks +
 * helpers. Nada se muta desde aquí; la única puerta a editar es "Ver día →"
 * (lleva a Hoy) dentro de la ventana editable de 30 días.
 */
export function MovementCalendarPanel() {
  const router = useRouter()
  const today = todayInTimezone()
  const { days: calendarDays } = useCalendarDays({
    span: 62,
    today,
    todayWorkoutCompleted: false,
  })
  const dayByDate = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const d of calendarDays) m.set(d.date, d)
    return m
  }, [calendarDays])
  // Estado extra por día: descanso (vs sin registro) + marca de evento
  // (revelación/patrón/transformación), los hitos de tu historia.
  const metaByDate = useMemo(() => {
    const m = new Map<string, DayMeta>()
    for (const d of calendarDays) {
      const mark = markFromEvents(d.events)
      const rested = d.status === 'rested'
      if (rested || mark) m.set(d.date, { rested, mark })
    }
    return m
  }, [calendarDays])
  const [historyDay, setHistoryDay] = useState<CalendarDay | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  // Ventana editable = últimos 30 días: solo ahí "Ver día" lleva a editar.
  const editableFrom = useMemo(() => isoDaysAgo(today, 29), [today])
  const sheetEditable = historyDay != null && historyDay.date >= editableFrom

  const openHistoryDay = useCallback(
    (date: string, trained: boolean) => {
      const day = dayByDate.get(date) ?? synthDay(date, trained, today)
      setHistoryDay(day)
      setSheetVisible(true)
      track('history_day_opened', { date, status: day.status })
    },
    [dayByDate, today],
  )
  const seeDayInHoy = useCallback(
    (date: string) => {
      // Cierra el sheet PRIMERO (desmonta el Modal en foco) y navega en el
      // siguiente frame — navegar con el Modal montado lo deja huérfano.
      setSheetVisible(false)
      requestCalendarDay(date)
      requestAnimationFrame(() => router.navigate('/(tabs)'))
    },
    [router],
  )

  return (
    <>
      <MovementConstellation onDayPress={openHistoryDay} metaByDate={metaByDate} />
      <DayHistorySheet
        visible={sheetVisible}
        day={historyDay}
        editable={sheetEditable}
        onClose={() => setSheetVisible(false)}
        onSeeDay={seeDayInHoy}
      />
    </>
  )
}

// Marca del día desde sus eventos (revelaciones). Precedencia: transformación
// (hito mayor) > regreso (revelación) > patrón. Un día rara vez tiene varios.
function markFromEvents(events: CalendarDay['events']): DayMark | null {
  let hasReturn = false
  let hasPattern = false
  for (const e of events) {
    if (e.tier === 'transformation') return 'transformation'
    if (e.tier === 'return') hasReturn = true
    if (e.tier === 'pattern') hasPattern = true
  }
  if (hasReturn) return 'revelation'
  if (hasPattern) return 'pattern'
  return null
}

// Fecha ISO `n` días antes de `today` (medianoche local, sin drift UTC).
function isoDaysAgo(today: string, n: number): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d - n)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

// Día mínimo para fechas fuera de la ventana de señales recientes: solo sabemos
// si entrenó (del grid all-time); el resto vacío (lectura honesta).
function synthDay(date: string, trained: boolean, today: string): CalendarDay {
  return {
    date,
    dayNum: dayNumOf(date),
    weekdayIdx: weekdayIdxOf(date),
    isToday: date === today,
    status: trained ? 'trained' : 'empty',
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
    },
    events: [],
  }
}

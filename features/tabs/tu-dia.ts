import { dayReading } from '@/features/orbit/day-goal'

import { dayCloseCopy, dayCloseVerdict, type DayCloseVerdict } from './day-close'

/*
 * "Tu día" — la ÚNICA tarjeta de lectura de Hoy (dirección de arte + ux
 * sep 2026). Fusiona lo que antes eran tres cards que se turnaban (la
 * lectura diurna, el cierre nocturno y la Lectura Semanal) en un solo
 * modelo con una sola prioridad. PURO y testeable.
 *
 *   1. Lectura Semanal lista y sin abrir → ella toma la tarjeta (ganada,
 *      la más rara).
 *   2. Desde las 20:00 con comida → el cierre, con la cifra (day-close.ts).
 *   3. De día con comida → la lectura SIN número: solo estado + una línea.
 *      El déficit no es semáforo intradía; el número llega con el cierre.
 *   4. Sin comida registrada → no hay tarjeta (un día sin registro no se
 *      juzga ni se reprocha).
 */

export type TuDiaModel =
  | {
      kind: 'weekly'
      eyebrow: string
      title: string
      line: string
    }
  | {
      kind: 'close'
      eyebrow: string
      verdict: DayCloseVerdict
      title: string
      line: string
      /** Micro-observación real del motor (early-readings); null = se omite. */
      reading: string | null
    }
  | {
      kind: 'day'
      eyebrow: string
      status: 'deficit' | 'over'
      title: string
      line: string
    }

export function tuDiaModel(input: {
  consumedCalories: number
  targetCalories: number | null | undefined
  mealCount: number
  /** Hora local 0-23. */
  hour: number
  /** Hay Lectura Semanal de la semana cerrada sin abrir. */
  weeklyReadingReady: boolean
  closeReading?: string | null
}): TuDiaModel | null {
  const { consumedCalories, targetCalories, mealCount, hour, weeklyReadingReady } = input

  if (weeklyReadingReady) {
    return {
      kind: 'weekly',
      eyebrow: 'Tu lectura semanal',
      title: 'Tu lectura está lista.',
      line: 'Lo que tu semana pasada dejó ver.',
    }
  }

  const verdict = dayCloseVerdict({ consumedCalories, targetCalories, mealCount, hour })
  if (verdict) {
    const copy = dayCloseCopy(verdict)
    return {
      kind: 'close',
      eyebrow: 'Tu día',
      verdict,
      title: copy.data,
      line: copy.coach,
      reading: input.closeReading ?? null,
    }
  }

  if (mealCount <= 0) return null
  const r = dayReading(consumedCalories, targetCalories)
  if (r.status === 'incomplete') return null
  if (r.status === 'deficit') {
    return {
      kind: 'day',
      eyebrow: 'Tu día',
      status: 'deficit',
      title: 'Vas en déficit.',
      line: r.line,
    }
  }
  // Sobre la meta a media tarde: la tarjeta no calla (desaparecer también
  // sería un veredicto) pero tampoco juzga — el día sigue abierto.
  return {
    kind: 'day',
    eyebrow: 'Tu día',
    status: 'over',
    title: 'Tu día sigue abierto.',
    line: 'El cierre llega esta noche.',
  }
}

import { isDeficitDay } from './deficit'

/*
 * El veredicto de Órbita Día — PURO y testeable (dirección de arte + ux
 * sep 2026, revisión con usuaria final).
 *
 * Responde en PALABRAS la pregunta que la usuaria trae: "¿sigo en déficit?".
 * Sin número grande de margen (era el "te quedan X" de MFP, y mientras menos
 * comía más grande y más magenta se pintaba). La cifra vive como contexto
 * en la leyenda ("360 de 1,463 kcal").
 *
 * Mismo criterio que el cierre de Hoy (day-close.ts) y que el calendario de
 * Mes (deficit.ts): déficit sano = consumo dentro de [60% × meta, meta].
 *   · De día (antes de las 20:00) con consumo ≤ meta → "Sigues en déficit":
 *     el día está abierto, es verdad y no juzga.
 *   · Desde las 20:00: dentro de la franja sana → "Día en déficit"; bajo el
 *     piso → "poco registrado", NUNCA en color de logro (línea roja: comer
 *     casi nada no se celebra; lo más probable es que falte registrar).
 *   · Sobre la meta, a cualquier hora → "Sobre tu objetivo", en oro, sin culpa.
 */

export const DAY_VERDICT_CLOSE_HOUR = 20

export type DayVerdictKind = 'empty' | 'open' | 'deficit' | 'low' | 'over'
/** El color del anillo exterior: magenta (déficit), oro (sobre), niebla (sin lectura). */
export type RingTone = 'deficit' | 'over' | 'incomplete'

export type DayVerdict = {
  kind: DayVerdictKind
  title: string
  line: string
  ringTone: RingTone
  /** Píldora para completar el día (sin comida o poco registrado, solo hoy). */
  cta: 'meal' | 'target' | null
}

export function dayVerdict(input: {
  consumedCalories: number | null | undefined
  targetCalories: number | null | undefined
  /** Hora local 0-23. */
  hour: number
  past?: boolean
}): DayVerdict {
  const { hour, past = false } = input
  const target =
    input.targetCalories != null && input.targetCalories > 0
      ? Math.round(input.targetCalories)
      : null
  const consumed =
    input.consumedCalories != null && input.consumedCalories > 0
      ? Math.round(input.consumedCalories)
      : null

  if (target == null) {
    return {
      kind: 'empty',
      title: past ? 'Ese día no tiene lectura' : 'Tu día apenas empieza',
      line: 'Añade tu meta de calorías para saber si vas en déficit.',
      ringTone: 'incomplete',
      cta: past ? null : 'target',
    }
  }
  if (consumed == null) {
    return past
      ? {
          kind: 'empty',
          title: 'Ese día no tiene comida registrada',
          line: 'Sin comida no se puede leer si cerró en déficit.',
          ringTone: 'incomplete',
          cta: null,
        }
      : {
          kind: 'empty',
          title: 'Tu día apenas empieza',
          line: 'Cuando registres tu comida, verás si vas en déficit.',
          ringTone: 'incomplete',
          cta: 'meal',
        }
  }

  if (consumed > target) {
    return {
      kind: 'over',
      title: past ? 'Ese día quedó sobre tu objetivo' : 'Sobre tu objetivo',
      line: 'Un día no define tu semana.',
      ringTone: 'over',
      cta: null,
    }
  }

  const closed = past || hour >= DAY_VERDICT_CLOSE_HOUR
  if (!closed) {
    return {
      kind: 'open',
      title: 'Sigues en déficit',
      line: 'Tu día sigue abierto. El cierre llega esta noche.',
      ringTone: 'deficit',
      cta: null,
    }
  }

  if (isDeficitDay(consumed, target)) {
    return {
      kind: 'deficit',
      title: past ? 'Ese día cerró en déficit' : 'Día en déficit',
      line: past ? 'Uno más dorado en tu cielo.' : 'Uno más dorado para tu cielo.',
      ringTone: 'deficit',
      cta: null,
    }
  }

  // Bajo el piso sano: no se valida como déficit (restricción extrema) ni se
  // reprocha; se invita a completar el registro.
  return past
    ? {
        kind: 'low',
        title: 'Ese día quedó con poco registro',
        line: `Con ${consumed} kcal registradas no alcanza para leerlo.`,
        ringTone: 'incomplete',
        cta: null,
      }
    : {
        kind: 'low',
        title: 'Tu día aún no se lee completo',
        line: `Con ${consumed} kcal registradas todavía no se puede leer si cerraste en déficit. Si comiste algo más, súmalo.`,
        ringTone: 'incomplete',
        cta: 'meal',
      }
}

export type DayFocus = { title: string; body: string }

/**
 * El foco del día (decisión dueña jun 2026: Órbita recomienda un FOCO desde
 * los datos, en tono de oportunidad; nunca receta dieta ni rutina). Solo hoy
 * y solo cuando el día va en déficit: la palanca es la proteína, la métrica
 * más cuidada (recomposición). Sin foco honesto que dar, null.
 */
export function dayFocus(input: {
  verdict: DayVerdict
  proteinG: number | null | undefined
  proteinTarget: number | null | undefined
  past?: boolean
}): DayFocus | null {
  const { verdict, past = false } = input
  if (past) return null
  if (verdict.kind !== 'open' && verdict.kind !== 'deficit') return null
  const target = input.proteinTarget != null && input.proteinTarget > 0 ? input.proteinTarget : null
  if (target == null) return null
  const left = Math.round(target - (input.proteinG ?? 0))
  if (left <= 0) return null
  return {
    title: 'La proteína',
    body: `Faltan ${left} g. Es la que más cuida tu músculo mientras bajas.`,
  }
}

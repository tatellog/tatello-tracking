import { isDeficitDay } from '@/features/orbit/deficit'

/*
 * El cierre del día — el veredicto nocturno de Hoy. PURO y testeable.
 *
 * Responde lo que la usuaria quiere oír al final del día, claro y sin
 * poesía: "¿quedé en déficit hoy o no?" — y conecta la respuesta con el
 * calendario dorado de Órbita Mes (misma definición de déficit sano:
 * features/orbit/deficit.ts, consumo dentro de [60% × meta, meta]).
 *
 * Reglas (manifiesto):
 *   · Solo existe con ≥1 comida registrada: un día sin registros no se
 *     "cierra" ni se reprocha, simplemente no hay veredicto.
 *   · Aparece desde las 20:00 — el déficit NO es semáforo intradía (eso
 *     era el bucle de ansiedad de MFP); es lectura de cierre.
 *   · "No déficit" nunca resta, nunca usa rojo, nunca culpa.
 *   · Ingesta muy baja NUNCA se celebra: es estado de cuidado.
 */

export const DAY_CLOSE_HOUR = 20

export type DayCloseKind = 'deficit' | 'surplus' | 'low'

export type DayCloseVerdict = {
  kind: DayCloseKind
  consumed: number
  target: number
}

export function dayCloseVerdict(input: {
  /** Calorías consumidas hoy (ctx.today_macros.calories). */
  consumedCalories: number
  /** Meta calórica vigente (ctx.targets.calories); null sin metas. */
  targetCalories: number | null | undefined
  /** Comidas registradas hoy — sin comidas no hay cierre. */
  mealCount: number
  /** Hora local 0-23. */
  hour: number
}): DayCloseVerdict | null {
  const { consumedCalories, targetCalories, mealCount, hour } = input
  if (hour < DAY_CLOSE_HOUR) return null
  if (mealCount <= 0) return null
  if (targetCalories == null || targetCalories <= 0) return null
  if (consumedCalories <= 0) return null

  const kind: DayCloseKind = isDeficitDay(consumedCalories, targetCalories)
    ? 'deficit'
    : consumedCalories > targetCalories
      ? 'surplus'
      : 'low'
  return { kind, consumed: Math.round(consumedCalories), target: targetCalories }
}

/**
 * Copy del veredicto. `data` es la línea literal de números (Hanken/Inter);
 * `coach` es la línea emocional (Cormorant italic). Sin culpa, sin rojo,
 * sin lenguaje clínico. (Pasa por voice-and-copy.)
 */
export function dayCloseCopy(v: DayCloseVerdict): { data: string; coach: string } {
  const data = `Hoy comiste ${v.consumed.toLocaleString('es-MX')} de tus ${v.target.toLocaleString('es-MX')} kcal.`
  switch (v.kind) {
    case 'deficit':
      return { data, coach: 'Día en déficit. Uno más dorado para tu cielo.' }
    case 'surplus':
      // Nunca "te pasaste": el cuerpo pidió más y mañana sigue el cielo.
      return { data, coach: 'Hoy tu cuerpo pidió más. Mañana el cielo sigue aquí.' }
    case 'low':
      // Cuidado, no logro. Anclado al REGISTRO, no a la ingesta (voice-and-copy:
      // observar bajo consumo rozaría la línea roja; observar registro corto no).
      return {
        data,
        coach: 'Hoy quedó poco registrado. Si olvidaste algo, aún puedes agregarlo.',
      }
  }
}

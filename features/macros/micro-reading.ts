import { dayReading } from '@/features/orbit/day-goal'

/*
 * Microlectura post-registro (V-01) — UNA línea del MOTOR tras guardar una
 * comida: habla del día acumulado, no del platillo (el reveal ya muestra la
 * comida). PURA y testeable.
 *
 * Regla dura: con dato o silencio. Sin meta o sin cómputo real devuelve
 * null y el reveal se queda como está — jamás una frase de relleno que
 * finja personalización.
 *
 * Prioridades:
 *   1. Proteína del día vs meta — la métrica más cuidada (recomposición);
 *      conteo honesto autorizado en Comidas. Positiva en ambos estados.
 *   2. Margen del día — mismas palabras y umbrales que Órbita Día (via
 *      dayReading, la fuente única). SOLO en déficit: recién guardada una
 *      comida, "sobre tu objetivo" sería un regaño en el momento de la
 *      recompensa → silencio.
 */
export type MicroReading = { key: 'protein-day' | 'deficit-margin'; text: string }

export function microReading(input: {
  /** Proteína acumulada del día, INCLUIDA la comida recién guardada. */
  dayProteinG: number | null
  proteinTarget: number | null | undefined
  /** Calorías acumuladas del día, INCLUIDA la comida recién guardada. */
  dayCalories: number | null
  calorieTarget: number | null | undefined
}): MicroReading | null {
  const target =
    input.proteinTarget != null && input.proteinTarget > 0 ? Math.round(input.proteinTarget) : null
  const protein =
    input.dayProteinG != null && input.dayProteinG > 0 ? Math.round(input.dayProteinG) : null

  if (target != null && protein != null) {
    return {
      key: 'protein-day',
      text:
        protein >= target
          ? `Hoy llevas ${protein} g de proteína · tu meta de ${target} g está cubierta.`
          : `Hoy llevas ${protein} g de proteína · tu meta: ${target} g.`,
    }
  }

  const reading = dayReading(input.dayCalories, input.calorieTarget)
  if (reading.status === 'deficit' && reading.deltaKcal != null) {
    return {
      key: 'deficit-margin',
      text: `Tu día va ${reading.deltaKcal} kcal por debajo de tu meta.`,
    }
  }

  return null
}

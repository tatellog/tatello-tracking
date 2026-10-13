import { z } from 'zod'

/*
 * Arco de evidencia (V-10) · lectura del reporte ANTERIOR. PURO.
 */

// La columna se llama `payload` (migración 20260709224540_monthly_reports);
// leer `report` hacía fallar la consulta en silencio → [] siempre y el estado
// "confirmado" nunca se encendía (ST-005, 13 oct 2026).
const PriorReportSchema = z.object({
  payload: z.object({
    findings: z.array(z.object({ category: z.string() }).passthrough()),
  }),
})

/** Categorías únicas de la fila de `monthly_reports`; `[]` si no parsea. */
export function priorCategoriesFromRow(row: unknown): string[] {
  const parsed = PriorReportSchema.safeParse(row)
  if (!parsed.success) return []
  return [...new Set(parsed.data.payload.findings.map((f) => f.category))]
}

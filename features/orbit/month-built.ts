/* Re-export del motor compartido — fuente única en
 * supabase/functions/_shared/intelligence/month-built.ts (app + Edge
 * Functions). El motor de EVIDENCIA del mes convergió en V-10 (decisión
 * dueña 23 jul 2026, cierra el ADR 0002): dejó de ser divergente
 * solo-cliente y la IA server-side puede reusar sus detectores. La regla
 * sigue: los detectores NUEVOS nacen en _shared/intelligence/ (el guardrail
 * de exports lo vigila). */
export * from '../../supabase/functions/_shared/intelligence/month-built'

/* Re-export del motor compartido — fuente única en
 * supabase/functions/_shared/intelligence/day-quality.ts (app + Edge
 * Functions). La definición de "día completo / parcial / vacío" vive ahí
 * para que server y cliente coincidan (V-09). */
export * from '../../supabase/functions/_shared/intelligence/day-quality'

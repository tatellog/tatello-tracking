/* Re-export del motor compartido — fuente única en
 * supabase/functions/_shared/intelligence/finding-arc.ts (app + Edge
 * Functions). El arco de evidencia de un hallazgo (V-10) se deriva ahí
 * para que server y cliente cuenten el mismo estado. */
export * from '../../supabase/functions/_shared/intelligence/finding-arc'

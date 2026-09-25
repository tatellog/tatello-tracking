/* Re-export del motor compartido — fuente única en
 * supabase/functions/_shared/intelligence/consistency.ts (app + Edge
 * Functions). Los 3 detectores de constancia (proteína/sueño/entreno)
 * viven ahí desde V-10 (condición 1 del ADR 0002): la IA server-side
 * puede reusarlos y month-built queda desbloqueado para converger. */
export * from '../../supabase/functions/_shared/intelligence/consistency'

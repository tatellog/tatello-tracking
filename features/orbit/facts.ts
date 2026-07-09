/* Puente cliente del Facts Engine (R1). La fuente vive en
 * supabase/functions/_shared/intelligence/facts.ts (app + Edge Functions).
 * El cliente lo usa como FALLBACK de compute cuando aún no hay facts en tabla
 * (ver docs/adr/0001-*). Ver docs/epics/epic-01-intelligence-engine.md (T1.2). */
export * from '../../supabase/functions/_shared/intelligence/facts'

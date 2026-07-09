/* Puente cliente del Findings Engine (R1 · Engine 2). La fuente única vive en
 * supabase/functions/_shared/intelligence/findings.ts (app + Edge Functions).
 * Antes este motor era client-only aquí; migrado en el epic 01 · T2.2. Todos los
 * importadores de '../findings' (buildFindings, hashFindings, Finding, …) siguen
 * funcionando idénticos vía este re-export. */
export * from '../../supabase/functions/_shared/intelligence/findings'

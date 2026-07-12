/* Puente cliente del Progress Insight Engine (Epic 03). La fuente única vive en
 * supabase/functions/_shared/intelligence/progress-insights.ts (app + Edge
 * Functions) — regla del repo: los detectores nuevos van a _shared, nunca a un
 * motor solo-cliente divergente. */
export * from '../../supabase/functions/_shared/intelligence/progress-insights'

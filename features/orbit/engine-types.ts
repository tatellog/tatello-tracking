/* Puente cliente del MODELO DE DOMINIO del Intelligence Engine (R1). La fuente
 * vive en supabase/functions/_shared/intelligence/engine.ts (app + Edge
 * Functions). Importá los contratos (Fact/Finding/Story/Hypothesis/
 * MonthlyReport…) desde aquí en código de cliente.
 * Ver docs/epics/epic-01-intelligence-engine.md. */
export * from '../../supabase/functions/_shared/intelligence/engine'

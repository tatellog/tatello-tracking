/* Meta de agua por defecto (vasos por día) — regla determinística compartida
 * del motor de inteligencia (app + Edge Functions). Vivía en
 * features/orbit/month-built.ts; se movió aquí para que el Findings Engine
 * compartido no dependa del motor cliente. Ver epic 01 · T2.2 (converge T6.1). */
export const WATER_GOAL_GLASSES = 8

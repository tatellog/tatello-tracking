/*
 * Progress · constantes de dominio + catálogo de analytics (Epic 00 · Foundation).
 *
 * Los eventos se DEFINEN aquí (tipados), NO se disparan todavía — cada épica los
 * emite con `track()` (lib/analytics) cuando construye su superficie. Centralizar
 * los nombres evita strings sueltos y typos (mismo espíritu que lib/queryKeys).
 */

/** Eventos de comportamiento de Progress. Solo definidos (Epic 00). */
export const PROGRESS_EVENTS = {
  /** Abrió el tab Progreso. */
  open: 'progress_open',
  /** Abrió una comparación (Historia / Body). */
  compare: 'progress_compare',
  /** Entró a Body. */
  body: 'progress_body',
  /** Abrió/comparó fotos. */
  photo: 'progress_photo',
  /** Registró/abrió peso. */
  weight: 'progress_weight',
  /** Interactuó con el ciclo. */
  cycle: 'progress_cycle',
  /** Cruzó el puente a Órbita desde Progress. */
  openOrbita: 'progress_open_orbita',
  /** Abrió "Tu constancia" (calendario) desde Progress (Epic 06). */
  openCalendar: 'progress_open_calendar',
  /** Abrió un insight (Epic 03/04). */
  openInsight: 'progress_open_insight',
} as const

export type ProgressEvent = (typeof PROGRESS_EVENTS)[keyof typeof PROGRESS_EVENTS]

/** Ventana por defecto del tab (cubre la comparativa 30v30 + la constelación de
 *  ~28 días en un solo fetch). */
export const PROGRESS_DEFAULT_WINDOW_DAYS = 60

/** Ventana de comparación de hábitos (Epic 01 · 30 vs 30). */
export const PROGRESS_COMPARE_WINDOW_DAYS = 30

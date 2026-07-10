/*
 * Feature flags centralizados — interruptores de features en construcción.
 *
 * Las features de IA (AI Foundation + Órbita Mes IA) están gateadas POR
 * USUARIO, no globalmente: mientras el rediseño se valida solo con la cuenta
 * dev, la beta sigue viendo el Órbita Mes de 4 tiempos y la voz determinista.
 * Cuando se quiera abrir a todas, basta poner AI_MASTER a "todos" o vaciar la
 * lista de emails y devolver true.
 */

/** Kill-switch global. Si false, la IA queda apagada para TODOS sin importar
 *  el email (para un apagón de emergencia). */
const AI_MASTER_ENABLED = true

/*
 * Emails con las features de IA encendidas (Órbita Mes IA · descubrimiento
 * guiado + Voz de IA que EXPLICA los insights deterministas). Per-usuario:
 * la beta ve lo de siempre; solo estas cuentas viven el rediseño y gastan
 * OpenAI. Agregar un email aquí lo enciende sin más cambios.
 */
const AI_ENABLED_EMAILS = ['dev@local.test']

/** ¿Este usuario tiene las features de IA encendidas? (Órbita Mes IA + Voz.) */
export function aiEnabledForEmail(email: string | null | undefined): boolean {
  if (!AI_MASTER_ENABLED || email == null) return false
  return AI_ENABLED_EMAILS.includes(email.toLowerCase())
}

/*
 * Intelligence Engine (Epic 01 · F5 · T5.3) — el "flip".
 *
 * Cuando es `true`, Órbita Mes toma sus hallazgos + findingsHash del REPORTE
 * PERSISTIDO (writer compute-findings → tabla monthly_reports) en vez de
 * computarlos en el cliente. Por construcción la salida es idéntica (mismo
 * buildFindings/hashFindings, misma ventana de días) — hay un test de paridad
 * que lo prueba. Default `false`: hasta que la paridad esté validada en device,
 * la UI en vivo se queda EXACTAMENTE como hoy (compute-local, cero red nueva).
 */
export const USE_PERSISTED_MONTH_REPORT = false

/*
 * Progress · Historia de hitos (Epic 03 · F-R3 · T-R3.3).
 *
 * Cuando es `true`, el sync de hitos (useMilestoneSync) detecta los hitos de
 * primera vez y los persiste en `revelations` (tier='milestone'). Default
 * `false`: nada se escribe hasta que exista la UI de Historia que los muestre.
 * Los tiers de ceremonia (Hoy) y el calendario ignoran 'milestone' por
 * construcción, así que encenderlo NO agrega ceremonias ni marcas nuevas.
 */
export const MILESTONES_ENABLED = false

/*
 * Wearables · composición corporal (Epic 04 · R4 · T-R4.x).
 *
 * Cuando es `true`, Stelar pide permiso de HealthKit para % grasa / masa magra /
 * IMC y los sincroniza a `wearable_body_composition`. Default `false`: NO amplía
 * el permiso de HealthKit (los tipos de composición no entran a READ_TYPES) ni
 * sincroniza nada, hasta que exista la UI de Resumen (R3) que muestre el dato.
 */
export const WEARABLE_BODY_COMPOSITION_ENABLED = false

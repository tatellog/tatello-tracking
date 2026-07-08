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

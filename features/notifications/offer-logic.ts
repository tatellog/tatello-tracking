/*
 * Cuándo ofrecer los avisos (dueña 26 sep 2026): nunca en el onboarding. Se
 * ofrecen en contexto, al guardar la primera comida; si dice "Ahora no", una
 * sola vez más cuando aparece su primer patrón. Después, solo en Ajustes.
 * PURO: el estado vive en AsyncStorage (offer.ts), la decisión aquí.
 */
import type { NotificationWindow } from '@/features/profile/api'

/** none = nunca se ofreció · declined = dijo "Ahora no" una vez · done = cerrado. */
export type OfferState = 'none' | 'declined' | 'done'
export type OfferTrigger = 'meal' | 'pattern'

/** ¿Toca ofrecer ahora? Una ventana real ya elegida cierra la oferta para siempre. */
export function shouldOffer(
  trigger: OfferTrigger,
  state: OfferState,
  window: NotificationWindow | null,
): boolean {
  if (window != null && window !== 'not_yet') return false
  if (trigger === 'meal') return state === 'none'
  return state === 'declined'
}

/** La franja en que aceptó: si usa Stelar a esa hora, esa hora le acomoda. */
export function windowForHour(hour: number): Exclude<NotificationWindow, 'not_yet'> {
  if (hour < 11) return 'morning'
  if (hour < 17) return 'midday'
  return 'evening'
}

/** El estado tras su respuesta. Un segundo "Ahora no" cierra la oferta. */
export function nextOfferState(trigger: OfferTrigger, accepted: boolean): OfferState {
  if (accepted) return 'done'
  return trigger === 'meal' ? 'declined' : 'done'
}

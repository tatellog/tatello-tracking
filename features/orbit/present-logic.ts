/*
 * Formato de fecha larga en español para Órbita · Día ("Sábado, 28 de junio").
 * Determinístico (no depende de Intl/locale del device); parsea como UTC para no
 * correrse de día por timezone.
 *
 * (El resto de la lógica de Día —héroe/chips/menos-apareció— se retiró con el
 * rediseño "¿Quién fuiste hoy?": ver day-state.ts.)
 */
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export function formatLongDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`
}

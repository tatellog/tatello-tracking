/*
 * Órbita · Día — "Tu órbita de hoy". El centro de situación del día.
 *
 * Responde UNA pregunta: "¿cómo va mi día?". Todo se deriva, de forma
 * DETERMINÍSTICA y sin IA, de las señales de HOY (daily_signals). No predice,
 * no compara con otros días; observa el estado presente y lo ordena en
 * cuatro piezas: lo que más brilló, lo que también estuvo presente, lo que
 * menos apareció y un enfoque suave para mañana. Lógica pura y testeable; la
 * capa visual la consume en DayPresent.tsx.
 */
import type { DailySignals } from './api'
import { dimensionDetail, TONE_BRILLANTE, type Dimension, type DimensionKey } from './logic'

/** Meta de vasos de agua del día — alineada al MAX_GLASSES de features/water. */
export const WATER_TARGET = 8

/** Tres estados de presencia · sin porcentajes. STELAR registra, no califica.
 *  `ausente` = aún no aparece (no es falla) · `parcial` = apareció pero
 *  todavía suave · `presente` = la dimensión está plena hoy. */
export type Presence = 'presente' | 'parcial' | 'ausente'

/** La presencia de una dimensión: por REGISTRO primero (¿apareció hoy?),
 *  por brillo después (¿qué tan plena?). Registrar energía baja SÍ es
 *  aparecer → `parcial`, nunca `ausente`. */
export function dimensionPresence(d: Dimension): Presence {
  if (!d.registered) return 'ausente'
  return d.brightness >= TONE_BRILLANTE ? 'presente' : 'parcial'
}

/* Títulos cálidos por dimensión (los labels del orbital son MAYÚSCULAS
 * técnicas; aquí hablamos en voz humana). */
const DIM_TITLE: Record<DimensionKey, string> = {
  cuerpo: 'Movimiento',
  alimento: 'Comida',
  sueno: 'Sueño',
  energia: 'Energía',
  mente: 'Mente',
  ciclo: 'Ciclo',
}

export type DayHero = { key: DimensionKey; label: string; line: string }

/* El héroe ("lo que más brilló") premia ACCIONES (entreno, comida, sueño), no
 * auto-ratings (energía, mente) ni el estado del ciclo: "brillar" es algo que
 * HICISTE, no cómo te calificaste. Devolverte "tu energía llegó alta" —un dato
 * que tú misma anotaste— se sentía circular. Energía/mente/ciclo siguen
 * apareciendo como chips en "también estuvieron presentes". */
const HERO_EXCLUDED: ReadonlySet<DimensionKey> = new Set<DimensionKey>([
  'ciclo',
  'energia',
  'mente',
])

/* Orden de PRIORIDAD del héroe para el objetivo (peso = norte): la comida
 * (proteína/déficit) pesa más, el sueño muy cerca como gran habilitador, el
 * movimiento de apoyo. Entre lo que hiciste BIEN hoy gana el de mayor
 * prioridad; "lo que más brilló" apunta a la palanca más útil, no solo al
 * número más alto. Decidido con la owner. */
const HERO_PRIORITY: DimensionKey[] = ['alimento', 'sueno', 'cuerpo']
function heroPriorityRank(k: DimensionKey): number {
  const i = HERO_PRIORITY.indexOf(k)
  return i === -1 ? HERO_PRIORITY.length : i
}

/** "Lo que más brilló hoy" — entre las ACCIONES registradas (excluye auto-
 *  ratings y ciclo), híbrido: si alguna se hizo BIEN (brillo ≥ brillante)
 *  gana la de mayor prioridad para el objetivo; si nada destacó, gana la de
 *  mayor brillo (lo mejor que hubo). `null` si no hay acción registrada. */
export function brightestToday(dims: Dimension[], signals: DailySignals | null): DayHero | null {
  const registered = dims.filter((d) => d.registered && !HERO_EXCLUDED.has(d.key))
  if (registered.length === 0) return null
  const good = registered.filter((d) => d.brightness >= TONE_BRILLANTE)
  const top =
    good.length > 0
      ? good.reduce((a, b) => (heroPriorityRank(b.key) < heroPriorityRank(a.key) ? b : a))
      : registered.reduce((a, b) => (b.brightness > a.brightness ? b : a))
  return { key: top.key, label: DIM_TITLE[top.key], line: dimensionDetail(top.key, signals) }
}

/* ── "También estuvieron presentes" ──────────────────────────────────
 *
 * Pequeñas señales registradas hoy, con su DATO concreto. Incluye dos
 * sub-señales que no son dimensiones (proteína y agua) porque ayudan a
 * decidir antes de cerrar el día. Excluye la que ya es héroe y la que va en
 * "lo que menos apareció" — nada se cuenta dos veces.
 */
export type SignalChip = { key: string; label: string; value: string }

function energyWord(e: number): string {
  return e >= 5 ? 'Excelente' : e === 4 ? 'Buena' : e === 3 ? 'Media' : 'Baja'
}

function moodWord(m: string): string {
  return m === 'good' ? 'Bien' : m === 'neutral' ? 'Neutral' : 'En lucha'
}

/* Palabra cálida para el chip de Mente: prioriza el ánimo; si no hay, deriva de
 * motivación/estrés en voz Stelar (sin tecnicismos). "Anotado" solo como último
 * recurso. Draft — pasa por voice-and-copy antes del launch. */
function menteWord(s: DailySignals): string {
  if (s.mood != null) return moodWord(s.mood)
  if (s.motivation != null && s.motivation >= 4) return 'Con impulso'
  if (s.stress != null && s.stress >= 4) return 'Con tensión'
  if (s.stress != null && s.stress <= 2) return 'En calma'
  if (s.motivation != null && s.motivation >= 3) return 'Presente'
  return 'Anotado'
}

function sleepHours(min: number): string {
  return `${(min / 60).toFixed(1)} h`
}

/* Cada descriptor sabe si está presente hoy y cómo se lee su valor. El orden
 * es el orden de lectura de los chips. `dim` marca las que son dimensiones
 * (candidatas a héroe / menos-apareció); proteína y agua no lo son. */
type ChipDescriptor = {
  key: string
  dim?: DimensionKey
  label: string
  present: (s: DailySignals) => boolean
  value: (s: DailySignals) => string
}

const CHIP_DESCRIPTORS: readonly ChipDescriptor[] = [
  {
    key: 'cuerpo',
    dim: 'cuerpo',
    label: 'Movimiento',
    present: (s) => s.trained === true || s.rested === true,
    value: (s) => (s.trained ? 'Activo' : 'Descanso'),
  },
  {
    key: 'comida',
    dim: 'alimento',
    label: 'Comida',
    present: (s) => (s.meal_count ?? 0) > 0,
    value: (s) => `${s.meal_count} ${s.meal_count === 1 ? 'comida' : 'comidas'}`,
  },
  {
    key: 'energia',
    dim: 'energia',
    label: 'Energía',
    present: (s) => s.energy != null,
    value: (s) => energyWord(s.energy as number),
  },
  {
    key: 'proteina',
    label: 'Proteína',
    present: (s) => s.protein_g != null,
    value: (s) => `${Math.round(s.protein_g as number)} g`,
  },
  {
    key: 'agua',
    label: 'Agua',
    present: (s) => (s.water_glasses ?? 0) > 0,
    value: (s) => `${s.water_glasses} ${s.water_glasses === 1 ? 'vaso' : 'vasos'}`,
  },
  {
    key: 'sueno',
    dim: 'sueno',
    label: 'Sueño',
    present: (s) => s.sleep_minutes != null,
    value: (s) => sleepHours(s.sleep_minutes as number),
  },
  {
    key: 'mente',
    dim: 'mente',
    label: 'Mente',
    present: (s) => s.mood != null || s.stress != null || s.motivation != null,
    value: (s) => menteWord(s),
  },
  {
    key: 'ciclo',
    dim: 'ciclo',
    label: 'Ciclo',
    present: (s) => s.on_period === true,
    value: () => 'En periodo',
  },
]

export function presentChips(
  signals: DailySignals | null,
  opts?: { cycleEnabled?: boolean; excludeKeys?: (string | null | undefined)[] },
): SignalChip[] {
  if (!signals) return []
  const exclude = new Set(opts?.excludeKeys ?? [])
  return CHIP_DESCRIPTORS.filter((d) => {
    if (d.key === 'ciclo' && !opts?.cycleEnabled) return false
    if (exclude.has(d.key) || (d.dim && exclude.has(d.dim))) return false
    return d.present(signals)
  }).map((d) => ({ key: d.key, label: d.label, value: d.value(signals) }))
}

/* ── "Lo que menos apareció" ──────────────────────────────────────────
 *
 * La dimensión registrada con MENOS brillo (la que pide más cuidado),
 * distinta del héroe. Trae su dato + una sugerencia suave, nunca imperativo
 * duro ni culpa. Solo aparece si realmente quedó por debajo de brillante —
 * un día redondo no necesita esta sección.
 */
export type DayWeak = { key: DimensionKey; label: string; value: string; suggestion: string }

const WEAK_SUGGESTION: Record<DimensionKey, string> = {
  sueno: 'Intenta descansar un poco más esta noche.',
  energia: 'Un respiro hoy puede ayudar a recargar.',
  alimento: 'Una comida más completa suma a tu día.',
  mente: 'Date un momento de calma cuando puedas.',
  cuerpo: 'Un poco de movimiento suave también cuenta.',
  ciclo: 'Estos días tu cuerpo pide ir con calma.',
}

function weakValue(key: DimensionKey, s: DailySignals): string {
  const desc = CHIP_DESCRIPTORS.find((d) => d.dim === key)
  const raw = desc ? desc.value(s) : ''
  return key === 'sueno' ? `${raw} registradas` : raw
}

export function weakestToday(
  dims: Dimension[],
  signals: DailySignals | null,
  opts?: { excludeKey?: DimensionKey },
): DayWeak | null {
  if (!signals) return null
  const candidates = dims.filter(
    (d) =>
      d.registered &&
      d.key !== 'ciclo' &&
      d.key !== opts?.excludeKey &&
      d.brightness < TONE_BRILLANTE,
  )
  if (candidates.length === 0) return null
  const low = candidates.reduce((a, b) => (b.brightness < a.brightness ? b : a))
  return {
    key: low.key,
    label: DIM_TITLE[low.key],
    value: weakValue(low.key, signals),
    suggestion: WEAK_SUGGESTION[low.key],
  }
}

/* ── "Tu enfoque para mañana" ─────────────────────────────────────────
 *
 * Un solo foco cálido derivado de lo que menos apareció hoy. Mira adelante
 * sin prescribir un plan; nombra qué destrabaría el resto. `null` cuando no
 * hay una dimensión floja que enfocar (día redondo).
 */
const TOMORROW_FOCUS: Record<DimensionKey, string> = {
  sueno: 'Dormir mejor hará que todo lo demás sea más fácil.',
  energia: 'Recuperar energía le abre paso al resto del día.',
  alimento: 'Cuidar tu comida sostiene todo lo demás.',
  mente: 'Una mente en calma facilita el resto.',
  cuerpo: 'Mover el cuerpo destraba el resto del día.',
  ciclo: 'Acompañar a tu cuerpo estos días lo facilita todo.',
}

export function tomorrowFocus(weak: DayWeak | null): string | null {
  return weak ? TOMORROW_FOCUS[weak.key] : null
}

/* ── Fecha larga en español ───────────────────────────────────────────
 *
 * "Viernes, 16 de mayo" a partir de un 'YYYY-MM-DD'. Determinística (no
 * depende de Intl/locale del device); parsea como UTC para no correrse de
 * día por timezone. */
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

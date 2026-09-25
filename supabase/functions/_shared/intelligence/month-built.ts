/*
 * Órbita · Mes — "¿En qué me estoy transformando?".
 *
 * DELIMITACIÓN de los 3 motores del mes (V-10 · decisión dueña 23 jul 2026,
 * cierra el ADR 0002): este módulo es EL MOTOR DE EVIDENCIA del mes (KPI
 * días en déficit, calendario, promedios, patrones accionables, presencia,
 * reveals). `month.ts` = la narrativa dimensional ("El Cielo": niveles,
 * tendencia, tema, voz). `month-patterns.ts` = hábitos de cadencia (qué
 * días entrenas, forma de la semana, tipo `Patron`). No se solapan: cada
 * superficie consume el suyo. Convergido desde features/orbit/ (re-export
 * fino allá); desde aquí la IA server-side puede reusar sus detectores.
 *
 * Lógica pura y DETERMINÍSTICA (sin IA) sobre ~30 días de daily_signals. Ver
 * docs/orbita-mes-spec.md (fuente de verdad). Filosofía: Órbita NO es un
 * dashboard; hace VISIBLE LO INVISIBLE. Se separan dos sistemas:
 *   · TRANSFORMACIÓN → lo que mueve hacia la pérdida de peso: déficit, proteína,
 *     movimiento, sueño, agua. El KPI primario es DÍAS EN DÉFICIT.
 *   · PRESENCIA      → abrir/registrar/volver. Importa (la constancia importa),
 *     pero NO se confunde con progreso físico.
 *
 * Piezas:
 *   · daysInDeficit      → KPI primario "Días en déficit" (denominador = días
 *                          con comida registrada, NO días del mes → no castiga
 *                          el no-registro y mantiene Presencia aparte).
 *   · monthAverages      → "Tus promedios del mes": resumen real (calorías,
 *                          déficit, proteína, sueño, agua, entrenos). Reemplaza
 *                          la lista de "días registrados" (info que ya sabe).
 *   · detectMonthPatterns → "Haz visible lo invisible" (kind 'discovery') +
 *                          "Tus patrones" accionables (kind 'pattern'): déficit
 *                          entre semana, superávit en finde, sueño×déficit,
 *                          entreno×proteína. Cada uno con su evidencia; nada se
 *                          afirma sin datos que lo sostengan (guardas de
 *                          honestidad). Voz Observadora: describe, no aconseja.
 *   · bestDayEvidence    → "Tus mejores días" CON evidencia (déficit X/Y, ~kcal,
 *                          ~proteína, entrenó N). Nunca una afirmación pelada.
 *   · presenceSummary    → el sistema Presencia, separado.
 *   · habitReveal        → "Tu evolución" + "Lo que aún no sabemos": conteo de
 *                          días por dimensión (qué iluminó la constelación).
 *   · finalPhrase        → la frase de cierre, elegida por la evidencia.
 *
 * Definición de "día en déficit" (fuente única, reusada de Día): un día con
 * comida cuyo `calories` cae en [0.6 × target, target]. El piso 60% evita
 * celebrar restricción extrema (manifiesto). Ver healthyDeficit en day-state.ts.
 *
 * Toda comparación de día-de-semana se parsea en UTC (como el resto del repo)
 * para no correrse de día por timezone.
 */
import {
  detectProteinConsistency,
  detectSleepConsistency,
  detectTrainingConsistency,
} from './consistency.ts'

import type { DailySignals } from './types.ts'
import { DEFICIT_FLOOR_RATIO, isDeficitDay } from './deficit.ts'
// Detección por TIPO de entreno — lógica en _shared/intelligence (fuente de
// verdad del motor); aquí solo se adapta a las tarjetas de Mes.
import { workoutTypeDeficitSplit, workoutTypeMix, workoutTypeMixPhrase } from './workout-type.ts'
// Meta de agua diaria: fuente única en _shared/intelligence/water.ts (T2.2).
import { WATER_GOAL_GLASSES } from './water.ts'

/** Re-export para compatibilidad: la meta de agua vive en _shared (./water). */
export { WATER_GOAL_GLASSES }

// Re-export para compatibilidad: la definición vive en ./deficit (fuente única
// del "día en déficit", compartida por Día/Semana/Mes).
export { DEFICIT_FLOOR_RATIO }

/** Minutos de sueño para considerar la noche "≥ 7 h" (evidencia de calidad). */
const SLEEP_7H_MIN = 420

/** Mínimo de días registrados para arriesgar cualquier patrón — debajo de esto
 *  el mes apenas se forma y un "patrón" sería ruido. */
const PATTERN_MIN_DAYS = 8

/** Día de la semana 0=lunes … 6=domingo (UTC, timezone-independiente). */
function weekdayMon(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** `YYYY-MM-DD` desplazada n días (UTC). */
function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const avg = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/** ¿El día trae alguna señal? (las filas existen solo para días registrados,
 *  pero lo verificamos por si acaso). La energía cuenta para PRESENCIA (un día
 *  con energía registrada es un día presente), aunque ya no sea una dimensión
 *  de transformación visible en Mes. */
function appeared(s: DailySignals): boolean {
  return (
    s.trained === true ||
    s.rested === true ||
    (s.meal_count ?? 0) > 0 ||
    s.sleep_minutes != null ||
    s.energy != null ||
    s.mood != null ||
    s.stress != null ||
    s.motivation != null ||
    (s.water_glasses ?? 0) > 0 ||
    s.on_period === true
  )
}

function loggedDays(signals: readonly DailySignals[]): DailySignals[] {
  return signals.filter((s) => s.day != null && appeared(s))
}

/** Días con dato de calorías (comida registrada con energía). Denominador del
 *  KPI de déficit y base de los patrones de calorías. */
function foodDays(signals: readonly DailySignals[]): DailySignals[] {
  return loggedDays(signals).filter((s) => s.calories != null && s.calories > 0)
}

/** Día más reciente (string ISO) entre un conjunto de días. */
function latestDay(days: readonly DailySignals[]): string | null {
  let max: string | null = null
  for (const s of days) if (s.day && (max == null || s.day > max)) max = s.day
  return max
}

/** Racha más larga y racha actual (consecutiva en calendario) sobre un conjunto
 *  de fechas-bandera. `anchor` ancla la racha "actual": cuenta hacia atrás desde
 *  ahí (0 si `anchor` no cumple la bandera). */
function streaksOver(
  flagDates: readonly string[],
  anchor: string | null,
): { longest: number; current: number } {
  if (flagDates.length === 0 || anchor == null) return { longest: 0, current: 0 }
  const set = new Set(flagDates)
  const sorted = [...set].sort()
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  let longest = 0
  let run = 0
  for (let d = first; d <= last; d = shiftDay(d, 1)) {
    if (set.has(d)) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 0
    }
  }
  let current = 0
  for (let d = anchor; set.has(d); d = shiftDay(d, -1)) current += 1
  return { longest, current }
}

/* ── KPI primario · "Días en déficit" ────────────────────────────────── */

export type DeficitSummary = {
  /** Días en déficit sano. */
  deficitDays: number
  /** Denominador: días con comida registrada (NO días del mes). */
  foodLoggedDays: number
  /** Días por encima de la meta de calorías ("me pasé"). */
  overDays: number
  /** deficitDays / foodLoggedDays (0..1). */
  rate: number
  /** Déficit promedio (target − consumo) sobre los días con comida. Puede ser
   *  negativo si en promedio hubo superávit; la UI decide cómo mostrarlo. */
  avgDeficitKcal: number
  /** Déficit promedio SOLO en los días que sí fueron déficit (intensidad diaria
   *  de esos días). Acotado por el piso 60%, así que nunca premia comer de menos.
   *  0 si no hubo días en déficit. Es la "conclusión" que la usuaria pedía como
   *  "déficit total", sin ser una suma gastable. */
  avgOnDeficitDays: number
}

/** El objetivo primario de la app, hecho visible. `null` si no hay meta de
 *  calorías o si aún no hay días con comida registrada. */
export function daysInDeficit(
  signals: readonly DailySignals[],
  opts: { calorieTarget?: number | null },
): DeficitSummary | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const days = foodDays(signals)
  if (days.length === 0) return null
  let deficitDays = 0
  let overDays = 0
  let deltaSum = 0
  let deficitDeltaSum = 0
  for (const s of days) {
    if (isDeficitDay(s.calories, target)) {
      deficitDays += 1
      deficitDeltaSum += target - s.calories!
    }
    if (s.calories! > target) overDays += 1
    deltaSum += target - s.calories!
  }
  return {
    deficitDays,
    foodLoggedDays: days.length,
    overDays,
    rate: deficitDays / days.length,
    avgDeficitKcal: Math.round(deltaSum / days.length),
    avgOnDeficitDays: deficitDays > 0 ? Math.round(deficitDeltaSum / deficitDays) : 0,
  }
}

/* ── Veredicto del mes — ¿buen mes o no?, de un vistazo ───────────────── */

/** Una lectura cualitativa del mes (voz Observadora, sin culpa) según cuántos
 *  días con comida te dejaron en déficit. `null` con muy pocos días (la lectura
 *  sería ruido). NUNCA "mes malo": observa, no juzga. */
export function monthVerdict(d: DeficitSummary): string | null {
  if (d.foodLoggedDays < 8) return null
  if (d.rate >= 0.7) return 'Estuviste en déficit casi todo el mes.'
  if (d.rate >= 0.5) return 'Más días en déficit que fuera de él.'
  if (d.rate >= 0.3) return 'Un mes parejo entre déficit y exceso.'
  return 'Este mes comiste más cerca de tu mantenimiento.'
}

/* ── Proteína: ¿llegué a mi meta? ─────────────────────────────────────── */

export type ProteinAdherence = {
  /** Días que alcanzaron la meta de proteína. */
  hit: number
  /** Días con proteína registrada (denominador). */
  logged: number
}

/** ¿Cuántos días llegaste a tu meta de proteína? `null` sin meta o sin días con
 *  proteína registrada. */
export function proteinAdherence(
  signals: readonly DailySignals[],
  opts: { proteinTarget?: number | null },
): ProteinAdherence | null {
  const target = opts.proteinTarget ?? null
  if (target == null || target <= 0) return null
  const days = loggedDays(signals).filter((s) => s.protein_g != null)
  if (days.length === 0) return null
  return { hit: days.filter((s) => s.protein_g! >= target).length, logged: days.length }
}

/* ── "Tu evolución" / "Lo que aún no sabemos" — días por dimensión ───── */
/* Conteo de días con evidencia por dimensión. Cada categoría ilumina una parte
 * de la constelación. `colorKey` mapea al tono de dimensión en el componente
 * (ver BAR_COLOR). Energía YA NO es una dimensión: era subjetiva/derivada y
 * duplicaba peso visual (ver doc). */

export type HabitReveal = {
  key: string
  label: string
  /** Label compacto para columnas de ancho fijo (ej. "Registro"), para no
   *  truncar. Igual a `label` salvo donde el nombre largo no cabe. */
  shortLabel: string
  colorKey: string
  count: number
}

type RevealHabit = {
  key: string
  label: string
  shortLabel?: string
  colorKey: string
  has: (s: DailySignals) => boolean
}

const REVEAL_HABITS: readonly RevealHabit[] = [
  {
    key: 'cuerpo',
    label: 'Movimiento',
    colorKey: 'cuerpo',
    has: (s) => s.trained === true || s.rested === true,
  },
  { key: 'sueno', label: 'Sueño', colorKey: 'sueno', has: (s) => s.sleep_minutes != null },
  {
    key: 'comida',
    label: 'Registro de comida',
    shortLabel: 'Registro',
    colorKey: 'comida',
    has: (s) => (s.meal_count ?? 0) > 0,
  },
  { key: 'proteina', label: 'Proteína', colorKey: 'proteina', has: (s) => s.protein_g != null },
  { key: 'agua', label: 'Agua', colorKey: 'agua', has: (s) => (s.water_glasses ?? 0) > 0 },
  // Energía FUERA: no es una señal independiente (es subjetiva/derivada) y
  // duplicaba peso visual junto a proteína/sueño/etc. Sigue viviendo en Hoy.
  // Ciclo tampoco entra: es CONTEXTO (derivado del inicio de período), no una
  // señal de presencia/hábito. Ver memoria: ciclo-is-context-not-habit.
]

/** Días con evidencia por dimensión, de mayor a menor. La partición
 *  conocido/«aún no sabemos» (umbral mínimo) la decide el componente. */
export function habitReveal(signals: readonly DailySignals[]): HabitReveal[] {
  const days = loggedDays(signals)
  return REVEAL_HABITS.map((h) => ({
    key: h.key,
    label: h.label,
    shortLabel: h.shortLabel ?? h.label,
    colorKey: h.colorKey,
    count: days.filter(h.has).length,
  })).sort((a, b) => b.count - a.count)
}

/* ── "Tu mes de un vistazo" — el calendario de déficit ───────────────── */
/* Un calendario del mes en curso donde cada día es un círculo: verde = déficit,
 * rosa = superávit, gris = sin datos, anillo = muy bajo (registró pero por
 * debajo del piso del 60%, que NO se celebra). Responde de un vistazo "¿en qué
 * días estuve en déficit?". El conteo es de ESTE mes (no de la ventana). */

export type DayStatus = 'deficit' | 'surplus' | 'low' | 'none'
export type CalendarDay = {
  /** Día del mes 1..31. */
  day: number
  date: string
  status: DayStatus
  /** Día aún por venir (después de hoy). */
  future: boolean
  /** ¿Es hoy? (ancla temporal del calendario). */
  isToday: boolean
}
export type MonthCalendar = {
  /** Celdas vacías antes del día 1 para alinear a la semana (0..6, lunes-base). */
  leadOffset: number
  days: CalendarDay[]
  deficitDays: number
  /** Días con dato de calorías este mes (denominador del conteo). */
  dataDays: number
  /** ¿Hubo días "muy bajos"? (para mostrar su nota en la leyenda). */
  hasLow: boolean
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendario del mes en curso, anclado a `today` (determinístico). `null` si no
 *  hay meta de calorías o si el mes aún no tiene un solo día con comida. */
export function monthCalendar(
  signals: readonly DailySignals[],
  opts: {
    today: string
    calorieTarget?: number | null
    /** Primer día con datos de la usuaria (ventana 90d del caller). Su
     *  primer día suele ser un registro parcial (instaló a media tarde):
     *  clasificarlo "muy bajo" es un falso positivo que se lee como regaño
     *  retroactivo. Ese día se pinta neutro. */
    firstDataDay?: string | null
  },
): MonthCalendar | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const monthStr = opts.today.slice(0, 7) // 'YYYY-MM'
  const year = Number(opts.today.slice(0, 4))
  const month = Number(opts.today.slice(5, 7)) // 1..12
  const todayDay = Number(opts.today.slice(8, 10))
  if (!year || !month) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const wd = new Date(`${monthStr}-01T00:00:00Z`).getUTCDay() // 0=dom..6=sáb
  const leadOffset = (wd + 6) % 7 // lunes-base

  const byDay = new Map<string, DailySignals>()
  for (const s of signals) if (s.day) byDay.set(s.day, s)

  const days: CalendarDay[] = []
  let deficitDays = 0
  let dataDays = 0
  let hasLow = false
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthStr}-${pad2(d)}`
    const future = d > todayDay
    const s = byDay.get(date)
    const cals = s?.calories ?? null
    let status: DayStatus = 'none'
    if (!future && cals != null && cals > 0) {
      if (isDeficitDay(cals, target)) status = 'deficit'
      else if (cals > target) status = 'surplus'
      // Guard de arranque (5.3): el primer día con datos no se marca "muy
      // bajo" (cuenta como registrado, sin anillo ni nota).
      else if (date !== opts.firstDataDay) status = 'low' // registró pero < 60% del target
      dataDays += 1
      if (status === 'deficit') deficitDays += 1
      if (status === 'low') hasLow = true
    }
    days.push({ day: d, date, status, future, isToday: d === todayDay })
  }
  if (dataDays === 0) return null
  return { leadOffset, days, deficitDays, dataDays, hasLow }
}

/* ── Héroe · "Lo que se reveló este mes" / "Falta revelar" ───────────── */
/* Las dos listas bajo la constelación: qué dimensiones alcanzaron su constancia
 * este mes (★, "reveladas") y cuáles aún no (○). Una dimensión sin meta
 * (déficit/proteína sin target) no puede revelarse: cae en "falta". */

export type RevealItem = {
  key: string
  /** Frase cuando está revelada ("Déficit constante") o nombre corto cuando
   *  falta ("Déficit"). La elige `monthReveals` según el estado. */
  label: string
  colorKey: string
  /** Días concretos que sostuvieron esta dimensión este mes — el ancla que hace
   *  entendible el logro ("18 días", no solo "Déficit constante"). */
  count: number
  /** Denominador HONESTO: días en que la dimensión pudo contar (registrados de
   *  ESA señal), nunca días del mes. La barra dibuja count/total. */
  total: number
}
export type MonthReveals = { revealed: RevealItem[]; pending: RevealItem[] }

/** Umbral de días para considerar una dimensión "revelada" (constante). El
 *  mismo valor que el motor de consistencia (`MONTH_CONSISTENT_MIN`). */
const REVEAL_MIN = 8

export function monthReveals(
  signals: readonly DailySignals[],
  opts: {
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
): MonthReveals {
  const days = loggedDays(signals)
  const c = monthConsistency(signals, { proteinTarget: opts.proteinTarget })
  const ct = opts.calorieTarget ?? null
  const pt = opts.proteinTarget ?? null
  const wg = Math.max(1, opts.waterGoalGlasses ?? WATER_GOAL_GLASSES)
  const deficitDays =
    ct != null && ct > 0 ? foodDays(signals).filter((s) => isDeficitDay(s.calories, ct)).length : 0
  const foodLogged = days.filter((s) => (s.meal_count ?? 0) > 0).length
  const waterDays = days.filter((s) => (s.water_glasses ?? 0) >= wg).length

  // Denominador HONESTO por dimensión: los días en que ESA señal pudo contar
  // (registrados de esa dimensión), NUNCA los días del mes — "16 de 30" se
  // leería como "fallaste 14" (culpa). Base de la barra de proporción del hero.
  const presentN = days.length
  const foodN = foodDays(signals).length
  const sleepLogged = days.filter((s) => s.sleep_minutes != null).length
  const proteinLogged = days.filter((s) => s.protein_g != null).length
  const totalOf: Record<string, number> = {
    deficit: foodN,
    sueno: sleepLogged,
    registro: foodLogged,
    proteina: proteinLogged,
    agua: presentN,
    movimiento: presentN,
  }

  const defs: {
    key: string
    colorKey: string
    on: string
    off: string
    revealed: boolean
    count: number
  }[] = [
    {
      key: 'deficit',
      colorKey: 'deficit',
      on: 'Déficit constante',
      off: 'Déficit',
      revealed: ct != null && ct > 0 && deficitDays >= REVEAL_MIN,
      count: deficitDays,
    },
    {
      key: 'sueno',
      colorKey: 'sueno',
      on: 'Sueño estable',
      off: 'Sueño',
      revealed: c.sleep.detected,
      count: c.sleep.count,
    },
    {
      key: 'registro',
      colorKey: 'comida',
      on: 'Registro diario',
      off: 'Registro',
      revealed: foodLogged >= REVEAL_MIN,
      count: foodLogged,
    },
    {
      key: 'proteina',
      colorKey: 'proteina',
      on: 'Proteína en meta',
      off: 'Proteína',
      revealed: pt != null && pt > 0 && c.protein.detected,
      count: c.protein.count,
    },
    {
      key: 'agua',
      colorKey: 'agua',
      on: 'Hidratación constante',
      off: 'Agua',
      revealed: waterDays >= REVEAL_MIN,
      count: waterDays,
    },
    {
      key: 'movimiento',
      colorKey: 'cuerpo',
      on: 'Movimiento constante',
      off: 'Movimiento',
      revealed: c.training.detected,
      count: c.training.count,
    },
  ]

  const item = (d: (typeof defs)[number], on: boolean): RevealItem => ({
    key: d.key,
    label: on ? d.on : d.off,
    colorKey: d.colorKey,
    count: d.count,
    total: Math.max(d.count, totalOf[d.key] ?? presentN),
  })

  return {
    revealed: defs.filter((d) => d.revealed).map((d) => item(d, true)),
    pending: defs.filter((d) => !d.revealed).map((d) => item(d, false)),
  }
}

/** Umbral mínimo de días para que una dimensión pendiente sea "foco" (lo más
 *  cerca de encenderse). Por debajo, mostrarla presionaría (un "1 de 8"). */
const FOCUS_MIN_DAYS = 4

export type RevealFocus = {
  key: string
  /** Nombre corto de la dimensión ("Sueño", "Agua"…). */
  label: string
  /** Días acumulados hacia el umbral y el umbral mismo. */
  count: number
  threshold: number
}

/**
 * "Lo más cerca de encender" — la dimensión pendiente más cercana al umbral
 * (meta-gradient: la cercanía motiva). El déficit (el norte) tiene prioridad si
 * está pendiente y calificado. `null` si nada está lo bastante cerca (evita
 * presionar en día 3). Es una RECOMENDACIÓN de foco, no una orden (regla nueva).
 * Excluye 'registro' (vive en Presencia, no es transformación).
 */
export function revealFocus(reveals: MonthReveals): RevealFocus | null {
  const cands = reveals.pending.filter(
    (p) => p.key !== 'registro' && p.count >= FOCUS_MIN_DAYS && p.count < REVEAL_MIN,
  )
  if (cands.length === 0) return null
  cands.sort((a, b) => (a.key === 'deficit' ? -1 : b.key === 'deficit' ? 1 : b.count - a.count))
  const top = cands[0]!
  return { key: top.key, label: top.label, count: top.count, threshold: REVEAL_MIN }
}

/* ── Evidencia de un reveal: los DÍAS concretos en que la dimensión contó ────
 * La prueba al tocar una fila de "Lo que sostuviste este mes": las fechas reales
 * (para un mini calendario), por dimensión. Predicado por día simple y honesto
 * (mismo criterio que se muestra en el modal), determinístico. */
export type RevealDayMap = Record<string, string[]>

export function revealDayMap(
  signals: readonly DailySignals[],
  opts: {
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
): RevealDayMap {
  const ct = opts.calorieTarget ?? null
  const pt = opts.proteinTarget ?? null
  const wg = Math.max(1, opts.waterGoalGlasses ?? WATER_GOAL_GLASSES)
  const pred: Record<string, (s: DailySignals) => boolean> = {
    deficit: (s) => ct != null && ct > 0 && isDeficitDay(s.calories, ct),
    sueno: (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN,
    registro: (s) => (s.meal_count ?? 0) > 0,
    proteina: (s) => pt != null && pt > 0 && s.protein_g != null && s.protein_g >= pt,
    agua: (s) => (s.water_glasses ?? 0) >= wg,
    movimiento: (s) => s.trained === true,
  }
  const out: RevealDayMap = {}
  for (const key of Object.keys(pred)) out[key] = []
  for (const s of signals) {
    if (s.day == null) continue
    for (const key of Object.keys(pred)) {
      if (pred[key]!(s)) out[key]!.push(s.day)
    }
  }
  for (const key of Object.keys(out)) out[key]!.sort()
  return out
}

/* ── "Cómo cambió tu mes" — el timeline semanal ──────────────────────── */
/* Responde una sola pregunta: "¿cambió algo este mes?". Por categoría, los
 * "buenos días" de cada una de las 4 últimas semanas (de 7 días), y una
 * conclusión calculada SOLO con esos datos (nunca inventada). Reemplaza el
 * viejo "Tu evolución" (cielo de puntos): aquí la evidencia es la protagonista,
 * no el gráfico. */

export type WeekBar = {
  /** 1 = la más antigua de las 4 · 4 = la más reciente (termina hoy). */
  week: number
  /** "Buenos días" de la categoría esa semana (la señal pasó). */
  count: number
  /** Días en que la dimensión se REGISTRÓ esa semana (denominador honesto). Un
   *  día "apagado" solo cuenta si está registrado: así "no registré" nunca se
   *  ve como "no logré". Siempre `>= count`. */
  registered: number
  /** Días de la ventana semanal (7). */
  total: number
  /** El DOMINGO (ISO) de esta semana — el ancla del drill-down a Órbita Semana.
   *  Para la semana en curso puede caer en el futuro; la UI usa `null` en ese
   *  caso (abre Semana en modo normal, no histórico). */
  weekEnd: string
}

export type MonthChangeCategory = {
  key: string
  label: string
  colorKey: string
  weeks: WeekBar[]
  /** Conclusión basada en datos (cómo cambió). */
  conclusion: string
  /** true = avance (la UI marca con ▲ + glow). */
  improved: boolean
}

/** Días de calendario entre `day` y `today` (today − day). */
function offsetDays(day: string, today: string): number {
  const a = new Date(`${day}T00:00:00Z`).getTime()
  const b = new Date(`${today}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

const ORDINAL_WEEK = ['primera', 'segunda', 'tercera', 'cuarta'] as const

/** Frase "más días …" por categoría (avance / inicio del mes). */
const MORE_LABEL: Record<string, string> = {
  deficit: 'más días en déficit',
  proteina: 'más días con tu proteína en meta',
  sueno: 'más noches de buen sueño',
  agua: 'más días con tu agua completa',
  entreno: 'más días de movimiento',
}
/** Sujeto para la frase "se mantuvo parejo". */
const STEADY_SUBJECT: Record<string, string> = {
  deficit: 'Tu déficit se mantuvo parejo todo el mes.',
  proteina: 'Tu proteína se mantuvo pareja todo el mes.',
  sueno: 'Tu sueño se mantuvo parejo todo el mes.',
  agua: 'Tu agua se mantuvo pareja todo el mes.',
  entreno: 'Tu movimiento se mantuvo parejo todo el mes.',
}

/** Conclusión calculada SOLO con los 4 conteos semanales. Nunca inventa: si no
 *  hay con qué comparar, lo dice. */
function conclusionFor(key: string, counts: number[]): { text: string; improved: boolean } {
  const first = counts[0]!
  const last = counts[3]!
  const total = counts.reduce((a, b) => a + b, 0)
  if (total < 3) return { text: 'Aún hay poco con qué comparar.', improved: false }

  if (last - first >= 2) {
    // ¿Hay una semana donde arrancó el cambio (salto sostenido a media tabla)?
    for (let i = 1; i < 3; i++) {
      if (counts[i]! - counts[i - 1]! >= 2) {
        return { text: `El cambio comenzó en la ${ORDINAL_WEEK[i]} semana.`, improved: true }
      }
    }
    return { text: `Terminaste el mes con ${MORE_LABEL[key]}.`, improved: true }
  }
  if (first - last >= 2) {
    // Sin culpa: el SUJETO es el tiempo, no la persona ("Tuviste…" señalaba a
    // la usuaria). Observa, no juzga.
    return { text: `El inicio del mes concentró ${MORE_LABEL[key]}.`, improved: false }
  }
  // Pico claro de una semana sobre el resto. "Más consistente", no "mejor"
  // (describe, no califica las demás como peores).
  const max = Math.max(...counts)
  const bestWeek = counts.indexOf(max)
  const rest = counts.filter((_, i) => i !== bestWeek)
  if (max - Math.max(...rest) >= 2) {
    return { text: `La ${ORDINAL_WEEK[bestWeek]} semana fue la más consistente.`, improved: true }
  }
  return { text: STEADY_SUBJECT[key]!, improved: false }
}

type ChangeDef = {
  key: string
  label: string
  colorKey: string
  available: boolean
  /** La señal pasó ese día (buen día). */
  qualifies: (s: DailySignals) => boolean
  /** La dimensión se REGISTRÓ ese día (denominador honesto; `qualifies` lo
   *  implica). Sin esto, un día sin registro contaría como "no logrado". */
  logged: (s: DailySignals) => boolean
}

/** Timeline semanal por categoría. `today` ancla las 4 semanas (28 días que
 *  terminan hoy); Semana 1 = la más antigua, Semana 4 = la actual. Las
 *  categorías sin meta (déficit/proteína sin target) o sin un solo buen día se
 *  omiten. */
export function monthChange(
  signals: readonly DailySignals[],
  opts: {
    today: string
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
): MonthChangeCategory[] {
  const ct = opts.calorieTarget ?? null
  const pt = opts.proteinTarget ?? null
  const wg = opts.waterGoalGlasses ?? WATER_GOAL_GLASSES
  const byDay = new Map<string, DailySignals>()
  for (const s of signals) if (s.day) byDay.set(s.day, s)

  const defs: ChangeDef[] = [
    {
      key: 'deficit',
      label: 'Déficit',
      colorKey: 'deficit',
      available: ct != null && ct > 0,
      qualifies: (s) => isDeficitDay(s.calories, ct),
      logged: (s) => s.calories != null && s.calories > 0,
    },
    {
      key: 'proteina',
      label: 'Proteína',
      colorKey: 'proteina',
      available: pt != null && pt > 0,
      qualifies: (s) => s.protein_g != null && s.protein_g >= pt!,
      logged: (s) => s.protein_g != null,
    },
    {
      key: 'sueno',
      label: 'Sueño',
      colorKey: 'sueno',
      available: true,
      qualifies: (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN,
      logged: (s) => s.sleep_minutes != null,
    },
    {
      key: 'agua',
      label: 'Agua',
      colorKey: 'agua',
      available: true,
      qualifies: (s) => (s.water_glasses ?? 0) >= Math.max(1, wg),
      logged: (s) => (s.water_glasses ?? 0) > 0,
    },
    {
      key: 'entreno',
      label: 'Entrenamiento',
      colorKey: 'cuerpo',
      available: true,
      qualifies: (s) => s.trained === true,
      logged: (s) => s.trained != null,
    },
  ]

  // Semanas ISO (lun-dom), no ventanas rodantes: cada bucket es una semana
  // calendario real → alinea con Órbita Semana para el drill-down. bucket 4 = la
  // semana ISO en curso; 1 = tres semanas atrás. `weekEnds[i]` = el domingo ISO
  // de cada bucket (el ancla del drill-down).
  const monToday = shiftDay(opts.today, -weekdayMon(opts.today)) // lunes de esta semana
  const weekEnds = [0, 1, 2, 3].map((i) => shiftDay(shiftDay(monToday, -(3 - i) * 7), 6))

  const out: MonthChangeCategory[] = []
  for (const def of defs) {
    if (!def.available) continue
    const counts = [0, 0, 0, 0]
    const registered = [0, 0, 0, 0]
    for (const [day, s] of byDay) {
      const monDay = shiftDay(day, -weekdayMon(day)) // lunes de la semana de `day`
      const weeksBack = offsetDays(monDay, monToday) / 7 // 0 = esta semana ISO
      if (weeksBack < 0 || weeksBack > 3) continue
      const week = 4 - weeksBack // 1..4 (4 = la semana ISO en curso)
      if (def.logged(s)) registered[week - 1]! += 1
      if (def.qualifies(s)) counts[week - 1]! += 1
    }
    if (counts.reduce((a, b) => a + b, 0) < 1) continue // sin un solo buen día → fuera
    const { text, improved } = conclusionFor(def.key, counts)
    out.push({
      key: def.key,
      label: def.label,
      colorKey: def.colorKey,
      weeks: counts.map((c, i) => ({
        week: i + 1,
        count: c,
        registered: registered[i]!,
        total: 7,
        weekEnd: weekEnds[i]!,
      })),
      conclusion: text,
      improved,
    })
  }
  return out
}

/** Resumen automático de "Así cambió tu mes". El DÉFICIT es el norte (proxy de
 *  peso): si bajó de forma marcada, el cierre lo NOMBRA — nunca celebrar una
 *  dimensión secundaria callando que el norte cayó (sería animar, no observar).
 *  Voz Observadora: el sujeto es el tiempo, sin culpa. `null` sin categorías. */
export function monthShiftSummary(categories: readonly MonthChangeCategory[]): string | null {
  if (categories.length === 0) return null
  const deltaOf = (c: MonthChangeCategory) => (c.weeks[3]?.count ?? 0) - (c.weeks[0]?.count ?? 0)
  const deficit = categories.find((c) => c.key === 'deficit')
  const rose = categories
    .map((c) => ({ c, delta: deltaOf(c) }))
    .filter((x) => x.delta >= 2)
    .sort((a, b) => b.delta - a.delta)

  // El norte bajó: nombrarlo (honesto, sin culpa). Si además algo emergió al
  // final, se reconoce, pero sin usarlo para tapar la caída.
  if (deficit && deltaOf(deficit) <= -2) {
    const other = rose.find((x) => x.c.key !== 'deficit')
    const base = 'Tu déficit apareció más al inicio del mes que al final'
    return other
      ? `${base}; al final emergieron ${MORE_LABEL[other.c.key] ?? other.c.label.toLowerCase()}.`
      : `${base}.`
  }

  if (rose.length === 0) {
    // Nada subió de forma marcada (ni el norte bajó): neutral, sin culpa.
    return 'Tu mes se mantuvo parejo de principio a fin.'
  }
  // Si el déficit subió, va primero (es el norte).
  rose.sort((a, b) => (a.c.key === 'deficit' ? -1 : b.c.key === 'deficit' ? 1 : b.delta - a.delta))
  const phrases = rose.slice(0, 2).map((x) => MORE_LABEL[x.c.key] ?? x.c.label.toLowerCase())
  const list = phrases.length === 2 ? `${phrases[0]} y ${phrases[1]}` : phrases[0]
  return `Al final del mes aparecieron ${list}.`
}

/* ── "Así se movió tu déficit" — conclusión + foco (accionable, no prescriptivo) ──
 * La trayectoria del NORTE por mitades (inicio vs final): una conclusión clara
 * (el "qué me dice") + un foco de atención (el "para la próxima") que la usuaria
 * DEDUCE. Manifiesto-safe: el sujeto es el tiempo, no la persona; el foco señala
 * DÓNDE mirar (un momento suyo), nunca QUÉ hacer. Ver docs/orbita-mes-spec.md §8.
 */
export type DeficitTrajectory = {
  state: 'grew' | 'faded' | 'steady' | 'low'
  /** La conclusión (el héroe en palabras). */
  takeaway: string
  /** Eyebrow del foco ("Para la próxima" / "Lo que esto dice"), o null en low. */
  focusLabel: string | null
  /** El foco de atención (invitación a observar), o null en low. */
  focus: string | null
}

/** Lee la trayectoria del déficit (4 semanas) como conclusión + foco. `counts`
 *  son los días en déficit por semana [S1..S4] (S4 = más reciente). */
export function deficitTrajectoryRead(counts: readonly number[]): DeficitTrajectory {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total < 3) {
    return {
      state: 'low',
      takeaway: 'Tu trayectoria del déficit apenas empieza a dibujarse.',
      focusLabel: null,
      focus: null,
    }
  }
  const firstHalf = (counts[0] ?? 0) + (counts[1] ?? 0)
  const secondHalf = (counts[2] ?? 0) + (counts[3] ?? 0)
  if (secondHalf - firstHalf >= 2) {
    return {
      state: 'grew',
      takeaway: 'Tu déficit apareció más al final del mes que al inicio.',
      focusLabel: 'Para la próxima',
      focus: 'Lo que cambió a mitad de mes se está quedando.',
    }
  }
  if (firstHalf - secondHalf >= 2) {
    return {
      state: 'faded',
      takeaway: 'Tu déficit apareció más al inicio del mes que al final.',
      focusLabel: 'Para la próxima',
      focus: 'El próximo mes, tu foco es sostener el déficit en las últimas semanas.',
    }
  }
  return {
    state: 'steady',
    takeaway: 'Tu déficit se sostuvo parejo de principio a fin.',
    focusLabel: 'Lo que esto dice',
    focus: 'Sostener es más difícil que empezar. Este mes lo sostuviste.',
  }
}

/* ── "Tu presencia" — el sistema separado ────────────────────────────── */

/** Un tramo del "hilo de noches": una corrida de días presentes o un hueco. */
export type PresenceSegment = { present: boolean; length: number }

export type PresenceSummary = {
  presentDays: number
  foodDays: number
  longestStreak: number
  currentStreak: number
  /** Veces que volviste tras una pausa = (bloques de días consecutivos) − 1.
   *  0 si registraste sin huecos. Es la evidencia de "volver", no un total. */
  returns: number
  /** El mes como secuencia (RLE) del PRIMER día presente al ÚLTIMO: tramos
   *  presentes y huecos, alternados. Empieza y termina en presente. Es lo que
   *  dibuja el hilo (huecos visibles + regresos encendidos), sin denominador:
   *  el lienzo es tu presencia, no el calendario completo. */
  trail: PresenceSegment[]
}

/** El sistema PRESENCIA, distinto de transformación: abrir/registrar/volver. La
 *  constancia importa, pero no es progreso físico. `null` sin días presentes. */
export function presenceSummary(signals: readonly DailySignals[]): PresenceSummary | null {
  const present = loggedDays(signals)
  if (present.length === 0) return null
  const anchor = latestDay(present)
  const dayStrs = present.map((s) => s.day!)
  const { longest, current } = streaksOver(dayStrs, anchor)

  // "Volver tras una pausa": cuenta los BLOQUES de días consecutivos; cada
  // bloque nuevo (tras un hueco) es un regreso. returns = bloques − 1.
  const sorted = [...new Set(dayStrs)].sort()
  let blocks = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i] !== shiftDay(sorted[i - 1]!, 1)) blocks += 1
  }

  // El hilo (RLE) del primer al último día presente: corridas presentes y
  // huecos alternados. Cada bloque presente tras el primero arranca con un
  // "regreso" → returns = (bloques presentes) − 1, consistente con `blocks`.
  const trail: PresenceSegment[] = []
  const presentSet = new Set(sorted)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first != null && last != null) {
    let seg: PresenceSegment | null = null
    for (let d = first; d <= last; d = shiftDay(d, 1)) {
      const p = presentSet.has(d)
      if (seg && seg.present === p) seg.length += 1
      else {
        if (seg) trail.push(seg)
        seg = { present: p, length: 1 }
      }
    }
    if (seg) trail.push(seg)
  }

  return {
    presentDays: present.length,
    foodDays: foodDays(signals).length,
    longestStreak: longest,
    currentStreak: current,
    returns: Math.max(0, blocks - 1),
    trail,
  }
}

/* ── "Lo que descubrimos" — patrones reales + evidencia ──────────────── */

export type EvidenceBar = {
  label: string
  value: number
  /** Denominador de la barra (días de la ventana). Cuando está presente, el
   *  modal muestra "value / total" para anclar el número. Ausente en barras
   *  relativas (día-de-semana), que se comparan entre sí. */
  total?: number
  highlight?: boolean
  /** Clave de dimensión para tintar la barra (hábitos); ausente en barras de
   *  día-de-semana, que van en oro neutro. */
  colorKey?: string
}
/** Forma por día de la semana: la usuaria VE la silueta de su semana (qué días
 *  sostiene), no solo dos barras agregadas. Sin % crudos por barra (eso se lee
 *  como boletín); la silueta + el lado iluminado bastan. Solo `deficit-daytype`. */
export type WeekdayShape = {
  /** Tasa de déficit + días con dato por día (índice 0=lun … 6=dom). */
  week: { rate: number; total: number }[]
  /** El lado que SOSTIENE (se ilumina en oro); el otro es el margen, atenuado.
   *  Nunca se resalta el día bajo — iluminar tu peor día se lee como culpa. */
  strongSide: 'weekday' | 'weekend'
}

export type MonthPattern = {
  id: string
  /** 'discovery' → "Haz visible lo invisible" (constancia de una dimensión).
   *  'pattern'   → "Tus patrones" (forma temporal / correlación demostrable). */
  kind: 'discovery' | 'pattern'
  /** Encabezado corto de la tarjeta (p. ej. "Movimiento"). El `title` es la
   *  frase observacional que lo describe. */
  label: string
  title: string
  evidence: { bars: EvidenceBar[]; caption: string; unit: string }
  /** Líneas de evidencia extra (ej. rachas, promedios). La tarjeta de discovery
   *  las muestra bajo "La prueba"; opcional. */
  notes?: string[]
  /** El "so what": por qué esto le sirve a la usuaria. En discoveries es "por
   *  qué importa" (la constancia); en patterns es el lever que puede mover (la
   *  acción implícita). Siempre voz Observadora: describe, NO aconseja. */
  why?: string
  /** Solo `deficit-daytype`: la forma por día de semana para la evidencia. */
  weekdayShape?: WeekdayShape
}

/* Patrones POSITIVOS del MOTOR de consistencia (features/patterns/consistency)
 * — la MISMA lógica del reveal semanal de Hoy, aquí sobre la ventana del mes. */
const MONTH_CONSISTENT_MIN = 8
const MONTH_WINDOW_DAYS = 32

/** Fecha más reciente (medianoche local) como ms — ancla de la ventana de los
 *  detectores, derivada de los datos (no de `new Date()`) → determinística. */
function latestDayMs(days: readonly DailySignals[]): number | null {
  const max = latestDay(days)
  return max != null ? new Date(`${max}T00:00:00`).getTime() : null
}

export type MonthConsistency = {
  protein: { detected: boolean; count: number }
  training: { detected: boolean; count: number }
  sleep: { detected: boolean; count: number }
}

/** Corre los detectores del motor (proteína/movimiento/sueño) sobre el mes. */
export function monthConsistency(
  signals: readonly DailySignals[],
  opts?: { proteinTarget?: number | null },
): MonthConsistency {
  const days = loggedDays(signals)
  const nowMs = latestDayMs(days)
  const empty = { detected: false, count: 0 }
  if (nowMs == null) return { protein: empty, training: empty, sleep: empty }
  const win = { windowDays: MONTH_WINDOW_DAYS, minDays: MONTH_CONSISTENT_MIN }
  const targetG = opts?.proteinTarget ?? 0
  const p = detectProteinConsistency(
    days
      .filter((s) => s.protein_g != null)
      .map((s) => ({ date: s.day!, proteinG: s.protein_g!, targetG })),
    nowMs,
    win,
  )
  const t = detectTrainingConsistency(
    days.filter((s) => s.trained === true).map((s) => s.day!),
    nowMs,
    win,
  )
  const sl = detectSleepConsistency(
    days
      .filter((s) => s.sleep_minutes != null)
      .map((s) => ({ date: s.day!, minutes: s.sleep_minutes! })),
    nowMs,
    win,
  )
  return {
    protein: { detected: p.detected, count: p.count },
    training: { detected: t.detected, count: t.count },
    sleep: { detected: sl.detected, count: sl.count },
  }
}

export function detectMonthPatterns(
  signals: readonly DailySignals[],
  opts?: { proteinTarget?: number | null; calorieTarget?: number | null },
): MonthPattern[] {
  const days = loggedDays(signals)
  if (days.length < PATTERN_MIN_DAYS) return []
  const out: MonthPattern[] = []
  const target = opts?.calorieTarget ?? null

  /* ── A · DESCUBRIMIENTOS — constancias positivas (el MOTOR) ────────── */
  // La constancia (proteína/movimiento/sueño) viene de
  // features/patterns/consistency, no de un cálculo paralelo. Solo CONSTANCIAS
  // positivas viven aquí; lo que faltó lo cuentan "Lo que aún no sabemos" y "Tu
  // evolución".
  const c = monthConsistency(signals, { proteinTarget: opts?.proteinTarget })
  const consistencyBars = (highlight: string): EvidenceBar[] => [
    {
      label: 'Proteína',
      value: c.protein.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'proteina',
      highlight: highlight === 'proteina',
    },
    {
      label: 'Movimiento',
      value: c.training.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'cuerpo',
      highlight: highlight === 'cuerpo',
    },
    {
      label: 'Sueño',
      value: c.sleep.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'sueno',
      highlight: highlight === 'sueno',
    },
  ]
  const consistencyCaption = 'Días en que cada señal estuvo presente.'
  if (c.protein.detected) {
    // Prueba extra: la proteína promedio sobre los días con dato.
    const proteinG = days.filter((s) => s.protein_g != null).map((s) => s.protein_g!)
    const notes =
      proteinG.length > 0 ? [`Promedio: ${Math.round(avg(proteinG))} g por día`] : undefined
    out.push({
      id: 'consistent-protein',
      kind: 'discovery',
      label: 'Proteína',
      title: 'Tu proteína se mantuvo consistente.',
      evidence: { bars: consistencyBars('proteina'), caption: consistencyCaption, unit: 'días' },
      notes,
      why: 'Tu proteína fue la base de lo que tu cuerpo sostuvo este mes.',
    })
  }
  if (c.training.detected) {
    // Evidencia extra de MOVIMIENTO: las rachas. Hacen visible la constancia más
    // allá del conteo (la promesa: evidencia, no solo un número).
    const anchor = latestDay(days)
    const { longest, current } = streaksOver(
      days.filter((s) => s.trained === true).map((s) => s.day!),
      anchor,
    )
    // "Continuidad", no "racha": el manifiesto prohíbe el lenguaje de streak
    // (presión/FOMO). Misma información, sin la vara rígida.
    const notes: string[] = []
    if (longest >= 2) notes.push(`Continuidad más larga: ${longest} días`)
    if (current >= 2) notes.push(`Continuidad reciente: ${current} días`)
    // El ECO del tipo que anota en Hoy ("4 de fuerza · 2 de caminata") — vive
    // aquí como evidencia de la constancia, NO como tarjeta suelta (regla
    // anti-conteo-decorativo). Es el dato de la usuaria devuelto con su nombre.
    const mix = workoutTypeMix(days)
    if (mix) notes.push(`Tu mezcla: ${workoutTypeMixPhrase(mix)}`)
    out.push({
      id: 'consistent-training',
      kind: 'discovery',
      label: 'Movimiento',
      title: 'El movimiento fue una de tus constantes.',
      evidence: { bars: consistencyBars('cuerpo'), caption: consistencyCaption, unit: 'días' },
      notes: notes.length ? notes : undefined,
      why: 'Los días que te moviste se acumularon. Eso es lo que se ve aquí.',
    })
  }
  if (c.sleep.detected) {
    // Evidencia extra de SUEÑO: el promedio de horas dormidas — el dato que de
    // verdad sirve ("¿cuánto dormí en promedio?"), sobre las noches registradas.
    const sleepMin = days.filter((s) => s.sleep_minutes != null).map((s) => s.sleep_minutes!)
    const notes: string[] = []
    if (sleepMin.length > 0) {
      const h = Math.round((avg(sleepMin) / 60) * 10) / 10
      notes.push(`Promedio: ${h} h por noche`)
    }
    out.push({
      id: 'consistent-sleep',
      kind: 'discovery',
      label: 'Sueño',
      title: 'Tu sueño se mantuvo estable.',
      evidence: { bars: consistencyBars('sueno'), caption: consistencyCaption, unit: 'días' },
      notes: notes.length ? notes : undefined,
      why: 'Las noches que descansaste bien, el resto del día lo sintió.',
    })
  }

  /* ── B · PATRONES ACCIONABLES (correlaciones demostrables) ─────────── */
  const food = foodDays(signals)

  // B1 · DÓNDE SE SOSTIENE TU DÉFICIT (simétrico) — el "dónde fallas" de la
  // promesa. Compara la tasa de déficit entre semana vs finde; si la brecha es
  // marcada (≥ 20pp) nombra el lado fuerte Y el débil, en cualquier dirección (no
  // solo cuando eres fuerte entre semana). Voz Observadora, sin culpa.
  let daytypeFired = false
  if (target != null && target > 0) {
    const wdFood = food.filter((s) => weekdayMon(s.day!) < 5)
    const weFood = food.filter((s) => weekdayMon(s.day!) >= 5)
    if (wdFood.length >= 4 && weFood.length >= 4) {
      const wdDef = wdFood.filter((s) => isDeficitDay(s.calories, target)).length
      const weDef = weFood.filter((s) => isDeficitDay(s.calories, target)).length
      const rWd = wdDef / wdFood.length
      const rWe = weDef / weFood.length
      if (Math.abs(rWd - rWe) >= 0.2) {
        const weekdayStronger = rWd >= rWe
        daytypeFired = true

        // Silueta por día de semana (0=lun … 6=dom) para la gráfica.
        const wkTotal = Array.from({ length: 7 }, () => 0)
        const wkDef = Array.from({ length: 7 }, () => 0)
        for (const s of food) {
          const wd = weekdayMon(s.day!)
          wkTotal[wd]! += 1
          if (isDeficitDay(s.calories, target)) wkDef[wd]! += 1
        }
        const week = wkTotal.map((t, i) => ({ rate: t ? wkDef[i]! / t : 0, total: t }))

        out.push({
          id: 'deficit-daytype',
          kind: 'pattern',
          label: weekdayStronger ? 'Tu fin de semana' : 'Entre semana',
          // Veredicto en llano: qué te SOSTIENE (fortaleza) + dónde hay MARGEN. Sin
          // jerga ("palanca"/"ancla" confunden); orden fortaleza→margen (sin culpa).
          title: `${weekdayStronger ? 'Entre semana' : 'Tu fin de semana'} te sostiene. ${weekdayStronger ? 'El fin de semana' : 'Entre semana'} es donde tienes margen.`,
          // Cierre accionable = el foco (un día más, alcanzable). La frase que motiva.
          why: `Un día más ${weekdayStronger ? 'el fin de semana' : 'entre semana'} en déficit ya se nota en tu mes.`,
          evidence: {
            bars: [
              {
                label: 'Entre semana',
                value: wdDef,
                total: wdFood.length,
                highlight: weekdayStronger,
              },
              {
                label: 'Fin de semana',
                value: weDef,
                total: weFood.length,
                highlight: !weekdayStronger,
              },
            ],
            caption: 'Días en déficit sobre tus días con comida, según el día.',
            unit: 'días',
          },
          weekdayShape: { week, strongSide: weekdayStronger ? 'weekday' : 'weekend' },
        })
      }
    }
  }

  // B2 · DÓNDE SE CONCENTRA TU SUPERÁVIT (simétrico) — si el exceso vive en un lado
  // (≥ 60% del total real ≥ 1000 kcal), entre semana O finde. Solo si B1 no cubrió
  // ya el mismo insight de día (evita redundancia). Observación, sin culpa.
  if (target != null && target > 0 && !daytypeFired) {
    let wdSurplus = 0
    let weSurplus = 0
    for (const s of food) {
      const over = s.calories! - target
      if (over <= 0) continue
      if (weekdayMon(s.day!) < 5) wdSurplus += over
      else weSurplus += over
    }
    const total = wdSurplus + weSurplus
    const weekendHeavy = weSurplus >= wdSurplus
    const heavy = weekendHeavy ? weSurplus : wdSurplus
    if (total >= 1000 && heavy / total >= 0.6) {
      const pct = Math.round((heavy / total) * 100)
      out.push({
        id: 'surplus-concentration',
        kind: 'pattern',
        label: weekendHeavy ? 'Tu fin de semana' : 'Entre semana',
        title: `El ${pct}% de tu superávit cae ${weekendHeavy ? 'en fin de semana' : 'entre semana'}.`,
        why: `${weekendHeavy ? 'Tus fines de semana' : 'Tus días entre semana'} concentraron el mayor exceso este mes.`,
        evidence: {
          bars: [
            { label: 'Entre semana', value: Math.round(wdSurplus), highlight: !weekendHeavy },
            { label: 'Fin de semana', value: Math.round(weSurplus), highlight: weekendHeavy },
          ],
          caption: 'Calorías por encima de tu meta, según el día.',
          unit: 'kcal',
        },
      })
    }
  }

  // B3 · Sueño ≥ 7 h × déficit — correlación demostrable (describe, NO aconseja:
  // IA de Órbita = Observadora). Solo con ambos buckets poblados y efecto marcado.
  if (target != null && target > 0) {
    const withSleep = food.filter((s) => s.sleep_minutes != null)
    const high = withSleep.filter((s) => s.sleep_minutes! >= SLEEP_7H_MIN)
    const low = withSleep.filter((s) => s.sleep_minutes! < SLEEP_7H_MIN)
    const defHigh = high.filter((s) => isDeficitDay(s.calories, target)).length
    const defLow = low.filter((s) => isDeficitDay(s.calories, target)).length
    if (high.length >= 3 && low.length >= 3) {
      const rateHigh = defHigh / high.length
      const rateLow = defLow / low.length
      if (rateHigh >= rateLow * 1.3 && rateHigh - rateLow >= 0.2) {
        out.push({
          id: 'sleep-deficit',
          kind: 'pattern',
          label: 'Sueño y déficit',
          title: 'Cuando dormiste 7 h o más, alcanzaste tu déficit más seguido.',
          why: 'Una noche más de buen descanso ya se nota en tu mes.',
          evidence: {
            bars: [
              {
                label: '7 h o más',
                value: defHigh,
                total: high.length,
                colorKey: 'sueno',
                highlight: true,
              },
              { label: 'Menos de 7 h', value: defLow, total: low.length, colorKey: 'sueno' },
            ],
            caption: 'Días en déficit según cuánto dormiste esa noche.',
            unit: 'días',
          },
        })
      }
    }
  }

  // B4 · Entreno × proteína — correlación demostrable. Solo si los días de
  // entreno realmente promedian más proteína (≥ +12 g) con muestra suficiente.
  {
    const withProtein = days.filter((s) => s.protein_g != null)
    const trained = withProtein.filter((s) => s.trained === true).map((s) => s.protein_g!)
    const notTrained = withProtein.filter((s) => s.trained !== true).map((s) => s.protein_g!)
    if (trained.length >= 3 && notTrained.length >= 3) {
      const avgT = avg(trained)
      const avgN = avg(notTrained)
      if (avgT - avgN >= 12) {
        out.push({
          id: 'training-protein',
          kind: 'pattern',
          label: 'Entreno y proteína',
          title: 'Tus días de entreno también fueron tus días de más proteína.',
          why: 'Los días que entrenaste, también comiste distinto.',
          evidence: {
            bars: [
              {
                label: 'Con entreno',
                value: Math.round(avgT),
                colorKey: 'proteina',
                highlight: true,
              },
              { label: 'Sin entreno', value: Math.round(avgN), colorKey: 'proteina' },
            ],
            caption: 'Proteína promedio según si entrenaste.',
            unit: 'g',
          },
        })
      }
    }
  }

  // B5 · Movimiento × déficit — EL par que conecta el esfuerzo (moverte) con el
  // NORTE (déficit/peso). Co-ocurrencia, NO causa ("de la mano con", nunca
  // "moverte te hace bajar"). Mismas guardas que B3 (muestra ≥3 por lado + efecto
  // marcado): no convertimos ruido en "patrón".
  if (target != null && target > 0) {
    const trained = food.filter((s) => s.trained === true)
    const rest = food.filter((s) => s.trained !== true)
    if (trained.length >= 3 && rest.length >= 3) {
      const defT = trained.filter((s) => isDeficitDay(s.calories, target)).length
      const defR = rest.filter((s) => isDeficitDay(s.calories, target)).length
      const rateT = defT / trained.length
      const rateR = defR / rest.length
      if (rateT >= rateR * 1.3 && rateT - rateR >= 0.2) {
        out.push({
          id: 'movement-deficit',
          kind: 'pattern',
          label: 'Entreno y déficit',
          title: 'Los días que entrenaste, tu déficit apareció más seguido.',
          why: 'Un día más de movimiento ya se nota en tu mes.',
          evidence: {
            bars: [
              {
                label: 'Con entreno',
                value: defT,
                total: trained.length,
                colorKey: 'cuerpo',
                highlight: true,
              },
              { label: 'Sin entreno', value: defR, total: rest.length, colorKey: 'cuerpo' },
            ],
            caption: 'Días en déficit según si entrenaste ese día.',
            unit: 'días',
          },
        })
      }
    }
  }

  // B6 · TIPO de entreno × déficit — cierra el loop de los chips de Hoy: el
  // tipo que la usuaria anota vuelve como patrón cuando los datos lo
  // sostienen. Compara el mejor tipo contra el RESTO de los entrenos (otros
  // tipos + sin tipo). Detección en _shared/intelligence/workout-type
  // (mismas guardas que B3/B5); co-ocurrencia, NO causa.
  if (target != null && target > 0) {
    const split = workoutTypeDeficitSplit(food, target, isDeficitDay)
    if (split) {
      const lower = split.label.toLowerCase()
      out.push({
        id: 'workout-type-deficit',
        kind: 'pattern',
        label: `${split.label} y déficit`,
        title: `Tus días de ${lower}, tu déficit apareció más seguido.`,
        why: `De tus entrenos, ${lower} es el que más acompaña tu déficit.`,
        evidence: {
          bars: [
            {
              label: split.label,
              value: split.bestDeficit,
              total: split.bestTotal,
              colorKey: 'cuerpo',
              highlight: true,
            },
            {
              label: 'Otros entrenos',
              value: split.otherDeficit,
              total: split.otherTotal,
              colorKey: 'cuerpo',
            },
          ],
          caption: 'Días en déficit según el tipo de entreno.',
          unit: 'días',
        },
      })
    }
  }

  // NOTA: NO existe un patrón de "Dormiste más de 7 h en N noches". Era un
  // conteo decorativo (no accionable): no dice qué hacer ni por qué importa, y
  // el doc prohíbe explícitamente los insights decorativos. El sueño SÍ aparece
  // como patrón, pero solo en su forma accionable (B3: sueño × déficit).

  // Un "patrón" sin acción es ruido: cada uno de arriba relaciona DOS cosas
  // (cuándo/qué con un resultado) y trae su `why` = el lever que la usuaria
  // puede mover. Si ninguno se sostiene con los datos, la sección no aparece.
  return out
}

/** La correlación con el DÉFICIT (el norte) que respalda un patrón de constancia
 *  de "Tu constancia" (calendario de movimiento): conecta el esfuerzo (entreno/sueño) con lo que la usuaria
 *  quiere (bajar). Devuelve las barras pareadas + el porqué, o null si esa
 *  correlación no se sostiene con los datos. Etapa 3: la ceremonia del patrón
 *  deja de ser solo frecuencia y muestra la PRUEBA que importa. */
export function correlationForKind(
  signals: readonly DailySignals[],
  opts: { proteinTarget?: number | null; calorieTarget?: number | null },
  kind: string,
): { title: string; bars: EvidenceBar[]; caption: string; insight: string } | null {
  const id =
    kind === 'training_consistent'
      ? 'movement-deficit'
      : kind === 'sleep_consistent'
        ? 'sleep-deficit'
        : null
  if (!id) return null
  const p = detectMonthPatterns(signals, opts).find((mp) => mp.id === id)
  if (!p || !p.why) return null
  return { title: p.title, bars: p.evidence.bars, caption: p.evidence.caption, insight: p.why }
}

/* ── "No sabías que..." — hallazgos de astrónomo ─────────────────────── */
/* Correlaciones demostrables, presentadas como descubrimientos: cada una es un
 * hallazgo con su emoji + frase + "Ver evidencia" (modal). Reemplaza la lista
 * "Tus patrones". Solo aparece lo que los datos sostienen (guardas); a lo sumo
 * 4 (el astrónomo no abruma). Voz Observadora: describe, no aconseja. */

export type MonthDiscovery = {
  id: string
  /** Emoji que abre la tarjeta. */
  icon: string
  /** La frase del hallazgo. */
  title: string
  evidence: { bars: EvidenceBar[]; caption: string; unit: string }
}

export function monthDiscoveries(
  signals: readonly DailySignals[],
  opts: { calorieTarget?: number | null; proteinTarget?: number | null },
): MonthDiscovery[] {
  const target = opts.calorieTarget ?? null
  const days = loggedDays(signals)
  const food = foodDays(signals)
  const out: MonthDiscovery[] = []

  // 🌙 Sueño ≥ 7 h presente en los días en déficit (co-ocurrencia).
  if (target != null && target > 0) {
    const defSleep = food.filter((s) => isDeficitDay(s.calories, target) && s.sleep_minutes != null)
    const y = defSleep.length
    const x = defSleep.filter((s) => s.sleep_minutes! >= SLEEP_7H_MIN).length
    if (y >= 5 && x / y >= 0.6) {
      out.push({
        id: 'sleep-in-deficit',
        icon: '🌙',
        title: `Dormir más de 7 horas apareció en ${x} de tus ${y} días en déficit.`,
        evidence: {
          bars: [
            { label: '7 h o más', value: x, total: y, colorKey: 'sueno', highlight: true },
            { label: 'Menos de 7 h', value: y - x, total: y, colorKey: 'sueno' },
          ],
          caption: 'Tus días en déficit, según cuánto dormiste esa noche.',
          unit: 'días',
        },
      })
    }
  }

  // 🏃 Días de entreno = días de más proteína.
  {
    const withProtein = days.filter((s) => s.protein_g != null)
    const trained = withProtein.filter((s) => s.trained === true).map((s) => s.protein_g!)
    const rest = withProtein.filter((s) => s.trained !== true).map((s) => s.protein_g!)
    if (trained.length >= 3 && rest.length >= 3) {
      const avgT = avg(trained)
      const avgN = avg(rest)
      if (avgT - avgN >= 12) {
        out.push({
          id: 'training-protein',
          icon: '🏃',
          title: 'Tus días de entrenamiento también fueron tus días de más proteína.',
          evidence: {
            bars: [
              {
                label: 'Con entreno',
                value: Math.round(avgT),
                colorKey: 'proteina',
                highlight: true,
              },
              { label: 'Sin entreno', value: Math.round(avgN), colorKey: 'proteina' },
            ],
            caption: 'Proteína promedio según si entrenaste.',
            unit: 'g',
          },
        })
      }
    }
  }

  // 📈 La segunda mitad del mes con menos días sobre la meta.
  if (target != null && target > 0) {
    const dayOf = (s: DailySignals): number => Number(s.day!.slice(8, 10))
    const firstFood = food.filter((s) => dayOf(s) <= 15)
    const secondFood = food.filter((s) => dayOf(s) > 15)
    const overFirst = firstFood.filter((s) => s.calories! > target).length
    const overSecond = secondFood.filter((s) => s.calories! > target).length
    if (firstFood.length >= 3 && secondFood.length >= 3 && overFirst - overSecond >= 2) {
      out.push({
        id: 'second-half',
        icon: '📈',
        title: 'La segunda mitad del mes tuvo menos días sobre tu meta.',
        evidence: {
          bars: [
            { label: 'Primera mitad', value: overFirst },
            { label: 'Segunda mitad', value: overSecond, highlight: true },
          ],
          caption: 'Días por encima de tu meta, por mitad del mes.',
          unit: 'días',
        },
      })
    }
  }

  // 📅 Déficit fuerte entre semana.
  if (target != null && target > 0) {
    const wdFood = food.filter((s) => weekdayMon(s.day!) < 5)
    const wdDef = wdFood.filter((s) => isDeficitDay(s.calories, target)).length
    if (wdFood.length >= 5 && wdDef / wdFood.length >= 0.6) {
      const pct = Math.round((wdDef / wdFood.length) * 100)
      out.push({
        id: 'deficit-weekday',
        icon: '📅',
        title: `Lograste tu déficit en el ${pct}% de tus días entre semana.`,
        evidence: {
          bars: [{ label: 'Lun a vie', value: wdDef, total: wdFood.length, highlight: true }],
          caption: 'Días en déficit sobre tus días con comida, de lunes a viernes.',
          unit: 'días',
        },
      })
    }
  }

  // 🍷 Superávit concentrado en fin de semana.
  if (target != null && target > 0) {
    let wd = 0
    let we = 0
    for (const s of food) {
      const over = s.calories! - target
      if (over <= 0) continue
      if (weekdayMon(s.day!) < 5) wd += over
      else we += over
    }
    const totalS = wd + we
    if (totalS >= 1000 && we / totalS >= 0.6) {
      const pct = Math.round((we / totalS) * 100)
      out.push({
        id: 'weekend-surplus',
        icon: '🍷',
        title: `El ${pct}% de tu superávit aparece en fin de semana.`,
        evidence: {
          bars: [
            { label: 'Entre semana', value: Math.round(wd) },
            { label: 'Fin de semana', value: Math.round(we), highlight: true },
          ],
          caption: 'Calorías por encima de tu meta, según el día.',
          unit: 'kcal',
        },
      })
    }
  }

  // El astrónomo comparte a lo sumo 4 hallazgos.
  return out.slice(0, 4)
}

/* ── "La combinación que más funcionó" — la fórmula ──────────────────── */
/* La combinación de buenos hábitos que más veces coincidió Y mejor terminó en
 * déficit (la "fórmula" de la usuaria). Enumera subconjuntos de las señales
 * computables (sueño ≥7h, proteína en meta, entrenó, agua completa) y elige el
 * MÁS GRANDE que apareció ≥ 3 veces con mayoría de días en déficit. "Registrar
 * antes de las 8 pm" NO se puede: daily_signals no guarda hora del día. */

export type ComboSignal = { key: string; label: string }
export type WinningCombo = {
  signals: ComboSignal[]
  /** Días en que TODA la combinación coincidió. */
  occurrences: number
  /** De esos, cuántos terminaron en déficit. */
  deficits: number
  /** Las fechas (ISO) en que la combinación coincidió — el ancla de la evidencia
   *  ("¿de dónde salen las N veces?"). Ordenadas. */
  days: string[]
}

const COMBO_MIN_OCCUR = 3

/* Verbos naturales por hábito para NOMBRAR el combo en la frase (no etiquetas
 * sueltas): "Entrenar e hidratarte fueron de la mano con tu déficit." */
const COMBO_VERB: Record<string, string> = {
  cuerpo: 'entrenar',
  agua: 'hidratarte',
  sueno: 'dormir bien',
  proteina: 'cuidar tu proteína',
}

/** La frase que NOMBRA el combo (sin genéricos "estas señales"). Voz
 *  Observadora: "de la mano con", nunca causa. */
export function comboPhrase(combo: WinningCombo): string {
  const verbs = combo.signals.map((s) => COMBO_VERB[s.key] ?? s.label.toLowerCase())
  if (verbs.length === 0) return ''
  const last = verbs[verbs.length - 1]!
  // "e" antes de sonido i- ("entrenar e hidratarte"); "y" en el resto.
  const conj = /^h?i/i.test(last) ? 'e' : 'y'
  const list = verbs.length > 1 ? `${verbs.slice(0, -1).join(', ')} ${conj} ${last}` : verbs[0]!
  return `${list.charAt(0).toUpperCase() + list.slice(1)} coincidieron con tu déficit.`
}

/** La evidencia del patrón dominante (frase + conteo + takeaway) para el modal
 *  cinemático de revelación. Compartida por Órbita Mes Y por el re-vivir del
 *  patrón desde "Tu constancia" (mismo sistema). */
export type ComboReveal = { phrase: string; countLine: string; takeaway: string }
export function comboReveal(combo: WinningCombo): ComboReveal {
  const allDeficit = combo.deficits >= combo.occurrences
  return {
    phrase: comboPhrase(combo),
    countLine: allDeficit
      ? `Coincidieron ${combo.occurrences} días. Los ${combo.occurrences}, en déficit.`
      : `Coincidieron ${combo.occurrences} días. ${combo.deficits}, en déficit.`,
    takeaway: 'Juntas son tu apuesta más segura al déficit.',
  }
}

/* ── Palanca del combo (semana en curso, criterio Apple) ─────────────────
 * El "qué hago AHORA" del combo dominante: cuántos días esta semana las señales
 * fueron juntas, vs los que TUS mejores semanas en déficit suelen tener. Meta de
 * tus datos + lo que falta, sin culpa. Ver features/patterns/CLAUDE.md (enmienda). */

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
/** Lunes (ISO) de la semana de `iso`. weekdayMon: 0=lun … 6=dom. */
function mondayIso(iso: string): string {
  return addDaysIso(iso, -weekdayMon(iso))
}

/** Predicado "este día cumple TODAS las señales del combo". */
function comboMatcher(
  combo: WinningCombo,
  opts: { proteinTarget?: number | null; waterGoalGlasses?: number | null },
): (s: DailySignals) => boolean {
  const pt = opts.proteinTarget ?? null
  const wg = Math.max(1, opts.waterGoalGlasses ?? WATER_GOAL_GLASSES)
  const preds = combo.signals.map((sig): ((s: DailySignals) => boolean) => {
    switch (sig.key) {
      case 'sueno':
        return (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN
      case 'proteina':
        return (s) => pt != null && s.protein_g != null && s.protein_g >= pt
      case 'cuerpo':
        return (s) => s.trained === true
      case 'agua':
        return (s) => (s.water_glasses ?? 0) >= wg
      default:
        return () => false
    }
  })
  return (s) => preds.length > 0 && preds.every((p) => p(s))
}

export function weeklyComboLever(
  signals: readonly DailySignals[],
  combo: WinningCombo,
  opts: {
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
  todayIso: string,
): string | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const matches = comboMatcher(combo, opts)
  const monday = mondayIso(todayIso)
  const w = signals.filter(
    (s) =>
      s.day != null &&
      s.day >= monday &&
      s.day <= todayIso &&
      s.calories != null &&
      s.calories > 0 &&
      matches(s),
  ).length
  // typical = días-de-combo por semana en sus semanas fuertes en déficit.
  const byWeek = new Map<string, { combo: number; food: number; deficit: number }>()
  for (const s of signals) {
    if (!s.day || s.calories == null || s.calories <= 0) continue
    const wk = mondayIso(s.day)
    const e = byWeek.get(wk) ?? { combo: 0, food: 0, deficit: 0 }
    e.food += 1
    if (matches(s)) e.combo += 1
    if (isDeficitDay(s.calories, target)) e.deficit += 1
    byWeek.set(wk, e)
  }
  const strong = [...byWeek.values()].filter(
    (e) => e.food >= 3 && e.combo >= 1 && e.deficit / e.food >= 0.5,
  )
  if (strong.length < 2) {
    return `Esta semana ya coincidieron ${w} ${w === 1 ? 'día' : 'días'}.`
  }
  const counts = strong.map((e) => e.combo).sort((a, b) => a - b)
  const typical = Math.max(1, counts[Math.floor(counts.length / 2)]!)
  if (w >= typical) {
    return `Esta semana ya coincidieron ${w} días. Vas en tu mejor forma de déficit.`
  }
  const faltan = typical - w
  const mas = faltan === 1 ? 'uno más' : `${faltan} más`
  return `Esta semana ya coincidieron ${w} de ${typical} días. Con ${mas}, tu déficit se repite.`
}

export function winningCombo(
  signals: readonly DailySignals[],
  opts: {
    calorieTarget?: number | null
    proteinTarget?: number | null
    waterGoalGlasses?: number | null
  },
): WinningCombo | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const food = foodDays(signals)
  if (food.length < COMBO_MIN_OCCUR) return null
  const pt = opts.proteinTarget ?? null
  const wg = Math.max(1, opts.waterGoalGlasses ?? WATER_GOAL_GLASSES)

  const candidates: { key: string; label: string; has: (s: DailySignals) => boolean }[] = [
    {
      key: 'sueno',
      label: 'Dormiste más de 7 horas',
      has: (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN,
    },
    ...(pt != null && pt > 0
      ? [
          {
            key: 'proteina',
            label: 'Proteína en meta',
            has: (s: DailySignals) => s.protein_g != null && s.protein_g >= pt,
          },
        ]
      : []),
    { key: 'cuerpo', label: 'Entrenaste', has: (s) => s.trained === true },
    { key: 'agua', label: 'Agua completa', has: (s) => (s.water_glasses ?? 0) >= wg },
  ]

  const n = candidates.length
  let best: { combo: typeof candidates; occ: number; deficits: number; days: string[] } | null =
    null
  // Subconjuntos por bitmask (n ≤ 4 → ≤ 16). Solo combinaciones (size ≥ 2).
  for (let mask = 1; mask < 1 << n; mask++) {
    const combo = candidates.filter((_, i) => (mask & (1 << i)) !== 0)
    if (combo.length < 2) continue
    const comboDays = food.filter((s) => combo.every((c) => c.has(s)))
    if (comboDays.length < COMBO_MIN_OCCUR) continue
    const deficits = comboDays.filter((s) => isDeficitDay(s.calories, target)).length
    if (deficits / comboDays.length < 0.5) continue // tiene que HABER funcionado
    const cand = {
      combo,
      occ: comboDays.length,
      deficits,
      days: comboDays.map((s) => s.day!).sort(),
    }
    // Preferir la fórmula MÁS GRANDE (más rica); desempate por más días en
    // déficit, luego por más apariciones.
    if (
      best == null ||
      cand.combo.length > best.combo.length ||
      (cand.combo.length === best.combo.length && cand.deficits > best.deficits) ||
      (cand.combo.length === best.combo.length &&
        cand.deficits === best.deficits &&
        cand.occ > best.occ)
    ) {
      best = cand
    }
  }
  if (best == null) return null
  return {
    signals: best.combo.map((c) => ({ key: c.key, label: c.label })),
    occurrences: best.occ,
    deficits: best.deficits,
    days: best.days,
  }
}

/* ── Frase final — cierre basado en evidencia ────────────────────────── */

/** Una sola frase de cierre, elegida por la cantidad de días presentes. Todas
 *  se sostienen con datos (no son motivacionales vacías): hablan de constancia,
 *  repetición y de que la evidencia empieza a contar una historia. */
export function finalPhrase(signals: readonly DailySignals[]): string | null {
  const days = loggedDays(signals).length
  if (days === 0) return null
  if (days >= 18) return 'La constancia apareció más veces que la perfección.'
  if (days >= 10) return 'Lo que repetiste comenzó a definir este mes.'
  return 'La evidencia empieza a contar una historia.'
}

/*
 * Órbita · Mes — "¿En qué me estoy transformando?".
 *
 * Lógica pura y DETERMINÍSTICA (sin IA) sobre ~30 días de daily_signals. Ver
 * docs/orbita-mes-spec.md (fuente de verdad). Piezas:
 *   · habitReveal        → "Así revelaste tu constelación" + "Tu evolución":
 *                          conteo de días por dimensión (qué iluminó la
 *                          constelación). La misma data ordena ambas secciones.
 *   · detectMonthPatterns → "Haz visible lo invisible" (kind 'discovery') +
 *                          "Tus patrones" (kind 'pattern'). Patrones REALES con
 *                          su evidencia visual (barras). No inventa
 *                          correlaciones: cada patrón nace de contar lo
 *                          registrado, y solo aparece si el dato lo sostiene
 *                          (guardas de honestidad).
 *   · finalPhrase        → la frase de cierre, elegida por la evidencia.
 *   · buildMonthBuilt    → conteos acumulados (prueba tangible, reutilizable).
 *   · biggestWin         → la consistencia, celebrada (legacy/auxiliar).
 *
 * Toda comparación de día-de-semana se parsea en UTC (como el resto del repo)
 * para no correrse de día por timezone.
 */
import {
  detectProteinConsistency,
  detectSleepConsistency,
  detectTrainingConsistency,
} from '@/features/patterns/consistency'

import type { DailySignals } from './api'

/** Vasos para considerar el agua "alcanzada" ese día (meta diaria). */
export const WATER_GOAL_GLASSES = 8

const WD_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WD_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Día de la semana 0=lunes … 6=domingo (UTC, timezone-independiente). */
function weekdayMon(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** ¿El día trae alguna señal? (las filas existen solo para días registrados,
 *  pero lo verificamos por si acaso). */
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

/* ── "Así revelaste tu constelación" / "Tu evolución" ────────────────── */
/* Conteo de días con evidencia por dimensión. Cada categoría ilumina una parte
 * de la constelación; este es el origen tanto de la lista de revelación como de
 * las barras de evolución. `colorKey` mapea al tono de dimensión en el
 * componente (ver BAR_COLOR). */

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
  { key: 'energia', label: 'Energía', colorKey: 'energia', has: (s) => s.energy != null },
  { key: 'agua', label: 'Agua', colorKey: 'agua', has: (s) => (s.water_glasses ?? 0) > 0 },
  // Ciclo NO entra: es CONTEXTO (derivado del inicio de período), no una señal
  // de presencia/hábito. No se cuenta como "días registrados" ni cae en "aún no
  // sabemos". Ver decisión de proyecto (memoria: ciclo-is-context-not-habit).
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

/* ── "Esto construiste" — conteos acumulados ─────────────────────────── */

export type MonthBuilt = {
  trainedDays: number
  foodDays: number
  proteinAvgG: number | null
  waterGoalDays: number
  sleepAvgH: number | null
  daysAppeared: number
}

export function buildMonthBuilt(
  signals: readonly DailySignals[],
  opts?: { waterGoalGlasses?: number },
): MonthBuilt {
  const goal = opts?.waterGoalGlasses ?? WATER_GOAL_GLASSES
  const days = loggedDays(signals)
  let trainedDays = 0
  let foodDays = 0
  let proteinSum = 0
  let proteinN = 0
  let waterGoalDays = 0
  let sleepSum = 0
  let sleepN = 0
  for (const s of days) {
    if (s.trained) trainedDays += 1
    if ((s.meal_count ?? 0) > 0) foodDays += 1
    if (s.protein_g != null) {
      proteinSum += s.protein_g
      proteinN += 1
    }
    if ((s.water_glasses ?? 0) >= goal) waterGoalDays += 1
    if (s.sleep_minutes != null) {
      sleepSum += s.sleep_minutes
      sleepN += 1
    }
  }
  return {
    trainedDays,
    foodDays,
    proteinAvgG: proteinN ? Math.round(proteinSum / proteinN) : null,
    waterGoalDays,
    sleepAvgH: sleepN ? Math.round((sleepSum / sleepN / 60) * 10) / 10 : null,
    daysAppeared: days.length,
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
export type MonthPattern = {
  id: string
  /** 'discovery' → "Haz visible lo invisible" (constancia de una dimensión).
   *  'pattern'   → "Tus patrones" (forma temporal demostrable). */
  kind: 'discovery' | 'pattern'
  /** Encabezado corto de la tarjeta (p. ej. "Movimiento"). El `title` es la
   *  frase observacional que lo describe. */
  label: string
  title: string
  evidence: { bars: EvidenceBar[]; caption: string; unit: string }
}

/** Mínimo de días registrados para arriesgar cualquier patrón — debajo de esto
 *  el mes apenas se forma y un "patrón" sería ruido. */
const PATTERN_MIN_DAYS = 8

function weekdayCounts(days: readonly DailySignals[]): number[] {
  const wd = [0, 0, 0, 0, 0, 0, 0]
  for (const s of days) {
    const i = weekdayMon(s.day!)
    wd[i] = (wd[i] ?? 0) + 1
  }
  return wd
}

/* Patrones POSITIVOS del MOTOR de consistencia (features/patterns/consistency)
 * — la MISMA lógica del reveal semanal de Hoy, aquí sobre la ventana del mes.
 * "Lo que descubrimos" ya no inventa su propia constancia: la consume del motor
 * (un solo origen de verdad, testeado). Umbral mensual propio. */
const MONTH_CONSISTENT_MIN = 8
const MONTH_WINDOW_DAYS = 32

/** Fecha más reciente (medianoche local) como ms — ancla de la ventana de los
 *  detectores, derivada de los datos (no de `new Date()`) → determinística. */
function latestDayMs(days: readonly DailySignals[]): number | null {
  let max: string | null = null
  for (const s of days) if (s.day && (max == null || s.day > max)) max = s.day
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
  opts?: { proteinTarget?: number | null },
): MonthPattern[] {
  const days = loggedDays(signals)
  if (days.length < PATTERN_MIN_DAYS) return []
  const out: MonthPattern[] = []

  // 1 · Patrones del MOTOR — la constancia positiva (proteína/movimiento/sueño)
  // viene de features/patterns/consistency, no de un cálculo paralelo. Evidencia
  // = los conteos del motor (el conteo "va al frente" en los positivos, ok).
  const c = monthConsistency(signals, { proteinTarget: opts?.proteinTarget })
  // El motor cuenta días presentes en una ventana de MONTH_WINDOW_DAYS (~mes),
  // así que ese es el denominador correcto para anclar el número ("18 / 32").
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
  // El contexto temporal ("este mes") lo da la sección; NO cada frase, para que
  // la voz no suene a plantilla. Solo CONSTANCIAS positivas viven en "Haz
  // visible lo invisible": lo que faltó lo cuentan "Lo que aún no sabemos" (lo
  // genuinamente ausente) y las barras de "Tu evolución". Mezclar aquí una
  // "señal más silenciosa" rompía la confianza: contaba presencia cruda contra
  // el conteo del motor (escalas distintas), así que la "silenciosa" podía
  // mostrar MÁS días que una "constante".
  if (c.protein.detected) {
    out.push({
      id: 'consistent-protein',
      kind: 'discovery',
      label: 'Proteína',
      title: 'Tu proteína se mantuvo consistente.',
      evidence: { bars: consistencyBars('proteina'), caption: consistencyCaption, unit: 'días' },
    })
  }
  if (c.training.detected) {
    out.push({
      id: 'consistent-training',
      kind: 'discovery',
      label: 'Movimiento',
      title: 'El movimiento fue una de tus constantes.',
      evidence: { bars: consistencyBars('cuerpo'), caption: consistencyCaption, unit: 'días' },
    })
  }
  if (c.sleep.detected) {
    out.push({
      id: 'consistent-sleep',
      kind: 'discovery',
      label: 'Sueño',
      title: 'Tu sueño se mantuvo estable.',
      evidence: { bars: consistencyBars('sueno'), caption: consistencyCaption, unit: 'días' },
    })
  }

  // 3 · Entre semana vs fin de semana.
  const wd = weekdayCounts(days)
  const weekdaySum = wd[0]! + wd[1]! + wd[2]! + wd[3]! + wd[4]!
  const weekendSum = wd[5]! + wd[6]!
  const avgWeekday = weekdaySum / 5
  const avgWeekend = weekendSum / 2
  const wdBars = (highlights: number[]): EvidenceBar[] =>
    wd.map((v, i) => ({ label: WD_SHORT[i]!, value: v, highlight: highlights.includes(i) }))
  if (avgWeekday >= avgWeekend * 1.3 && weekdaySum >= 4) {
    out.push({
      id: 'weekday',
      kind: 'pattern',
      label: 'Tu semana',
      title: 'Apareces más entre semana.',
      evidence: {
        bars: wdBars([0, 1, 2, 3, 4]),
        caption: 'Días que apareciste, por día de la semana.',
        unit: 'días',
      },
    })
  } else if (avgWeekend >= avgWeekday * 1.3 && weekendSum >= 2) {
    out.push({
      id: 'weekend',
      kind: 'pattern',
      label: 'Tu fin de semana',
      title: 'Apareces más en fin de semana.',
      evidence: {
        bars: wdBars([5, 6]),
        caption: 'Días que apareciste, por día de la semana.',
        unit: 'días',
      },
    })
  }

  // 3.5 · Noches con ≥ 7 h de sueño — patrón demostrable directo (sin asumir
  // causa): cuántas noches registradas alcanzaron las 7 h. Solo si hay sueño
  // registrado y un puñado de noches profundas lo sostienen.
  const sleepNights = days.filter((s) => s.sleep_minutes != null)
  const deepNights = sleepNights.filter((s) => s.sleep_minutes! >= 420).length
  if (sleepNights.length >= PATTERN_MIN_DAYS && deepNights >= 4) {
    out.push({
      id: 'sleep-7h',
      kind: 'pattern',
      label: 'Tus noches',
      title: `Dormiste más de 7 h en ${deepNights} ${deepNights === 1 ? 'noche' : 'noches'}.`,
      evidence: {
        bars: [
          {
            label: '≥ 7 h',
            value: deepNights,
            total: sleepNights.length,
            colorKey: 'sueno',
            highlight: true,
          },
          {
            label: '< 7 h',
            value: sleepNights.length - deepNights,
            total: sleepNights.length,
            colorKey: 'sueno',
          },
        ],
        caption: 'Noches registradas según las horas de sueño.',
        unit: 'noches',
      },
    })
  }

  // 4 · Tus mejores días — los días de la semana en que más apareces.
  const max = Math.max(...wd)
  if (max >= 2) {
    const tops = wd
      .map((v, i) => ({ i, v }))
      .filter((x) => x.v === max)
      .map((x) => x.i)
      .slice(0, 2)
    // Solo si no es un empate masivo (≤ 2 días pico) y destaca sobre el resto.
    const rest = wd.filter((_, i) => !tops.includes(i))
    const avgRest = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : 0
    if (tops.length <= 2 && max > avgRest) {
      const names = tops.map((i) => WD_FULL[i]!)
      const title =
        names.length === 2
          ? `Tus mejores días suelen ser ${names[0]} y ${names[1]}.`
          : `Tu mejor día suele ser ${names[0]}.`
      out.push({
        id: 'best-days',
        kind: 'pattern',
        label: 'Tus mejores días',
        title,
        evidence: {
          bars: wdBars(tops),
          caption: 'Días que apareciste, por día de la semana.',
          unit: 'días',
        },
      })
    }
  }

  // El orden ya nace positivo (constancias primero por el orden de push); el
  // componente separa discoveries de patterns por `kind`.
  return out
}

/* ── "Tu mayor victoria" — la consistencia, celebrada ────────────────── */

export type MonthWin = { headline: string; line: string }

export function biggestWin(signals: readonly DailySignals[]): MonthWin | null {
  const days = loggedDays(signals).length
  if (days === 0) return null
  // Voz Stelar: observa, no etiqueta. "Superpoder" sonaba a autoayuda; "ritmo
  // real" validaba de más. Constancia > consistencia (manifiesto).
  // "este mes" vive SOLO en el headline (el ancla temporal de la sección); la
  // línea no lo repite para que la voz no suene a plantilla.
  const line =
    days >= 20
      ? 'Tu constancia habló.'
      : days >= 12
        ? 'Un ritmo empieza a aparecer.'
        : 'Cada día que registras, suma.'
  // "Estuviste presente" en vez de "Apareciste": cálido y claro a la vez (qué
  // = registraste alguna señal ese día). voice-and-copy.
  return {
    headline: `Estuviste presente ${days} ${days === 1 ? 'día' : 'días'} este mes.`,
    line,
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

/*
 * baseline.ts — "¿esta semana fue como sueles, o distinta en ti?"
 *
 * El diferenciador del manifiesto hecho glance: en vez de un número crudo
 * que la usuaria tiene que juzgar sola, Stelar contextualiza el promedio de la
 * semana contra SU propia línea base rodante ("notamos que las noches del
 * viernes son distintas en tu rutina"). Comparación SIEMPRE contigo misma, nunca
 * contra otras, nunca contra una meta externa: observación curiosa, jamás
 * señalamiento. Vive en Órbita Semana/Mes (que comparan por naturaleza), NO en
 * Día (present tense, "nunca compara jornadas").
 *
 * Puro y determinista. Guardas de honestidad: mínimo de días con dato
 * (BASELINE_MIN_DAYS) — sin evidencia suficiente, Stelar NO infiere "lo típico
 * en ti", devuelve null. Y una banda mínima absoluta por dimensión para no
 * llamar "distinto" al ruido natural de un cuerpo.
 *
 * Solo dimensiones estables y numéricas (sueño, energía). El déficit NO se
 * baselinea: "distinto" sobre lo que comiste se leería como reproche, y eso es
 * línea roja del manifiesto.
 */
import type { DailySignals, DimensionKey } from './types.ts'

/** Mínimo de días con dato para que un baseline sea honesto (≈2 semanas).
 *  Por debajo → null: Stelar no infiere "lo típico en ti" sin evidencia. */
export const BASELINE_MIN_DAYS = 10

/** Ventana rodante que define "lo típico en ti" (días recientes, sin hoy). */
export const BASELINE_WINDOW_DAYS = 30

export type BaselineStatus = 'typical' | 'lower' | 'higher'

export type BaselineRead = {
  key: DimensionKey
  status: BaselineStatus
  /** Cuántos días alimentaron el baseline (transparencia: "leí N días"). */
  sampleDays: number
}

type BaselineDim = {
  value: (s: DailySignals) => number | null
  /** Banda absoluta mínima: bajo esto, la variación es ruido, no "distinto". */
  minBand: number
}

/** Solo dimensiones estables con un valor numérico diario claro. Déficit,
 *  proteína, comida y mente quedan FUERA a propósito (o no son numéricas
 *  estables, o baselinearlas se leería como juicio). */
const BASELINE_DIMS: Partial<Record<DimensionKey, BaselineDim>> = {
  sueno: { value: (s) => s.sleep_minutes, minBand: 45 }, // ±45 min de ruido normal
  energia: { value: (s) => s.energy, minBand: 1 }, // ±1 nivel en la escala 1–5
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Desviación estándar muestral (n−1). 0 con menos de 2 datos. */
function stddev(xs: readonly number[], mu: number): number {
  if (xs.length < 2) return 0
  const variance = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

/* Nota: no exponemos una primitiva a nivel DÍA a propósito. El Día es present
 * tense y "nunca compara jornadas" (decisión de producto); un baseline diario
 * ahí sería mal uso. El baseline vive solo a nivel semana, abajo. */

/* ── Baseline a nivel SEMANA ──────────────────────────────────────────
 *
 * La misma idea contextual, pero el sujeto es la semana en curso: ¿esta
 * semana, en promedio, fue como sueles o distinta en ti? Vive en Órbita
 * Semana/Mes (que comparan por naturaleza), NO en Día — el Día es present
 * tense y "nunca compara jornadas" (decisión de producto).
 */

/** Días con dato de la semana en curso para que su promedio sea honesto: una
 *  semana de 1–2 registros no puede leerse como "distinta". */
export const WEEK_BASELINE_MIN_WEEK_DAYS = 3

/** ¿El promedio de ESTA semana fue como sueles, o distinto en ti?
 *
 *  Compara la media de la semana en curso contra tu línea base rodante (los
 *  días ANTERIORES al inicio de esta semana) ± banda. `null` cuando la semana
 *  tiene pocos registros o el historial previo no llega a BASELINE_MIN_DAYS. */
export function weekBaseline(
  key: DimensionKey,
  weekSignals: readonly DailySignals[],
  history: readonly DailySignals[],
  weekStartDay: string,
): BaselineRead | null {
  const dim = BASELINE_DIMS[key]
  if (!dim) return null

  const weekVals = weekSignals.map(dim.value).filter((v): v is number => v != null)
  if (weekVals.length < WEEK_BASELINE_MIN_WEEK_DAYS) return null
  const weekMean = mean(weekVals)

  const baseVals = history
    .filter((s) => s.day != null && s.day < weekStartDay)
    .sort((a, b) => (a.day! < b.day! ? 1 : -1)) // más reciente primero
    .slice(0, BASELINE_WINDOW_DAYS)
    .map(dim.value)
    .filter((v): v is number => v != null)
  if (baseVals.length < BASELINE_MIN_DAYS) return null

  const mu = mean(baseVals)
  const band = Math.max(stddev(baseVals, mu), dim.minBand)
  const status: BaselineStatus =
    weekMean > mu + band ? 'higher' : weekMean < mu - band ? 'lower' : 'typical'
  return { key, status, sampleDays: baseVals.length }
}

/** Las observaciones de baseline de la semana (sueño, energía), en orden.
 *  Vacío cuando no hay ninguna honesta. */
export function weekBaselineObservations(
  weekSignals: readonly DailySignals[],
  history: readonly DailySignals[],
  weekStartDay: string,
): BaselineRead[] {
  const out: BaselineRead[] = []
  for (const key of ['sueno', 'energia'] as const) {
    const r = weekBaseline(key, weekSignals, history, weekStartDay)
    if (r) out.push(r)
  }
  return out
}

/** Copy a nivel semana. BORRADOR — pasa por voice-and-copy + manifesto-reviewer.
 *  Sin "¿algo pasó?" (el promedio de la semana no es un momento puntual); neutro,
 *  descriptivo, sin juicio. */
export const WEEK_BASELINE_COPY: Partial<Record<DimensionKey, Record<BaselineStatus, string>>> = {
  sueno: {
    typical: 'Esta semana dormiste como sueles.',
    lower: 'Esta semana dormiste menos que de costumbre.',
    higher: 'Esta semana dormiste más que de costumbre.',
  },
  energia: {
    typical: 'Tu energía esta semana estuvo como de costumbre.',
    lower: 'Tu energía esta semana estuvo más baja que de costumbre.',
    higher: 'Tu energía esta semana estuvo más alta que de costumbre.',
  },
}

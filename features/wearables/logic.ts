/*
 * Wearables — lógica PURA de normalización (testeable, sin RN ni Supabase).
 *
 * Convierte lecturas crudas de HealthKit (y mañana Garmin) en filas para las
 * tablas de aterrizaje `wearable_*` (docs/wearables-integration-spec.md §2).
 * Agnóstica de fuente a propósito: cuando llegue Health Connect (Android) o
 * Garmin cloud, enchufan aquí sin refactor.
 *
 * Reglas que esta capa garantiza:
 *   · Día local SIEMPRE por timezone del perfil (misma convención que la
 *     view daily_signals) — nunca UTC.
 *   · Sueño = suma de etapas "asleep" (nunca inBed — infla 1-2 h) y se
 *     atribuye al día en que DESPERTÓ (convención sleep_date).
 *   · Valores clampeados a los CHECK de las tablas (atrapa basura antes de
 *     que el insert truene).
 */

export type WearableSource = 'apple_health' | 'health_connect' | 'garmin'

export type WearableWorkoutRow = {
  source: WearableSource
  external_id: string
  started_at: string
  ended_at: string
  workout_type: string | null
  duration_min: number | null
  energy_kcal: number | null
  /** Nombre a mostrar ("Bici", "Correr"); null si la fuente no lo dice. */
  activity: string | null
}

export type WearableSleepRow = {
  source: WearableSource
  external_id: string
  sleep_date: string
  bedtime_at: string | null
  wake_at: string | null
  asleep_minutes: number
  /** Etapas de la noche; null = la fuente no las dio (solo "dormida"). */
  deep_minutes: number | null
  core_minutes: number | null
  rem_minutes: number | null
  awake_minutes: number | null
}

export type WearableStepsRow = {
  source: WearableSource
  day_date: string
  steps: number
}

export type WearableWaterRow = {
  source: WearableSource
  day_date: string
  water_ml: number
}

/** Peso de la báscula (spec §9): un snapshot por día local, manual gana. */
export type WearableWeightRow = {
  source: WearableSource
  day_date: string
  measured_at: string
  weight_kg: number
}

export type WearableBodyCompositionRow = {
  source: WearableSource
  day_date: string
  body_fat_pct: number | null
  lean_body_mass_kg: number | null
  bmi: number | null
}

/** Lectura cruda de un workout, ya aplanada por el wrapper de la fuente. */
export type RawWorkout = {
  uuid: string
  /** HKWorkoutActivityType (número del enum de Apple). */
  activityType: number
  start: Date
  end: Date
  /** Duración en SEGUNDOS (unidad nativa de HK); null si no vino. */
  durationSec: number | null
  /** kcal del entreno (totalEnergyBurned del propio workout); null si no vino. */
  energyKcal: number | null
  /** Tipo canónico ya resuelto por la fuente (Health Connect usa otro enum que
   *  HealthKit); si viene, gana sobre `activityType`. */
  workoutType?: string
  /** Nombre ya resuelto por la fuente (Health Connect); si no, de HealthKit. */
  activityName?: string | null
}

/** Muestra cruda de sueño (una etapa). `value` = CategoryValueSleepAnalysis. */
export type RawSleepSample = {
  uuid: string
  value: number
  start: Date
  end: Date
}

/** Bucket diario de pasos ya agregado por la fuente (pre-deduplicado). */
export type RawDailySteps = {
  start: Date
  steps: number
}

/** Una lectura de peso cruda (kg) con su instante. */
export type RawBodyMass = {
  date: Date
  kg: number
}

/** Agua bebida por día (agregado de HK, ya en mililitros). */
export type RawDailyWater = {
  start: Date
  ml: number
}

/** Las 3 métricas de composición que expone HealthKit (visceral / % agua NO son
 *  tipos estándar de HK → fuera de alcance). */
export type BodyCompositionMetric = 'body_fat_pct' | 'lean_body_mass_kg' | 'bmi'

/** Una muestra cruda de composición, ya en UNIDAD CANÓNICA (pct 0-100, kg,
 *  índice) — el wrapper de la fuente hace la conversión de unidad. */
export type RawBodyComposition = {
  metric: BodyCompositionMetric
  value: number
  date: Date
}

/** YYYY-MM-DD del instante `d` en la zona `tz` (en-CA formatea ISO nativo;
 *  mismo truco que lib/time.todayInTimezone). */
export function dayInTimezone(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
}

/*
 * HKWorkoutActivityType → el vocabulario canónico de los chips de Hoy
 * (fuerza / cardio / caminata / otro — ver _shared/intelligence/workout-type).
 * Lo que no mapea limpio cae a 'otro', jamás a un tipo inventado.
 */
const HK_FUERZA = new Set([20, 50, 59]) // functional/traditional strength, core
const HK_CARDIO = new Set([11, 13, 16, 35, 37, 44, 46, 63, 64, 65, 73, 77, 78])
const HK_CAMINATA = new Set([24, 52]) // hiking, walking

export function hkActivityToWorkoutType(activityType: number): string {
  if (HK_FUERZA.has(activityType)) return 'fuerza'
  if (HK_CARDIO.has(activityType)) return 'cardio'
  if (HK_CAMINATA.has(activityType)) return 'caminata'
  return 'otro'
}

/**
 * Health Connect ExerciseType → el mismo vocabulario canónico. Otro enum que
 * HealthKit (constantes de react-native-health-connect), misma regla: lo que no
 * mapea limpio cae a 'otro'.
 */
const HC_FUERZA = new Set([13, 70, 81]) // calisthenics, strength training, weightlifting
const HC_CARDIO = new Set([8, 9, 10, 16, 25, 36, 48, 53, 54, 56, 57, 68, 69, 73, 74])
const HC_CAMINATA = new Set([37, 79]) // hiking, walking

export function hcExerciseToWorkoutType(exerciseType: number): string {
  if (HC_FUERZA.has(exerciseType)) return 'fuerza'
  if (HC_CARDIO.has(exerciseType)) return 'cardio'
  if (HC_CAMINATA.has(exerciseType)) return 'caminata'
  return 'otro'
}

/**
 * Etapa de sueño de Health Connect → el valor de HealthKit que entiende
 * `sleepSamplesToRows` (así la agregación de la noche es UNA sola). Fuera de
 * la cama no cuenta (null).
 *   HC: 1 despierta · 2 dormida · 3 fuera de la cama · 4 ligero · 5 profundo · 6 REM
 *   HK: 2 despierta · 1 dormida sin etapa · 3 core · 4 profundo · 5 REM
 */
export function hcSleepStageToHk(stage: number): number | null {
  switch (stage) {
    case 1:
      return 2
    case 2:
      return 1
    case 4:
      return 3
    case 5:
      return 4
    case 6:
      return 5
    default:
      return null
  }
}

/*
 * El nombre de la actividad que se MUESTRA ("Bici", "Correr", "Yoga"…), aparte
 * del tipo canónico del motor. Dueña 2 oct 2026: "quiero saber qué tipo de
 * ejercicio hice" (la bici salía como "cardio"). Sin nombre conocido → null y
 * la UI usa el tipo canónico.
 */
const HK_ACTIVITY: Record<number, string> = {
  13: 'Bici',
  74: 'Bici',
  37: 'Correr',
  52: 'Caminata',
  24: 'Senderismo',
  50: 'Fuerza',
  20: 'Fuerza funcional',
  59: 'Core',
  63: 'HIIT',
  73: 'Cardio mixto',
  16: 'Elíptica',
  35: 'Remo',
  46: 'Natación',
  44: 'Escaleras',
  77: 'Baile',
  57: 'Yoga',
  66: 'Pilates',
  11: 'Cross training',
  65: 'Kickboxing',
  64: 'Step',
  78: 'Baile',
}
const HC_ACTIVITY: Record<number, string> = {
  8: 'Bici',
  9: 'Bici fija',
  56: 'Correr',
  57: 'Caminadora',
  79: 'Caminata',
  37: 'Senderismo',
  70: 'Fuerza',
  81: 'Pesas',
  13: 'Calistenia',
  36: 'HIIT',
  25: 'Elíptica',
  53: 'Remo',
  54: 'Remo',
  73: 'Natación',
  74: 'Natación',
  83: 'Yoga',
  48: 'Pilates',
  10: 'Bootcamp',
  16: 'Baile',
  68: 'Escaleras',
  69: 'Escaleras',
}

export function hkActivityName(activityType: number): string | null {
  return HK_ACTIVITY[activityType] ?? null
}
export function hcActivityName(exerciseType: number): string | null {
  return HC_ACTIVITY[exerciseType] ?? null
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** Un workout crudo → fila de wearable_workouts (sin user_id; lo pone api). */
export function normalizeWorkout(w: RawWorkout, source: WearableSource): WearableWorkoutRow {
  const durationMin =
    w.durationSec != null && w.durationSec > 0
      ? clamp(Math.round(w.durationSec / 60), 0, 1440)
      : null
  const energyKcal =
    w.energyKcal != null && w.energyKcal > 0 ? clamp(Math.round(w.energyKcal), 0, 5000) : null
  return {
    source,
    external_id: w.uuid,
    started_at: w.start.toISOString(),
    ended_at: w.end.toISOString(),
    workout_type: w.workoutType ?? hkActivityToWorkoutType(w.activityType),
    activity: w.activityName !== undefined ? w.activityName : hkActivityName(w.activityType),
    duration_min: durationMin,
    energy_kcal: energyKcal,
  }
}

/**
 * Salud puede guardar el MISMO entreno varias veces con UUIDs distintos (Garmin
 * Connect lo reescribe al re-sincronizar). Mismo inicio + tipo + duración = el
 * mismo entreno: se queda uno (el de UUID menor, estable entre syncs) para no
 * triplicar minutos ni kcal en daily_signals.
 */
export function dedupeWorkouts(rows: readonly WearableWorkoutRow[]): WearableWorkoutRow[] {
  const byKey = new Map<string, WearableWorkoutRow>()
  for (const r of rows) {
    const key = `${r.started_at}|${r.workout_type ?? ''}|${r.duration_min ?? ''}`
    const prev = byKey.get(key)
    if (!prev || r.external_id < prev.external_id) byKey.set(key, r)
  }
  return [...byKey.values()]
}

/** Intervalo normal entre syncs (cada foreground no es cada minuto). */
export const SYNC_INTERVAL_MS = 15 * 60 * 1000
/** En la mañana, mientras el sueño de anoche no llega, se re-consulta seguido. */
export const SYNC_INTERVAL_WAITING_SLEEP_MS = 2 * 60 * 1000
/** Hasta qué hora local se espera el sueño de anoche. */
const SLEEP_WAIT_UNTIL_HOUR = 14

/**
 * Cuánto esperar entre syncs. Si es de mañana y el sueño de hoy (la noche que
 * terminó hoy) aún no aterrizó, el reloj suele estar por sincronizar: 2 min.
 */
export function syncIntervalMs(opts: {
  localHour: number
  today: string
  lastSleepDay: string | null
}): number {
  const waitingSleep = opts.localHour < SLEEP_WAIT_UNTIL_HOUR && opts.lastSleepDay !== opts.today
  return waitingSleep ? SYNC_INTERVAL_WAITING_SLEEP_MS : SYNC_INTERVAL_MS
}

/* Etapas que cuentan como DORMIDA: asleepUnspecified(1), core(3), deep(4),
 * REM(5). inBed(0) y awake(2) quedan fuera — el error clásico que infla. */
const ASLEEP_VALUES = new Set([1, 3, 4, 5])
const HK_AWAKE = 2
const HK_CORE = 3
const HK_DEEP = 4
const HK_REM = 5

type NightAgg = {
  minutes: number
  deep: number
  core: number
  rem: number
  bed: Date
  wake: Date
}

/**
 * Muestras de etapas de sueño → una fila por DÍA EN QUE DESPERTÓ (día local
 * del fin de cada etapa). `external_id` es estable por día (`sleep-<fecha>`):
 * cada re-sync upserta la misma fila y la noche se completa sola aunque el
 * dato llegue tarde (backfill solo suma, spec §2).
 *
 * Etapas: profundo/ligero/REM salen de las muestras dormidas; "despierta" son
 * las muestras awake recortadas a la ventana de la noche (dormir → despertar),
 * para no contar el día. Si la fuente solo dio "dormida" sin etapas, las
 * cuatro quedan null (la pantalla lo dice en vez de inventar).
 */
export function sleepSamplesToRows(
  samples: readonly RawSleepSample[],
  tz: string,
  source: WearableSource,
): WearableSleepRow[] {
  const byDay = new Map<string, NightAgg>()
  for (const s of samples) {
    if (!ASLEEP_VALUES.has(s.value)) continue
    const ms = s.end.getTime() - s.start.getTime()
    if (ms <= 0) continue
    const min = ms / 60000
    const day = dayInTimezone(s.end, tz)
    let agg = byDay.get(day)
    if (!agg) {
      agg = { minutes: 0, deep: 0, core: 0, rem: 0, bed: s.start, wake: s.end }
      byDay.set(day, agg)
    }
    agg.minutes += min
    if (s.value === HK_DEEP) agg.deep += min
    else if (s.value === HK_CORE) agg.core += min
    else if (s.value === HK_REM) agg.rem += min
    if (s.start < agg.bed) agg.bed = s.start
    if (s.end > agg.wake) agg.wake = s.end
  }

  const awakeByDay = new Map<string, number>()
  for (const s of samples) {
    if (s.value !== HK_AWAKE) continue
    const day = dayInTimezone(s.end, tz)
    const agg = byDay.get(day)
    if (!agg) continue
    const from = Math.max(s.start.getTime(), agg.bed.getTime())
    const to = Math.min(s.end.getTime(), agg.wake.getTime())
    if (to > from) awakeByDay.set(day, (awakeByDay.get(day) ?? 0) + (to - from) / 60000)
  }

  const mins = (x: number) => clamp(Math.round(x), 0, 1440)
  return [...byDay.entries()]
    .map(([day, agg]) => {
      const staged = agg.deep + agg.core + agg.rem > 0
      return {
        source,
        external_id: `sleep-${day}`,
        sleep_date: day,
        bedtime_at: agg.bed.toISOString(),
        wake_at: agg.wake.toISOString(),
        asleep_minutes: mins(agg.minutes),
        deep_minutes: staged ? mins(agg.deep) : null,
        core_minutes: staged ? mins(agg.core) : null,
        rem_minutes: staged ? mins(agg.rem) : null,
        awake_minutes: staged ? mins(awakeByDay.get(day) ?? 0) : null,
      }
    })
    .filter((r) => r.asleep_minutes > 0)
    .sort((a, b) => a.sleep_date.localeCompare(b.sleep_date))
}

/** Buckets diarios de pasos → filas de wearable_steps (identidad = el día). */
export function stepsToRows(
  buckets: readonly RawDailySteps[],
  tz: string,
  source: WearableSource,
): WearableStepsRow[] {
  const byDay = new Map<string, number>()
  for (const b of buckets) {
    const steps = Math.round(b.steps)
    if (steps <= 0) continue
    const day = dayInTimezone(b.start, tz)
    byDay.set(day, (byDay.get(day) ?? 0) + steps)
  }
  return [...byDay.entries()]
    .map(([day, steps]) => ({ source, day_date: day, steps: clamp(steps, 0, 200000) }))
    .sort((a, b) => a.day_date.localeCompare(b.day_date))
}

/**
 * Agua diaria del reloj/apps → una fila por DÍA LOCAL (misma identidad que
 * wearable_steps). HK entrega el agregado en mL; se suma por día local por si
 * el bucket cruza la medianoche del perfil. Sin fuente no hay fila.
 */
export function waterToRows(
  buckets: readonly RawDailyWater[],
  tz: string,
  source: WearableSource,
): WearableWaterRow[] {
  const byDay = new Map<string, number>()
  for (const b of buckets) {
    const ml = Math.round(b.ml)
    if (ml <= 0) continue
    const day = dayInTimezone(b.start, tz)
    byDay.set(day, (byDay.get(day) ?? 0) + ml)
  }
  return [...byDay.entries()]
    .map(([day, ml]) => ({ source, day_date: day, water_ml: clamp(ml, 0, 10000) }))
    .sort((a, b) => a.day_date.localeCompare(b.day_date))
}

/**
 * Lecturas de peso → una fila por DÍA LOCAL con la lectura MÁS RECIENTE del
 * día (la báscula puede pesar varias veces; el último snapshot manda, igual
 * que body_measurements en la view). Rango sano 20–400 kg; fuera, se descarta.
 */
export function bodyMassToRows(
  samples: readonly RawBodyMass[],
  tz: string,
  source: WearableSource,
): WearableWeightRow[] {
  const byDay = new Map<string, RawBodyMass>()
  for (const s of samples) {
    if (!Number.isFinite(s.kg) || s.kg < 20 || s.kg > 400) continue
    const day = dayInTimezone(s.date, tz)
    const prev = byDay.get(day)
    if (!prev || s.date.getTime() > prev.date.getTime()) byDay.set(day, s)
  }
  return [...byDay.entries()]
    .map(([day, s]) => ({
      source,
      day_date: day,
      measured_at: s.date.toISOString(),
      weight_kg: round1(s.kg),
    }))
    .sort((a, b) => a.day_date.localeCompare(b.day_date))
}

const COMP_RANGE: Record<BodyCompositionMetric, [number, number]> = {
  body_fat_pct: [0, 100],
  lean_body_mass_kg: [0, 300],
  bmi: [0, 100],
}
const round1 = (n: number): number => Math.round(n * 10) / 10

/**
 * Muestras crudas de composición → una fila por DÍA LOCAL (misma identidad que
 * wearable_steps). Por cada métrica se toma la muestra MÁS RECIENTE del día (un
 * snapshot diario, no un promedio). Descarta días sin ninguna métrica válida.
 * Valores clampeados a los CHECK de la tabla.
 */
export function bodyCompositionToRows(
  samples: readonly RawBodyComposition[],
  tz: string,
  source: WearableSource,
): WearableBodyCompositionRow[] {
  // day → métrica → { value, ms } (la más reciente gana).
  const byDay = new Map<
    string,
    Partial<Record<BodyCompositionMetric, { value: number; ms: number }>>
  >()
  for (const s of samples) {
    if (!Number.isFinite(s.value) || s.value <= 0) continue
    const day = dayInTimezone(s.date, tz)
    const ms = s.date.getTime()
    const bucket = byDay.get(day) ?? {}
    const prev = bucket[s.metric]
    if (!prev || ms >= prev.ms) bucket[s.metric] = { value: s.value, ms }
    byDay.set(day, bucket)
  }
  const pick = (
    b: Partial<Record<BodyCompositionMetric, { value: number; ms: number }>>,
    m: BodyCompositionMetric,
  ): number | null => (b[m] ? round1(clamp(b[m]!.value, COMP_RANGE[m][0], COMP_RANGE[m][1])) : null)

  return [...byDay.entries()]
    .map(([day, b]) => ({
      source,
      day_date: day,
      body_fat_pct: pick(b, 'body_fat_pct'),
      lean_body_mass_kg: pick(b, 'lean_body_mass_kg'),
      bmi: pick(b, 'bmi'),
    }))
    .filter((r) => r.body_fat_pct != null || r.lean_body_mass_kg != null || r.bmi != null)
    .sort((a, b) => a.day_date.localeCompare(b.day_date))
}

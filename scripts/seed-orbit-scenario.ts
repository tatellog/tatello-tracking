/*
 * Seed de escenario de órbita.
 *
 * Inserta ~75 días (2.5 meses) de datos realistas y CORRELACIONADOS para el
 * usuario de desarrollo, en las tablas fuente que alimentan la vista
 * `daily_signals`. Sirve para iterar el tab "Tu Órbita" (Día/Semana/Mes)
 * y la detección de patrones con datos densos y deterministas.
 *
 * Uso:
 *   pnpm seed:orbit
 *
 * Requiere en `.env.local` (NO se commitea):
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role, bypassea RLS
 *   DEV_USER_ID=<uuid del user dev@local.test>
 *
 * Es idempotente: borra primero TODA la data de las tablas fuente para el
 * dev user y vuelve a insertar. No toca otros users. NO toca profiles ni
 * macro_targets (eso lo maneja seed:dev) — asume que el dev user ya está
 * onboarded. Tampoco inserta cycle_events: este escenario es sin ciclo.
 *
 * Determinismo: no usa Math.random. Toda variación dentro de un rango se
 * deriva del índice del día, así que dos corridas producen filas idénticas.
 *
 * ───────────────────────────────────────────────────────────────────────
 * EL ESCENARIO (75 días terminando HOY):
 *   • Entrenamiento en 3 fases: 1.5 meses seguido (lun/mar/jue/vie ~18:00)
 *     → 2 semanas de descanso (sin workouts) → retomó hace ~2 semanas.
 *   • Buen déficit lun–vie: ~1500–1700 kcal, ~120 g proteína, 3 comidas.
 *   • Fines de semana de comida alta: ~3000–3500 kcal, 4–5 comidas, ~90–100 g.
 *   • Comida tardía (~02:00 local) los lunes y miércoles.
 *   • Dos viernes de desvelo (uno por mes): ~4 h, calidad 2.
 *   • Estrés lun/mié (stress 5, energy/motivation 3).
 *   • Mood lun/mié más tibio; fines de semana neutral.
 *   • Peso semanal bajando lento (~78.0 → ~75.5 kg).
 *   • Agua 6–8 vasos lun–vie, 4–5 fin de semana.
 *   • Rest day los domingos.
 * ───────────────────────────────────────────────────────────────────────
 *
 * NOTA timezone: el dev user usa el default profiles.timezone =
 * 'America/Mexico_City', que desde 2022 es UTC-6 fijo todo el año (sin
 * horario de verano). Por eso un instante de pared local HH:00 en CDMX es
 * exactamente (HH+6):00 en UTC. La vista daily_signals deriva el "día
 * local" de las columnas timestamp con ese mismo timezone, así que una
 * comida a las 02:00 local cae en el día correcto.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const devUserId = process.env.DEV_USER_ID

if (!url || !serviceKey || !devUserId) {
  console.error(
    'Faltan envs en .env.local:\n' +
      '  EXPO_PUBLIC_SUPABASE_URL\n' +
      '  SUPABASE_SERVICE_ROLE_KEY\n' +
      '  DEV_USER_ID',
  )
  process.exit(1)
}

// devUserId quedó verificado arriba; lo fijamos como string para el resto.
const USER_ID: string = devUserId

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Constantes del escenario ──────────────────────────────────────────
// 75 días para que entren las TRES fases de entrenamiento:
//   • daysAgo 29..74  → 1.5 meses entrenando seguido (lo más viejo)
//   • daysAgo 15..28  → 2 semanas de descanso (sin workouts)
//   • daysAgo 0..14   → retomó el entrenamiento (lo más reciente)
const DAYS = 75
// Ventana de descanso (en daysAgo, inclusive).
const REST_BREAK_FROM = 15
const REST_BREAK_TO = 28
const inRestBreak = (daysAgo: number): boolean =>
  daysAgo >= REST_BREAK_FROM && daysAgo <= REST_BREAK_TO
// CDMX es UTC-6 fijo (sin DST desde 2022). Local + 6h = UTC.
const MX_UTC_OFFSET_HOURS = 6

/**
 * Convierte una hora de pared local de CDMX a un ISO en UTC.
 * Trabaja en componentes UTC puros (Date.UTC) para no depender del
 * timezone de la máquina que corre el seed → determinista en cualquier CI.
 */
function mxLocalToUtcISO(
  year: number,
  month1: number, // 1–12
  day: number,
  hour = 0,
  minute = 0,
): string {
  const ms = Date.UTC(year, month1 - 1, day, hour + MX_UTC_OFFSET_HOURS, minute, 0, 0)
  return new Date(ms).toISOString()
}

/** Fecha local de CDMX en formato 'YYYY-MM-DD' para columnas `date`. */
function mxLocalDateString(year: number, month1: number, day: number): string {
  const mm = String(month1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Componentes de fecha local de CDMX para un instante dado. */
type LocalDate = { year: number; month1: number; day: number; dow: number }

/**
 * Devuelve los componentes de fecha LOCAL de CDMX (UTC-6) y el día de la
 * semana (0=domingo … 6=sábado) para `daysAgo` días antes de hoy, anclado
 * al mediodía local para evitar cualquier ambigüedad de borde de día.
 */
function localDayFromTodayOffset(daysAgo: number): LocalDate {
  // "Hoy" en CDMX: tomamos el ahora real y lo desplazamos a hora local.
  const nowLocalMs = Date.now() - MX_UTC_OFFSET_HOURS * 3600_000
  const anchor = new Date(nowLocalMs)
  // Mediodía local del día objetivo, expresado como componentes UTC del
  // reloj local (usamos getUTC* sobre el instante ya desplazado).
  const target = new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() - daysAgo,
      12,
      0,
      0,
    ),
  )
  return {
    year: target.getUTCFullYear(),
    month1: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
    dow: target.getUTCDay(),
  }
}

// Día de la semana
const SUN = 0
const MON = 1
const TUE = 2
const WED = 3
const THU = 4
const FRI = 5
const SAT = 6

const isWeekend = (dow: number) => dow === SAT || dow === SUN
const isTrainingDay = (dow: number) => dow === MON || dow === TUE || dow === THU || dow === FRI
const isStressDay = (dow: number) => dow === MON || dow === WED
const isLateMealDay = (dow: number) => dow === MON || dow === WED

// ─── Tipos de fila a insertar ──────────────────────────────────────────
type SleepRow = {
  user_id: string
  sleep_date: string
  bedtime: string
  wake_time: string
  quality: number
}
type WellbeingRow = {
  user_id: string
  checked_at: string
  checkin_date: string
  energy: number
  motivation: number
  stress: number
}
type MoodRow = {
  user_id: string
  value: 'good' | 'neutral' | 'struggle'
  checked_at: string
}
type MealRow = {
  user_id: string
  consumed_at: string
  name: string
  protein_g: number
  calories: number
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  source: string
}
type WorkoutRow = {
  user_id: string
  completed_at: string
  type: string
}
type MeasurementRow = {
  user_id: string
  measured_at: string
  weight_kg: number
}
type WaterRow = {
  user_id: string
  intake_date: string
  glasses: number
}
type RestRow = {
  user_id: string
  rest_date: string
}

async function seed(): Promise<void> {
  console.log(`[seed:orbit] Reseteando data de órbita para ${USER_ID}`)

  // ─── Wipe idempotente de las tablas fuente ─────────────────────────────
  // Solo las tablas que este escenario siembra. No tocamos profiles,
  // macro_targets, ni cycle_events.
  await Promise.all([
    supabase.from('sleep_logs').delete().eq('user_id', USER_ID),
    supabase.from('wellbeing_checkins').delete().eq('user_id', USER_ID),
    supabase.from('mood_checkins').delete().eq('user_id', USER_ID),
    supabase.from('meals').delete().eq('user_id', USER_ID),
    supabase.from('workouts').delete().eq('user_id', USER_ID),
    supabase.from('body_measurements').delete().eq('user_id', USER_ID),
    supabase.from('water_intake').delete().eq('user_id', USER_ID),
    supabase.from('rest_days').delete().eq('user_id', USER_ID),
  ])

  const sleep: SleepRow[] = []
  const wellbeing: WellbeingRow[] = []
  const moods: MoodRow[] = []
  const meals: MealRow[] = []
  const workouts: WorkoutRow[] = []
  const measurements: MeasurementRow[] = []
  const water: WaterRow[] = []
  const rest: RestRow[] = []

  // Para elegir dos viernes de desvelo (uno por mes). Recolectamos los
  // índices `daysAgo` de cada viernes y marcamos el primero de cada
  // ventana de 30 días.
  const fridayOffsets: number[] = []

  // Recorremos de hoy (0) hacia atrás hasta DAYS-1.
  for (let daysAgo = 0; daysAgo < DAYS; daysAgo++) {
    const d = localDayFromTodayOffset(daysAgo)
    const { year, month1, day, dow } = d
    const dateStr = mxLocalDateString(year, month1, day)
    const weekend = isWeekend(dow)

    if (dow === FRI) fridayOffsets.push(daysAgo)

    // ── Workouts: lun/mar/jue/vie a las 18:00 local, EXCEPTO durante
    //    las 2 semanas de descanso (daysAgo 15..28). Entrenó 1.5 meses
    //    seguido, paró 2 semanas, y retomó hace ~2 semanas. ──
    if (isTrainingDay(dow) && !inRestBreak(daysAgo)) {
      // Alterna fuerza/cardio de forma estable por día de la semana.
      const wType = dow === TUE || dow === THU ? 'cardio' : 'strength'
      workouts.push({
        user_id: USER_ID,
        completed_at: mxLocalToUtcISO(year, month1, day, 18, 0),
        type: wType,
      })
    }

    // ── Rest days: domingos siempre; y todos los días de la ventana de
    //    descanso (las 2 semanas que paró de entrenar). ──
    if (dow === SUN || inRestBreak(daysAgo)) {
      rest.push({ user_id: USER_ID, rest_date: dateStr })
    }

    // ── Meals ──
    if (weekend) {
      // Fin de semana de comida alta: 4–5 comidas, ~3000–3500 kcal,
      // ~90–100 g proteína. Sábado 5 comidas, domingo 4 (variación estable).
      const fiveMeals = dow === SAT
      // Desayuno
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 9, 30),
        name: 'Brunch de fin de semana',
        protein_g: 25,
        calories: 650,
        meal_type: 'breakfast',
        source: 'manual',
      })
      // Comida
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 14, 0),
        name: 'Comida fuera',
        protein_g: 35,
        calories: 900,
        meal_type: 'lunch',
        source: 'manual',
      })
      // Snack de tarde
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 17, 30),
        name: 'Antojo de tarde',
        protein_g: 8,
        calories: 450,
        meal_type: 'snack',
        source: 'manual',
      })
      // Cena
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 21, 0),
        name: 'Cena abundante',
        protein_g: fiveMeals ? 27 : 30,
        calories: fiveMeals ? 850 : 1050,
        meal_type: 'dinner',
        source: 'manual',
      })
      if (fiveMeals) {
        // Quinta comida del sábado → empuja a ~3450 kcal / ~95 g.
        meals.push({
          user_id: USER_ID,
          consumed_at: mxLocalToUtcISO(year, month1, day, 23, 0),
          name: 'Postre',
          protein_g: 0,
          calories: 500,
          meal_type: 'snack',
          source: 'manual',
        })
      }
    } else {
      // Entre semana en déficit: 3 comidas, ~1500–1700 kcal, ~120 g.
      // Pequeña variación estable por día del mes (no random).
      const calBump = (day % 3) * 60 // 0 / 60 / 120
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 8, 0),
        name: 'Avena con proteína',
        protein_g: 35,
        calories: 380 + calBump,
        meal_type: 'breakfast',
        source: 'manual',
      })
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 13, 0),
        name: 'Pollo con arroz y verduras',
        protein_g: 45,
        calories: 560,
        meal_type: 'lunch',
        source: 'manual',
      })
      meals.push({
        user_id: USER_ID,
        consumed_at: mxLocalToUtcISO(year, month1, day, 20, 0),
        name: 'Salmón con ensalada',
        protein_g: 40,
        calories: 560,
        meal_type: 'dinner',
        source: 'manual',
      })

      // ── Comida tardía (~02:00 local) lunes y miércoles ──
      // Es una comida EXTRA del mismo día local (02:00 cae dentro del día).
      if (isLateMealDay(dow)) {
        meals.push({
          user_id: USER_ID,
          consumed_at: mxLocalToUtcISO(year, month1, day, 2, 0),
          name: 'Snack de madrugada',
          protein_g: 6,
          calories: 320,
          meal_type: 'snack',
          source: 'manual',
        })
      }
    }

    // ── Sleep ──
    // bedtime/wake_time son instantes absolutos; sleep_date es el día local
    // en que despertó (= este `dateStr`). El sueño empieza la NOCHE
    // anterior, así que bedtime se calcula desde el día previo.
    const prev = localDayFromTodayOffset(daysAgo + 1)
    // Los dos viernes de desvelo se marcan luego (segunda pasada); aquí
    // sembramos el caso normal y corregimos después.
    if (weekend) {
      // Fin de semana: 480–540 min (8–9 h), calidad 4. Sábado duerme más.
      // Sábado: bed vie 00:00 → wake 09:00 = 540 min.
      // Domingo: bed sáb 00:00 → wake 08:00 = 480 min.
      sleep.push({
        user_id: USER_ID,
        sleep_date: dateStr,
        bedtime: mxLocalToUtcISO(prev.year, prev.month1, prev.day, 24, 0),
        wake_time: mxLocalToUtcISO(year, month1, day, dow === SAT ? 9 : 8, 0),
        quality: 4,
      })
    } else {
      // Entre semana: 430–450 min (~7.2–7.5 h), calidad 3–4. Variación estable.
      // Acostarse 23:15; despertar 06:25 (430 min) o 06:45 (450 min).
      const longer = day % 2 === 0
      sleep.push({
        user_id: USER_ID,
        sleep_date: dateStr,
        bedtime: mxLocalToUtcISO(prev.year, prev.month1, prev.day, 23, 15),
        wake_time: mxLocalToUtcISO(year, month1, day, 6, longer ? 45 : 25),
        quality: longer ? 4 : 3,
      })
    }

    // ── Wellbeing ──
    if (weekend) {
      // Fin de semana: stress 2, energy 3–4, motivation 3.
      wellbeing.push({
        user_id: USER_ID,
        checked_at: mxLocalToUtcISO(year, month1, day, 11, 0),
        checkin_date: dateStr,
        energy: dow === SAT ? 4 : 3,
        motivation: 3,
        stress: 2,
      })
    } else if (isStressDay(dow)) {
      // Lunes/miércoles cargados: stress 5, energy 3, motivation 3.
      wellbeing.push({
        user_id: USER_ID,
        checked_at: mxLocalToUtcISO(year, month1, day, 12, 0),
        checkin_date: dateStr,
        energy: 3,
        motivation: 3,
        stress: 5,
      })
    } else {
      // Resto de días de semana: stress 2–3, energy 4, motivation 4.
      wellbeing.push({
        user_id: USER_ID,
        checked_at: mxLocalToUtcISO(year, month1, day, 12, 0),
        checkin_date: dateStr,
        energy: 4,
        motivation: 4,
        stress: day % 2 === 0 ? 3 : 2,
      })
    }

    // ── Mood ──
    // checkin_date es generado del timestamp (CDMX) → fijamos checked_at al
    // mediodía local para que caiga en el día correcto.
    let moodValue: MoodRow['value']
    if (weekend) {
      moodValue = 'neutral'
    } else if (isStressDay(dow)) {
      // Lun/mié más tibio: alterna neutral/struggle de forma estable.
      moodValue = dow === MON ? 'neutral' : 'struggle'
    } else {
      // Otros días de semana: alterna good/neutral de forma estable.
      moodValue = day % 2 === 0 ? 'good' : 'neutral'
    }
    moods.push({
      user_id: USER_ID,
      value: moodValue,
      checked_at: mxLocalToUtcISO(year, month1, day, 12, 0),
    })

    // ── Water ──
    if (weekend) {
      water.push({
        user_id: USER_ID,
        intake_date: dateStr,
        glasses: dow === SAT ? 4 : 5,
      })
    } else {
      // 6–8 vasos, variación estable por día.
      water.push({
        user_id: USER_ID,
        intake_date: dateStr,
        glasses: 6 + (day % 3), // 6 / 7 / 8
      })
    }
  }

  // ── Dos viernes de desvelo (uno por mes) ──
  // fridayOffsets viene de más reciente (menor daysAgo) a más antiguo.
  // El más reciente representa "este mes"; el primero que esté ≥30 días
  // atrás representa "el mes pasado".
  const lateNightFridays = new Set<string>()
  if (fridayOffsets.length > 0) {
    const recent = fridayOffsets[0]!
    lateNightFridays.add(offsetToDateStr(recent))
    const older = fridayOffsets.find((o) => o >= 28)
    if (older !== undefined) lateNightFridays.add(offsetToDateStr(older))
  }
  for (const row of sleep) {
    if (lateNightFridays.has(row.sleep_date)) {
      // ~4 h, calidad 2. Recalcula wake_time = bedtime + 240 min.
      const bed = new Date(row.bedtime)
      row.wake_time = new Date(bed.getTime() + 240 * 60_000).toISOString()
      row.quality = 2
    }
  }

  // ─── Inserts ───────────────────────────────────────────────────────────
  await insertChunked('sleep_logs', sleep)
  await insertChunked('wellbeing_checkins', wellbeing)
  await insertChunked('mood_checkins', moods)
  await insertChunked('meals', meals)
  await insertChunked('workouts', workouts)
  await insertChunked('water_intake', water)
  await insertChunked('rest_days', rest)

  // ── Peso semanal: ~78.0 → ~75.5 kg a lo largo del rango ──
  // Una medición cada 7 días terminando hoy. Caída lineal -2.5 kg sobre
  // ~8 lecturas, con micro-jitter estable para que la curva no sea recta.
  const weekCount = Math.floor(DAYS / 7) + 1 // ~9 lecturas
  for (let w = 0; w < weekCount; w++) {
    const daysAgo = w * 7
    if (daysAgo >= DAYS) break
    const d = localDayFromTodayOffset(daysAgo)
    // w=0 (hoy) = 75.5; el más antiguo ≈ 78.0.
    const base = 75.5 + (w / Math.max(weekCount - 1, 1)) * 2.5
    const jitter = w % 2 === 0 ? 0.1 : -0.1 // ±0.1 estable
    measurements.push({
      user_id: USER_ID,
      measured_at: mxLocalToUtcISO(d.year, d.month1, d.day, 7, 30),
      weight_kg: Number((base + jitter).toFixed(2)),
    })
  }
  await insertChunked('body_measurements', measurements)

  // ─── Resumen ───────────────────────────────────────────────────────────
  console.log('[seed:orbit] Listo. Filas insertadas:')
  console.log(
    `  • sleep_logs:          ${sleep.length}  (incl. ${lateNightFridays.size} viernes de desvelo)`,
  )
  console.log(`  • wellbeing_checkins:  ${wellbeing.length}`)
  console.log(`  • mood_checkins:       ${moods.length}`)
  console.log(`  • meals:               ${meals.length}`)
  console.log(`  • workouts:            ${workouts.length}`)
  console.log(`  • water_intake:        ${water.length}`)
  console.log(`  • rest_days:           ${rest.length}`)
  console.log(`  • body_measurements:   ${measurements.length}`)
  console.log(`  Rango: ${DAYS} días terminando hoy (timezone America/Mexico_City).`)
}

/** Reconstruye el 'YYYY-MM-DD' local para un offset de días dado. */
function offsetToDateStr(daysAgo: number): string {
  const d = localDayFromTodayOffset(daysAgo)
  return mxLocalDateString(d.year, d.month1, d.day)
}

/**
 * Inserta en lotes de 500 para no reventar límites de payload, y aborta
 * con un error claro si Supabase rechaza alguna fila (CHECK / NOT NULL /
 * unique). Genérico sobre la forma de la fila.
 */
async function insertChunked(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    // El client no está tipado con Database<>, así que el insert tipado
    // colapsa a `never`. Casteamos el lote; las formas ya están validadas
    // por los tipos *Row de arriba.
    const { error } = await supabase.from(table).insert(slice as never[])
    if (error) {
      throw new Error(`[seed:orbit] insert en "${table}" falló: ${error.message}`)
    }
  }
}

seed().catch((err) => {
  console.error('[seed:orbit] Failed:', err)
  process.exit(1)
})

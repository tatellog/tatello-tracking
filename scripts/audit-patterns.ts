/*
 * audit-patterns.ts — corre los detectores REALES de Órbita Mes sobre las señales
 * de un usuario y reporta qué patrones disparan, y para los que NO, los stats
 * crudos de cada gate (qué tan cerca estuvieron). Para calibrar el motor vs la
 * promesa "Stelar te dice tus patrones y dónde fallas".
 *
 * Uso:
 *   EXPO_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   AUDIT_EMAIL=dev@local.test  tsx scripts/audit-patterns.ts
 * (las dos primeras suelen vivir en .env → dotenv las carga solo.)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

import { detectMonthPatterns, monthDiscoveries, winningCombo } from '../features/orbit/month-built'
import { isDeficitDay } from '../features/orbit/deficit'
import type { DailySignals } from '../features/orbit/api'

config({ path: '.env.local' })
config()

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.AUDIT_EMAIL ?? 'dev@local.test'
const WINDOW = Number(process.env.AUDIT_DAYS ?? 90)
const SLEEP_7H = 420 // 7 h en minutos (mismo umbral que el motor)

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (en .env o env).')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const isoBack = (days: number): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
const weekdayMon = (day: string): number => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—')
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

async function main(): Promise<void> {
  // Usuario: DEV_USER_ID directo si existe, si no por email.
  let uid = process.env.DEV_USER_ID ?? null
  if (!uid) {
    const { data: list, error: e1 } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (e1) throw e1
    const found = list.users.find((u) => u.email === email)
    if (!found) {
      console.error(`No encontré el usuario ${email} (ni DEV_USER_ID en env).`)
      process.exit(1)
    }
    uid = found.id
  }

  const from = isoBack(WINDOW - 1)
  const { data, error } = await admin
    .from('daily_signals')
    .select('*')
    .eq('user_id', uid)
    .gte('day', from)
    .order('day', { ascending: true })
  if (error) throw error
  const signals = (data ?? []) as unknown as DailySignals[]

  // Necesito la meta calórica del usuario (de macro_targets) para los gates.
  const { data: mt } = await admin
    .from('macro_targets')
    .select('calories, protein_g')
    .eq('user_id', uid)
    .maybeSingle()
  const calorieTarget = mt?.calories ?? null
  const proteinTarget = mt?.protein_g ?? null

  const food = signals.filter((s) => (s.meal_count ?? 0) > 0 && s.calories != null)
  const deficitDays = food.filter((s) => calorieTarget && isDeficitDay(s.calories, calorieTarget))

  console.log(`\n=== AUDITORÍA DE PATRONES · ${email} ===`)
  console.log(`Ventana: últimos ${WINDOW} días (${from} → ${isoBack(0)})`)
  console.log(`Meta calórica: ${calorieTarget ?? 'SIN META'} · proteína: ${proteinTarget ?? '—'}`)
  console.log(
    `Días con dato: ${signals.length} · con comida: ${food.length} · en déficit: ${deficitDays.length}`,
  )

  const opts = { calorieTarget, proteinTarget, waterGoalGlasses: 8 }

  // ── Detectores REALES ──
  console.log(`\n— winningCombo (patrón dominante) —`)
  const combo = winningCombo(signals, opts)
  if (combo) {
    console.log(
      `  ✓ DISPARA: ${combo.signals.map((s) => s.label).join(' + ')} · ${combo.occurrences} coincidencias · ${combo.deficits} en déficit`,
    )
  } else {
    console.log(`  ✗ no dispara (ninguna combinación ≥3 coincidencias con ≥50% en déficit)`)
  }

  console.log(`\n— detectMonthPatterns (alimenta "Tus patrones") —`)
  const patterns = detectMonthPatterns(signals, { calorieTarget, proteinTarget })
  if (patterns.length === 0) console.log('  (ninguno dispara)')
  for (const p of patterns) {
    console.log(`  ✓ [${p.kind}] ${p.id}: ${p.title}`)
    if (p.weekdayShape) {
      const dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      console.log(
        `     forma: ${p.weekdayShape.week.map((d, i) => `${dow[i]} ${d.total ? Math.round(d.rate * 100) + '%' : '·'}`).join('  ')}`,
      )
      console.log(`     lado fuerte (iluminado): ${p.weekdayShape.strongSide}`)
    }
  }

  console.log(`\n— monthDiscoveries (función paralela, hoy sin usar en UI) —`)
  const discos = monthDiscoveries(signals, { calorieTarget, proteinTarget })
  if (discos.length === 0) console.log('  (ninguno dispara)')
  for (const d of discos) console.log(`  ✓ ${d.id}: ${d.title}`)

  // ── Stats crudos por gate (qué tan cerca de disparar) ──
  console.log(`\n— Stats crudos por gate (qué tan cerca) —`)
  if (calorieTarget) {
    const wd = food.filter((s) => weekdayMon(s.day!) < 5)
    const wdDef = wd.filter((s) => isDeficitDay(s.calories, calorieTarget)).length
    console.log(
      `  deficit-weekday: ${wd.length} días L-V, ${wdDef} en déficit (${pct(wdDef, wd.length)}) · gate: ≥5 días y ≥60%`,
    )

    let wSurp = 0
    let weSurp = 0
    for (const s of food) {
      const over = s.calories! - calorieTarget
      if (over <= 0) continue
      if (weekdayMon(s.day!) < 5) wSurp += over
      else weSurp += over
    }
    const totS = wSurp + weSurp
    console.log(
      `  weekend-surplus (FALLA): superávit total ${Math.round(totS)} kcal, finde ${Math.round(weSurp)} (${pct(weSurp, totS)}) · gate: ≥1000 kcal y ≥60% finde`,
    )

    const withSleep = food.filter((s) => s.sleep_minutes != null)
    const high = withSleep.filter((s) => s.sleep_minutes! >= SLEEP_7H)
    const low = withSleep.filter((s) => s.sleep_minutes! < SLEEP_7H)
    const dh = high.filter((s) => isDeficitDay(s.calories, calorieTarget)).length
    const dl = low.filter((s) => isDeficitDay(s.calories, calorieTarget)).length
    console.log(
      `  sleep-deficit: ≥7h ${high.length}d (${pct(dh, high.length)} en déficit), <7h ${low.length}d (${pct(dl, low.length)}) · gate: ≥3+3 días y efecto marcado`,
    )

    // second-half (falla de "abandono", hoy en la función sin usar)
    const dayOf = (s: DailySignals): number => Number(s.day!.slice(8, 10))
    const f1 = food.filter((s) => dayOf(s) <= 15)
    const f2 = food.filter((s) => dayOf(s) > 15)
    const o1 = f1.filter((s) => s.calories! > calorieTarget).length
    const o2 = f2.filter((s) => s.calories! > calorieTarget).length
    console.log(
      `  second-half: 1ª mitad ${o1} días sobre meta, 2ª mitad ${o2} · gate: ≥3+3 días y (o1-o2)≥2`,
    )
  } else {
    console.log('  (sin meta calórica → los gates de déficit/superávit no aplican)')
  }

  const withP = signals.filter((s) => s.protein_g != null)
  const tp = withP.filter((s) => s.trained === true).map((s) => s.protein_g!)
  const np = withP.filter((s) => s.trained !== true).map((s) => s.protein_g!)
  console.log(
    `  training-protein: entreno ${tp.length}d (avg ${Math.round(avg(tp))}g), sin ${np.length}d (avg ${Math.round(avg(np))}g), diff ${Math.round(avg(tp) - avg(np))}g · gate: ≥3+3 días y +12g`,
  )

  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

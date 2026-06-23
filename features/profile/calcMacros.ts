import { type BiologicalSex, type MonthlyFocus, type TrainingFrequency } from './api'

/*
 * Macro engine. Computes calorie / macro targets from the profile
 * fields gathered during the wizard, and powers the goal editor
 * (enfoque + nivel) where the user re-tunes them later.
 *
 * Pipeline (all pure, all here so onboarding and the editor never
 * drift):
 *   profile ──► BMR (Mifflin-St Jeor) ──► TDEE (× activity)
 *           ──► + kcal delta (enfoque + nivel) ──► calorie target
 *           ──► protein (g/kg by enfoque) + fat (g/kg) + carbs (rest)
 *
 * STELAR's voice avoids "you must eat X" — these are guides, not
 * prescriptions. The editor frames them as such.
 */

/* ─── shared profile inputs ──────────────────────────────────────── */

export type MacroInputs = {
  /** kg, from body_measurements.weight_kg */
  weight_kg: number | null
  /** cm, from profiles.height_cm */
  height_cm: number | null
  /** YYYY-MM-DD, from profiles.date_of_birth — drives age in years */
  date_of_birth: string | null
  biological_sex: BiologicalSex | null
  /** Replaces the legacy `goal` enum. The wizard's intention step
   *  collects this; we derive the kcal / protein deltas internally. */
  monthly_focus: MonthlyFocus | null
  training_frequency: TrainingFrequency | null
}

/* ─── enfoque + nivel model (the editor's controls) ──────────────── */

/** Direction of the calorie target vs maintenance. */
export type Enfoque = 'deficit' | 'maintain' | 'surplus'

/** Magnitude bucket within deficit / surplus. Maintain has no level. */
export type Nivel = 'light' | 'moderate' | 'marked'

export type NivelOption = {
  key: Nivel
  /** UI label — guilt-free per manifesto ("Marcado", never "Agresivo"). */
  label: string
  /** kcal vs TDEE. Negative = deficit, positive = surplus. */
  delta: number
}

// The slider stops, ordered for display. Deficit reads strongest →
// gentlest top-to-bottom in the mockup, but we keep the array gentle →
// strong and let the component map positions.
export const DEFICIT_LEVELS: readonly NivelOption[] = [
  { key: 'light', label: 'Ligero', delta: -250 },
  { key: 'moderate', label: 'Moderado', delta: -475 },
  { key: 'marked', label: 'Marcado', delta: -750 },
]

export const SURPLUS_LEVELS: readonly NivelOption[] = [
  { key: 'light', label: 'Ligero', delta: 150 },
  { key: 'moderate', label: 'Moderado', delta: 250 },
  { key: 'marked', label: 'Marcado', delta: 400 },
]

export function levelsFor(enfoque: Enfoque): readonly NivelOption[] {
  if (enfoque === 'deficit') return DEFICIT_LEVELS
  if (enfoque === 'surplus') return SURPLUS_LEVELS
  return []
}

/* ─── tuning constants ───────────────────────────────────────────── */

const ACTIVITY_MULTIPLIER: Record<TrainingFrequency, number> = {
  none: 1.2,
  low: 1.375,
  mid: 1.55,
  high: 1.725,
}

/** Short label for the TDEE breakdown screen ("Actividad: Moderada"). */
export const ACTIVITY_LABEL: Record<TrainingFrequency, string> = {
  none: 'En reposo',
  low: 'Ligera',
  mid: 'Moderada',
  high: 'Alta',
}

// Protein g/kg of body weight. Higher in a deficit to protect muscle
// during weight loss; moderate at maintenance; supportive in surplus.
const PROTEIN_PER_KG: Record<Enfoque, number> = {
  deficit: 2.1,
  maintain: 1.8,
  surplus: 2.0,
}

// Fat floor g/kg of body weight (hormonal health). Carbs take whatever
// energy is left, so fat is a fixed anchor, not a percentage.
const FAT_PER_KG = 0.9

/* ─── outputs ────────────────────────────────────────────────────── */

/** The four numbers the goal editor + breakdown render. */
export type FullMacros = {
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
}

/** Back-compat shape consumed by the onboarding reveal + macro_targets
 *  upsert (only protein + calories are persisted; fat/carbs derive). */
export type MacroTargets = {
  protein_g: number
  calories: number
}

/* ─── TDEE ───────────────────────────────────────────────────────── */

/**
 * Maintenance calories (TDEE) from the profile. Returns null if any
 * required input is missing so callers can fall back to manual entry.
 */
export function computeTdee(input: MacroInputs): number | null {
  const { weight_kg, height_cm, date_of_birth, biological_sex, training_frequency } = input
  if (
    weight_kg == null ||
    height_cm == null ||
    date_of_birth == null ||
    biological_sex == null ||
    training_frequency == null
  ) {
    return null
  }
  const age = ageInYears(date_of_birth)
  if (age == null) return null

  // Mifflin-St Jeor: female subtracts 161, male adds 5.
  const sexConstant = biological_sex === 'female' ? -161 : 5
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + sexConstant
  return Math.round(bmr * ACTIVITY_MULTIPLIER[training_frequency])
}

/* ─── full macro distribution for a chosen delta ─────────────────── */

/**
 * Calories + protein + fat + carbs for a given enfoque and kcal delta.
 * `enfoque` drives the protein ratio; `kcalDelta` shifts calories off
 * TDEE (0 for maintain). Returns null if the profile can't yield a TDEE.
 *
 * Carbs are the energy remainder after protein and fat, so calories
 * stay the single source of truth (the mockup's standalone g/kg carbs
 * didn't energy-balance — this does). Clamped to the macro_targets
 * safe band so a quirky profile never trips the DB CHECK.
 */
export function macrosForDelta(
  input: MacroInputs,
  enfoque: Enfoque,
  kcalDelta: number,
): FullMacros | null {
  const tdee = computeTdee(input)
  if (tdee == null || input.weight_kg == null) return null

  // Band IDÉNTICA a la del MacroTargetsInputSchema (features/macros/api.ts):
  // calorías [1000, 5000], proteína [50, 300]. Solo se persisten calorías +
  // proteína, así que estas dos deben caer SIEMPRE dentro del esquema o el
  // upsert falla con "No se pudo guardar" (p. ej. un déficit marcado sobre un
  // TDEE bajo producía 938 kcal < 1000). fat/carbs no se guardan.
  const calories = clamp(Math.round(tdee + kcalDelta), 1000, 5000)
  const protein_g = clamp(Math.round(input.weight_kg * PROTEIN_PER_KG[enfoque]), 50, 300)
  const fat_g = clamp(Math.round(input.weight_kg * FAT_PER_KG), 20, 200)
  const carbsKcal = calories - protein_g * 4 - fat_g * 9
  const carbs_g = clamp(Math.round(carbsKcal / 4), 0, 800)

  return { calories, protein_g, fat_g, carbs_g }
}

/**
 * Reconstruct the editor state ({ enfoque, level, delta }) from a saved
 * calorie target, by comparing it to the live TDEE. Lets the editor
 * re-open on the user's current choice without persisting it. Returns
 * null when there's no TDEE (incomplete profile → manual fallback).
 *
 * A small dead-band around 0 reads as "maintain" so a near-maintenance
 * target doesn't snap to a deficit/surplus label.
 */
export function reconstructState(
  savedCalories: number,
  input: MacroInputs,
): { enfoque: Enfoque; level: Nivel | null; delta: number } | null {
  const tdee = computeTdee(input)
  if (tdee == null) return null
  const delta = savedCalories - tdee

  const MAINTAIN_BAND = 80
  if (Math.abs(delta) <= MAINTAIN_BAND) {
    return { enfoque: 'maintain', level: null, delta: 0 }
  }
  const enfoque: Enfoque = delta < 0 ? 'deficit' : 'surplus'
  const level = nearestLevel(levelsFor(enfoque), delta)
  return { enfoque, level: level.key, delta }
}

/**
 * Human label for an enfoque + nivel ("Déficit moderado", "Superávit
 * ligero", "Mantenimiento"). Shared by the editor chip on Hoy and the
 * breakdown screen so the wording never drifts.
 */
export function enfoqueLabel(enfoque: Enfoque, level: Nivel | null): string {
  if (enfoque === 'maintain') return 'Mantenimiento'
  const base = enfoque === 'surplus' ? 'Superávit' : 'Déficit'
  const lvl = levelsFor(enfoque).find((l) => l.key === level)
  return lvl ? `${base} ${lvl.label.toLowerCase()}` : base
}

/* ─── back-compat: onboarding reveal seed ────────────────────────── */

/**
 * Starting targets from the wizard. `monthly_focus === 'weight'` seeds
 * a moderate deficit; everything else maintains. Delegates to the
 * shared engine so the seed never drifts from the editor's math.
 * Returns null if the profile is incomplete (caller keeps macros
 * undefined and opens manual entry from Settings).
 */
export function calculateMacros(input: MacroInputs): MacroTargets | null {
  const enfoque: Enfoque = input.monthly_focus === 'weight' ? 'deficit' : 'maintain'
  const delta = enfoque === 'deficit' ? deltaForLevel(DEFICIT_LEVELS, 'moderate') : 0
  const full = macrosForDelta(input, enfoque, delta)
  if (full == null) return null
  return { protein_g: full.protein_g, calories: full.calories }
}

/* ─── helpers ────────────────────────────────────────────────────── */

function deltaForLevel(levels: readonly NivelOption[], key: Nivel): number {
  return levels.find((l) => l.key === key)?.delta ?? 0
}

function nearestLevel(levels: readonly NivelOption[], delta: number): NivelOption {
  return levels.reduce((best, l) =>
    Math.abs(l.delta - delta) < Math.abs(best.delta - delta) ? l : best,
  )
}

function ageInYears(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [, y, mo, d] = m
  const birth = new Date(Number(y), Number(mo) - 1, Number(d))
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? age : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

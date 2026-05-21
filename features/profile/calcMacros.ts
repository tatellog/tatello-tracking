import { type BiologicalSex, type MonthlyFocus, type TrainingFrequency } from './api'

/*
 * Compute starting macro targets from the profile fields gathered
 * during the wizard. Used by the reveal screen to seed the user's
 * macro_targets so they enter the app with a usable baseline; they
 * can edit any time from Settings → Mis metas (via the existing
 * /onboarding/macro-targets?source=settings flow).
 *
 * Calorie target uses Mifflin-St Jeor for BMR and a coarse activity
 * multiplier mapped from `training_frequency`. The deficit (if any)
 * comes from `monthly_focus` — only `weight` triggers a -500 kcal
 * delta; everything else maintains. STELAR's voice avoids
 * "you must eat X" — macros are guides, not prescriptions.
 *
 * Protein target is 1.8 g/kg of body weight when the focus is
 * weight-loss (to support muscle retention during a deficit) and
 * 1.6 g/kg otherwise.
 *
 * Returns null if any required input is missing — the caller should
 * keep macros undefined in that case so the existing manual flow can
 * still be opened from Settings.
 */
export type MacroTargets = {
  protein_g: number
  calories: number
}

export type MacroInputs = {
  /** kg, from body_measurements.weight_kg */
  weight_kg: number | null
  /** cm, from profiles.height_cm */
  height_cm: number | null
  /** YYYY-MM-DD, from profiles.date_of_birth — drives age in years */
  date_of_birth: string | null
  biological_sex: BiologicalSex | null
  /** Replaces the legacy `goal` enum. The wizard's tu-intencion step
   *  collects this; we derive the kcal / protein deltas internally. */
  monthly_focus: MonthlyFocus | null
  training_frequency: TrainingFrequency | null
}

const ACTIVITY_MULTIPLIER: Record<TrainingFrequency, number> = {
  none: 1.2,
  low: 1.375,
  mid: 1.55,
  high: 1.725,
}

/** Internal derived band. `monthly_focus` collapses to two macro
 *  modes: weight-loss (deficit + higher protein) or maintain. Other
 *  intentions (energy, sleep, food, cycle, patterns, mind, other)
 *  don't imply a calorie target — the user can refine from Settings. */
type MacroMode = 'lose_fat' | 'maintain'

const MODE_DELTA_KCAL: Record<MacroMode, number> = {
  lose_fat: -500,
  maintain: 0,
}

const MODE_PROTEIN_PER_KG: Record<MacroMode, number> = {
  lose_fat: 1.8,
  maintain: 1.6,
}

function focusToMode(focus: MonthlyFocus | null): MacroMode {
  return focus === 'weight' ? 'lose_fat' : 'maintain'
}

export function calculateMacros(input: MacroInputs): MacroTargets | null {
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
  const tdee = bmr * ACTIVITY_MULTIPLIER[training_frequency]

  const mode = focusToMode(input.monthly_focus)
  const calories = Math.round(tdee + MODE_DELTA_KCAL[mode])
  const protein_g = Math.round(weight_kg * MODE_PROTEIN_PER_KG[mode])

  // Clamp to the schema's safe range. The macro_targets CHECK
  // constraint rejects values outside the human plausible band; we
  // saturate here so a quirky input (very low weight, no entreno)
  // never trips the DB validation.
  return {
    protein_g: clamp(protein_g, 30, 350),
    calories: clamp(calories, 900, 6000),
  }
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

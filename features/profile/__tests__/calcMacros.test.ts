import {
  calculateMacros,
  computeTdee,
  DEFICIT_LEVELS,
  levelsFor,
  macrosForDelta,
  reconstructState,
  SURPLUS_LEVELS,
  type MacroInputs,
} from '@/features/profile/calcMacros'

// A complete reference profile. 65 kg / 165 cm / female, born so that
// `ageInYears` resolves to a stable value relative to a fixed clock.
const BASE: MacroInputs = {
  weight_kg: 65,
  height_cm: 165,
  date_of_birth: '1998-01-01',
  biological_sex: 'female',
  monthly_focus: 'weight',
  training_frequency: 'mid',
}

// Pin the clock so ageInYears is deterministic (jest uses fake timers
// per the project's other date-sensitive suites).
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 5, 21))
})
afterAll(() => {
  jest.useRealTimers()
})

describe('computeTdee', () => {
  it('computes Mifflin-St Jeor × activity for a complete profile', () => {
    // BMR = 10*65 + 6.25*165 - 5*28 - 161 = 650 + 1031.25 - 140 - 161 = 1380.25
    // TDEE = 1380.25 * 1.55 (mid) = 2139.4 → 2139
    expect(computeTdee(BASE)).toBe(2139)
  })

  it('returns null when any required input is missing', () => {
    expect(computeTdee({ ...BASE, weight_kg: null })).toBeNull()
    expect(computeTdee({ ...BASE, height_cm: null })).toBeNull()
    expect(computeTdee({ ...BASE, date_of_birth: null })).toBeNull()
    expect(computeTdee({ ...BASE, biological_sex: null })).toBeNull()
    expect(computeTdee({ ...BASE, training_frequency: null })).toBeNull()
  })

  it('returns null for an unparseable birth date', () => {
    expect(computeTdee({ ...BASE, date_of_birth: 'nope' })).toBeNull()
  })
})

describe('macrosForDelta', () => {
  it('subtracts the deficit from TDEE and sets protein/fat by g/kg', () => {
    const tdee = computeTdee(BASE)!
    const m = macrosForDelta(BASE, 'deficit', -475)!
    expect(m.calories).toBe(tdee - 475)
    expect(m.protein_g).toBe(Math.round(65 * 2.1)) // 137
    expect(m.fat_g).toBe(Math.round(65 * 0.9)) // 59
  })

  it('carbs are the energy remainder, never negative', () => {
    const m = macrosForDelta(BASE, 'deficit', -475)!
    const expectedCarbs = Math.round((m.calories - m.protein_g * 4 - m.fat_g * 9) / 4)
    expect(m.carbs_g).toBe(Math.max(0, expectedCarbs))
    expect(m.carbs_g).toBeGreaterThanOrEqual(0)
  })

  it('maintain uses delta 0 and the lower protein ratio', () => {
    const tdee = computeTdee(BASE)!
    const m = macrosForDelta(BASE, 'maintain', 0)!
    expect(m.calories).toBe(tdee)
    expect(m.protein_g).toBe(Math.round(65 * 1.8)) // 117
  })

  it('surplus adds calories above TDEE', () => {
    const tdee = computeTdee(BASE)!
    const m = macrosForDelta(BASE, 'surplus', 250)!
    expect(m.calories).toBe(tdee + 250)
  })

  it('returns null on an incomplete profile', () => {
    expect(macrosForDelta({ ...BASE, weight_kg: null }, 'deficit', -475)).toBeNull()
  })
})

describe('reconstructState', () => {
  it('round-trips a saved deficit target back to enfoque + level', () => {
    const m = macrosForDelta(BASE, 'deficit', -475)!
    const state = reconstructState(m.calories, BASE)!
    expect(state.enfoque).toBe('deficit')
    expect(state.level).toBe('moderate')
  })

  it('reads a near-maintenance target as maintain (dead-band)', () => {
    const tdee = computeTdee(BASE)!
    const state = reconstructState(tdee - 30, BASE)!
    expect(state.enfoque).toBe('maintain')
    expect(state.level).toBeNull()
  })

  it('reads an above-TDEE target as surplus', () => {
    const tdee = computeTdee(BASE)!
    const state = reconstructState(tdee + 250, BASE)!
    expect(state.enfoque).toBe('surplus')
    expect(state.level).toBe('moderate')
  })

  it('returns null without a TDEE', () => {
    expect(reconstructState(1500, { ...BASE, weight_kg: null })).toBeNull()
  })
})

describe('levelsFor', () => {
  it('exposes deficit / surplus stops and nothing for maintain', () => {
    expect(levelsFor('deficit')).toBe(DEFICIT_LEVELS)
    expect(levelsFor('surplus')).toBe(SURPLUS_LEVELS)
    expect(levelsFor('maintain')).toHaveLength(0)
  })
})

describe('calculateMacros (onboarding seed, back-compat)', () => {
  it('seeds a moderate deficit when the focus is weight', () => {
    const seed = calculateMacros(BASE)!
    const moderate = macrosForDelta(BASE, 'deficit', -475)!
    expect(seed.calories).toBe(moderate.calories)
    expect(seed.protein_g).toBe(moderate.protein_g)
  })

  it('maintains for a non-weight focus', () => {
    const tdee = computeTdee(BASE)!
    const seed = calculateMacros({ ...BASE, monthly_focus: 'energy' })!
    expect(seed.calories).toBe(tdee)
  })

  it('returns null on an incomplete profile', () => {
    expect(calculateMacros({ ...BASE, height_cm: null })).toBeNull()
  })
})

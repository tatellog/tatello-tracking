import { earlyReading } from '../early-readings'

import type { DailySignals } from '../../../supabase/functions/_shared/intelligence/types'

const TODAY = '2026-07-04'
const YESTERDAY = '2026-07-03'
const DAY_BEFORE = '2026-07-02'

function sig(day: string, patch: Partial<DailySignals> = {}): DailySignals {
  return {
    day,
    user_id: 'u',
    calories: null,
    protein_g: null,
    meal_count: null,
    water_glasses: null,
    sleep_minutes: null,
    sleep_quality: null,
    trained: null,
    workout_type: null,
    rested: null,
    mood: null,
    energy: null,
    motivation: null,
    stress: null,
    on_period: null,
    weight_kg: null,
    wellbeing_checkins: null,
    ...patch,
  } as DailySignals
}

describe('earlyReading — la lectura garantizada n=2', () => {
  it('sin historia no inventa nada (promesa honesta del caller)', () => {
    expect(earlyReading([], TODAY)).toBeNull()
  })

  it('la misma señal ayer y antier = repetición naciente, SIN contar días consecutivos', () => {
    const r = earlyReading(
      [sig(DAY_BEFORE, { sleep_minutes: 420 }), sig(YESTERDAY, { sleep_minutes: 400 })],
      TODAY,
    )
    expect(r?.text).toContain('sueño')
    // Sin lenguaje de racha (manifiesto): la frecuencia se siente, no se cuenta.
    expect(r?.text).not.toMatch(/seguidos|consecutiv|racha|días/i)
  })

  it('con varias señales repetidas gana comida (el norte del producto)', () => {
    const r = earlyReading(
      [
        sig(DAY_BEFORE, { meal_count: 2, sleep_minutes: 420 }),
        sig(YESTERDAY, { meal_count: 3, sleep_minutes: 400 }),
      ],
      TODAY,
    )
    expect(r?.text).toContain('comida')
  })

  it('solo ayer con registros → nombra la huella de ayer, sin juicio', () => {
    const r = earlyReading([sig(YESTERDAY, { meal_count: 2, water_glasses: 4 })], TODAY)
    expect(r?.text).toContain('Ayer')
    expect(r?.text).not.toMatch(/falt|debi|solo/i)
    // "señales" choca con "Señal Naciente" (glosario V2) en este contexto.
    expect(r?.text).not.toContain('señales')
  })

  it('ayer en silencio → null (la ausencia calla, nunca reprocha)', () => {
    const r = earlyReading([sig(DAY_BEFORE, { meal_count: 2 })], TODAY)
    expect(r).toBeNull()
  })

  it('nunca compara en clave de caída', () => {
    const r = earlyReading(
      [sig(DAY_BEFORE, { water_glasses: 8 }), sig(YESTERDAY, { water_glasses: 1 })],
      TODAY,
    )
    // Ambos días con agua = repetición naciente; jamás "menos que ayer".
    expect(r?.text).not.toMatch(/menos|bajó|caíd/i)
  })
})

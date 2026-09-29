/*
 * La hora de dormirse ↔ el día siguiente (sorpresa "Lo que no sabías").
 *
 * El reloj guarda a qué hora te dormiste (wearable_sleep.bedtime_at) y hasta
 * ahora nadie lo leía. Este detector parte tus noches en dos por la mitad de
 * tus propias horas (no por una hora "correcta") y compara la tasa de días en
 * déficit DESPUÉS de dormirte tarde contra dormirte antes. Observa, nunca
 * receta: la frase dice lo que pasa en tus días, no "acuéstate temprano".
 *
 * Convención: la noche pertenece al día en que despertó (sleep_date), así que
 * el "día siguiente" es exactamente ese día en daily_signals.
 */
import { isDeficitDay } from './deficit.ts'
import type { Surprise, SurpriseOpts } from './surprise.ts'
import type { DailySignals } from './types.ts'

const MIN_SIDE = 3
/** Ventaja mínima (en tasa) para hablar: la misma que pasos ↔ déficit. */
const MIN_ADVANTAGE = 0.2
/** Por debajo de esta hora no hay "tarde" que decir (antes de las 11 pm). */
const LATE_FLOOR = 5 * 60 // 23:00 en minutos desde las 18:00

/**
 * Hora local de dormirse como minutos desde las 6 pm (23:30 → 330, 1:00 →
 * 420): así la medianoche no parte la escala y "más tarde" siempre es mayor.
 */
export function bedtimeOffsetMinutes(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return (((h - 18 + 24) % 24) * 60 + m) % 1440
}

/** "a las 11:30 pm" / "después de medianoche" / "a la 1 am". */
function atHour(offset: number): string {
  const total = (offset + 18 * 60) % 1440
  const h24 = Math.floor(total / 60)
  const m = total % 60
  if (h24 === 0 && m === 0) return 'después de medianoche'
  const h12 = h24 % 12 || 12
  const ap = h24 < 12 ? 'am' : 'pm'
  const clock = m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`
  return `${h12 === 1 ? 'a la' : 'a las'} ${clock} ${ap}`
}

/** "a la 1 am" → "de la 1 am"; "después de medianoche" → "de medianoche". */
function beforeLabel(when: string): string {
  return when === 'después de medianoche' ? 'de medianoche' : when.replace(/^a /, 'de ')
}

export function lateBedtimeEffect(
  signals: readonly DailySignals[],
  opts: SurpriseOpts,
): Surprise | null {
  const target = opts.calorieTarget ?? null
  const bedtimes = opts.bedtimes
  if (target == null || target <= 0 || !bedtimes || bedtimes.size === 0) return null

  const byDay = new Map<string, DailySignals>()
  for (const s of signals) if (s.day) byDay.set(s.day, s)
  const nights = [...bedtimes.entries()]
    .map(([day, bt]) => ({ day, bt, s: byDay.get(day) }))
    .filter((n) => n.s != null && n.s.calories != null && n.s.calories > 0)
  if (nights.length < MIN_SIDE * 2) return null

  const sorted = [...nights].sort((a, b) => a.bt - b.bt)
  // Corte en la mediana, redondeado a la media hora hacia abajo: "a la 1 o más
  // tarde" siempre es verdad para esas noches.
  const cut = Math.floor(sorted[Math.floor(sorted.length / 2)]!.bt / 30) * 30
  if (cut < LATE_FLOOR) return null
  const late = nights.filter((n) => n.bt >= cut)
  const early = nights.filter((n) => n.bt < cut)
  if (late.length < MIN_SIDE || early.length < MIN_SIDE) return null

  const ld = late.filter((n) => isDeficitDay(n.s!.calories, target)).length
  const ed = early.filter((n) => isDeficitDay(n.s!.calories, target)).length
  const diff = ed / early.length - ld / late.length
  if (diff < MIN_ADVANTAGE) return null

  const when = atHour(cut)
  const late_label =
    when === 'después de medianoche'
      ? 'Tras dormirte después de medianoche'
      : `Tras dormirte ${when} o más tarde`
  return {
    id: 'late-bedtime',
    headline:
      when === 'después de medianoche'
        ? 'Cuando te duermes después de medianoche, al día siguiente cierras en déficit menos seguido.'
        : `Cuando te duermes ${when} o más tarde, al día siguiente cierras en déficit menos seguido.`,
    rows: [
      {
        label: `Tras dormirte antes ${beforeLabel(when)}`,
        value: `${ed} de ${early.length}`,
        strong: true,
      },
      { label: late_label, value: `${ld} de ${late.length}` },
    ],
    days: late.map((n) => n.day).sort(),
    effect: Math.min(1, diff / 0.5),
    minSide: Math.min(late.length, early.length),
    expected: false,
    delayed: true, // anoche → hoy
    contradicts: false,
    fromWatch: true,
  }
}

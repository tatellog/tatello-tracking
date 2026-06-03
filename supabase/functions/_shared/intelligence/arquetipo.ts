/*
 * The week archetype — names the SHAPE of the week (its rhythm), never a
 * grade. Pure; shared by app + Edge Functions. Moved out of mock.ts.
 */
import type { DiaSemana } from './types'

const EN_LUZ_THRESHOLD_WEEK = 0.7

function average(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function buildArquetipoSemana(
  days: readonly DiaSemana[],
  todayIdx: number,
): {
  name: string
  emphasis: string
  daysEnLuz: number
  nochesRotas: number
  daysRead: number
  signals: number
  arcNumber: number
  arcTotal: number
} {
  const lived = days.slice(0, todayIdx + 1)
  const daysRead = lived.length
  const daysEnLuz = lived.filter((d) => d.brightness >= EN_LUZ_THRESHOLD_WEEK).length
  const signals = lived.reduce((s, d) => s + d.dimEnLuz + d.drift, 0) * 2

  // The week archetype names the *shape* of the week — its rhythm — never
  // a grade of how many days were "good".
  let name = 'la semana arrancando'
  let emphasis = 'arrancando'
  if (daysRead >= 2) {
    const bs = lived.map((d) => d.brightness)
    const mid = Math.max(1, Math.floor(bs.length / 2))
    const firstAvg = average(bs.slice(0, mid))
    const secondAvg = average(bs.slice(mid))
    const range = Math.max(...bs) - Math.min(...bs)
    if (range < 0.18) {
      name = 'la semana pareja'
      emphasis = 'pareja'
    } else if (secondAvg - firstAvg > 0.1) {
      name = 'la semana que sube'
      emphasis = 'sube'
    } else if (firstAvg - secondAvg > 0.1) {
      name = 'la semana que afloja'
      emphasis = 'afloja'
    } else {
      name = 'la semana de vaivén'
      emphasis = 'vaivén'
    }
  }

  return {
    name,
    emphasis,
    daysEnLuz,
    nochesRotas: 0,
    daysRead,
    signals,
    arcNumber: 3,
    arcTotal: 8,
  }
}

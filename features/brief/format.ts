const MINUS = '−'

export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${MINUS}${Math.abs(n)}`
  return `${n}`
}

export function formatDelta(value: number, unit: string): string {
  return `${formatSigned(value)} ${unit}`
}

export function formatProgressDeltas(input: {
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}): string {
  const weight = formatDelta(input.weightDeltaKg, 'kg')
  const waist = `cintura ${formatDelta(input.waistDeltaCm, 'cm')}`
  const period = `${input.periodWeeks} semanas`
  return `${weight} · ${waist} · ${period}`
}

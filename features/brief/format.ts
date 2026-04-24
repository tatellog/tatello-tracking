const MINUS = '−'

function formatSigned(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${MINUS}${Math.abs(n)}`
  return `${n}`
}

export function formatProgressDeltas(input: {
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}): string {
  const weight = `${formatSigned(input.weightDeltaKg)} kg`
  const waist = `cintura ${formatSigned(input.waistDeltaCm)} cm`
  const period = `${input.periodWeeks} semanas`
  return `${weight} · ${waist} · ${period}`
}

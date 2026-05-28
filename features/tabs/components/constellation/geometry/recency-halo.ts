/*
 * Days-since-marked → halo intensity multiplier for lit stars. Stars
 * marked in the last week shine the brightest halo; halos fade across
 * days 7..21 toward a floor that keeps old-lit stars visible without
 * competing with recent ones. Two-segment piecewise linear keeps the
 * shape readable and easy to tune.
 */
export function recencyHaloMultiplier(days: number): number {
  // TODAY's star (days === 0) gets a 1.45× boost — the figure
  // visibly responds to the coach copy ("Hoy encendiste X") with a
  // brighter halo on the same star, tying the words to the figure.
  if (days <= 0) return 1.45
  if (days <= 7) return 1 - (days / 7) * 0.45 // 1.0 → 0.55 over 7 days
  if (days <= 21) return 0.55 - ((days - 7) / 14) * 0.37 // 0.55 → 0.18 over next 14
  return 0.18 // floor — old stars still glow, just quietly
}

import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Defs, G, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedCircle } from '../../animation/animated-components'

import { ParticleBurst } from './particle-burst'

// Gold spark palette — leads with WHITE so sparks pop on the sepia art,
// then warms through the oro family (no mid-gold, which muddies).
const GOLD_HUES = ['#FFFFFF', colors.oroLeche, colors.oroLight, colors.oroSoft] as const
const GOLD_REACH = 195
const GOLD_COUNT_SCALE = 2
const GOLD_WIDTH_SCALE = 1.5

/* ─ Burst effect — round firework on each commit ───────────────────
 *
 * On every day-mark, a bright core flashes at centre and PARTICLE_COUNT
 * sparks burst out as a round firework: the sparks are spaced at even
 * angles and all travel the same reach, so their heads stay on one
 * expanding circle. Each spark is a streak — the segment between its
 * position now and a beat earlier — radiating cleanly outward, then
 * flickering and fading. No gravity, no per-spark jitter: the ring
 * stays perfectly circular.
 *
 * Two clocks feed this component:
 *   · `pulse` — radialPulse (2200 ms, Easing.out(cubic), FRONT-LOADED).
 *     Drives the magenta (Órbita / dev / test) burst, UNCHANGED.
 *   · `burstClock` — goldBurst (2600 ms, anti-front-loaded bezier).
 *     Drives the gold (Home) celebration so its expansion reads as an
 *     appreciable motion instead of a snap. Falls back to `pulse` if not
 *     supplied.
 *
 * `gold` (Home only) repaints the whole burst as a Genshin-grade GOLDEN
 * celebration — this IS the Day-1 (and every-commit) firework now that
 * the screen overlay is gone. When gold:
 *   · the core becomes a warm white→oro FlashBloom (a destello), not a
 *     small magenta dot,
 *   · a single tenue GoldWave ripples out as support (the irregular
 *     ESTALLIDO now lives in the dedicated GoldFireworks layer — comets,
 *     light dust, star glints and falling embers — not in clean rings),
 *   · GoldFireworks paints the firework itself: crackling comet streaks
 *     in clusters, floating dust, pulsing glints and a second wave of
 *     embers that fall under gravity.
 * Every other call site (Órbita tab, dev, refactor-test) omits `gold`
 * → the magenta dot + magenta ParticleBurst on `pulse`, UNCHANGED.
 */

export function StarBurst({
  cx,
  cy,
  pulse,
  burstClock,
  trainedCount,
  gold = false,
}: {
  cx: number
  cy: number
  /** radialPulse 0→1 (2200 ms). Drives the magenta burst (Órbita / dev /
   *  test) and, as a fallback, the gold burst if `burstClock` is absent. */
  pulse: SharedValue<number>
  /** goldBurst 0→1 (2600 ms, anti-front-loaded). The dedicated slow clock
   *  for the gold celebration so its expansion is appreciable. Optional —
   *  the magenta branch ignores it; the gold branch falls back to `pulse`
   *  when omitted. */
  burstClock?: SharedValue<number>
  /** Day count — drives the early-window (days 2–12) amplification
   *  that flattens the post-day-1 reward cliff. */
  trainedCount: number
  /** Paint the burst GOLD (warm flash core + oro support wave + gold
   *  fireworks) for the Home celebration. Default false → magenta dot +
   *  magenta sparks at baseline scale (Órbita / dev / test, unchanged). */
  gold?: boolean
}) {
  // The gold branch runs on the slow celebration clock; fall back to the
  // shared radialPulse if the Home wiring didn't pass one (keeps the
  // component safe to call without burstClock).
  const goldClock = burstClock ?? pulse
  return (
    <G>
      {gold ? (
        <>
          <Defs>
            {/* Warm destello — white nucleus → oro → transparent, no
                hard edge. Reads as LIGHT born at the centre. */}
            <RadialGradient id="starburst-gold-flash" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="24%" stopColor={colors.oroLeche} stopOpacity={1} />
              <Stop offset="54%" stopColor={colors.oroSoft} stopOpacity={0.85} />
              <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <GoldFlashCore cx={cx} cy={cy} clock={goldClock} />
          {/* Concentric expanding waves (cascade) + the amplified gold
              ParticleBurst. STABLE, known-good version: the bespoke
              GoldFireworks layer was crashing the app on commit, so we
              reverted to this. */}
          <GoldWave
            cx={cx}
            cy={cy}
            clock={goldClock}
            start={0.0}
            end={0.62}
            baseWidth={3.0}
            color={colors.oroLeche}
            rMax={250}
          />
          <GoldWave
            cx={cx}
            cy={cy}
            clock={goldClock}
            start={0.16}
            end={0.74}
            baseWidth={2.2}
            color={colors.oroLight}
            rMax={250}
          />
          <GoldWave
            cx={cx}
            cy={cy}
            clock={goldClock}
            start={0.32}
            end={0.86}
            baseWidth={1.6}
            color={colors.oroSoft}
            rMax={250}
          />
          <ParticleBurst
            cx={cx}
            cy={cy}
            pulse={goldClock}
            trainedCount={trainedCount}
            hues={GOLD_HUES}
            reach={GOLD_REACH}
            countScale={GOLD_COUNT_SCALE}
            widthScale={GOLD_WIDTH_SCALE}
          />
        </>
      ) : (
        <>
          <BurstCore cx={cx} cy={cy} pulse={pulse} />
          <ParticleBurst cx={cx} cy={cy} pulse={pulse} trainedCount={trainedCount} />
        </>
      )}
    </G>
  )
}

/* Bright magenta filled core. Pops in the first 25% of the pulse and
 * is gone by ~50%, so it reads as the ignition point that the sparks
 * expand outward from. Fill + scale, no stroke — this is the "spark",
 * not the "wave". The magenta (default) path, unchanged. */
function BurstCore({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    let op = 0
    if (u < 0.2) op = 0.95 * (u / 0.2)
    else if (u < 0.45) op = 0.95 * (1 - (u - 0.2) / 0.25)
    const r = 4 + u * 14
    return { r, opacity: op }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={4} fill={colors.magenta} animatedProps={animatedProps} />
  )
}

/* Gold FlashBloom core — the Genshin "destello" that births the
 * firework. A warm white→oro radial that bursts EARLY then dies while
 * growing outward, so the sparks leave a flash, not a lingering orb.
 * Re-timed onto the SLOW gold clock (2600 ms): radius grows to ~70px (not
 * 90) up to u≈0.22, opacity peaks ~u≈0.08 (~0.9) and dies by u≈0.4 — its
 * window now overlaps the firework leaving the centre rather than
 * out-pacing it. Tightened from 90→70 so the bloom seats the comets
 * instead of washing their roots out. At u→0/1 (inert / reduced) it
 * resolves to opacity 0, so it never lingers as a static blob. */
function GoldFlashCore({ cx, cy, clock }: { cx: number; cy: number; clock: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = clock.value
    if (u <= 0 || u >= 1) return { r: 6, opacity: 0 }
    // Opacity rises fast (peak by u≈0.08), holds briefly, then decays to
    // 0 by u≈0.4. Radius grows to ~70px (seats the comets, not the whole
    // figure) over the first 22% — the gradient fades to transparent at
    // its edge so it reads as a bloom of light, not a hard disc.
    const rise = Math.min(1, u / 0.08)
    const decay = u <= 0.15 ? 1 : Math.max(0, 1 - (u - 0.15) / 0.25)
    const k = rise * decay
    const r = 6 + 64 * Math.min(1, u / 0.22)
    return { r, opacity: 0.9 * k }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={6}
      fill="url(#starburst-gold-flash)"
      animatedProps={animatedProps}
    />
  )
}

/* Gold concentric wave — one expanding ring scoped to its own sub-window
 * [start, end] of the slow gold clock. Radius is LINEAR across the
 * sub-window because the driving clock already carries the
 * anti-front-loaded curve — re-applying an easing here would re-flatten
 * the very expansion we're trying to surface. Opacity is a sin() arch
 * (enters soft, brightest mid-expansion, gone before the frame), and the
 * stroke thins as it grows so it dilutes outward. Three of these cascade
 * (staggered start/end) as the expanding rings of the gold celebration.
 * At u→0/1 (inert / reduced) it resolves to opacity 0 → no burst. */
function GoldWave({
  cx,
  cy,
  clock,
  start,
  end,
  baseWidth,
  color,
  rMax,
}: {
  cx: number
  cy: number
  clock: SharedValue<number>
  start: number
  end: number
  baseWidth: number
  color: string
  rMax: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = clock.value
    if (u <= 0 || u >= 1) return { r: 8, opacity: 0, strokeWidth: baseWidth }
    const span = end - start
    const localT = Math.max(0, Math.min(1, span > 0 ? (u - start) / span : 0))
    const r = 8 + (rMax - 8) * localT
    const opacity = 0.8 * Math.sin(Math.PI * localT)
    const strokeWidth = baseWidth * (1 - 0.4 * localT)
    return { r, opacity, strokeWidth }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={8}
      fill="none"
      stroke={color}
      strokeWidth={baseWidth}
      animatedProps={animatedProps}
    />
  )
}

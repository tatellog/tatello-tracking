import { useAnimatedProps, useDerivedValue, type SharedValue } from 'react-native-reanimated'
import { Circle, Ellipse, G, Line } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedCircle, AnimatedG } from '../../animation/animated-components'
import { HERO_MAG, SPARK_BASE } from '../../constants'
import { recencyHaloMultiplier, starRadius } from '../../geometry'
import type { Resolved, SequenceEl } from '../../types'
import { HeroGlow } from '../figure-base'
import { StarSparkle } from '../static'

/* ─ Stars layer (dispatches lit / next variants) ────────────────── */

export function StarsLayer({
  stars,
  litKeys,
  nextEl,
  t,
  ignitingKey,
  intensity,
  litPulse,
  starRecency,
  breathT,
  starDepth,
  reduce,
}: {
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  t: SharedValue<number>
  /** While set, the matching star is skipped here so IgnitingOverlay
   *  can draw its flash on top without doubling up. */
  ignitingKey: string | null
  intensity: number
  litPulse: SharedValue<number>
  /** Star idx → days since marked. Drives the halo decay so recent
   *  stars feel alive and older ones quiet down. */
  starRecency: Map<number, number>
  /** 16s coordinated-breath clock. Threaded through to LitStar so
   *  every lit star can share the same brighten window. */
  breathT: SharedValue<number>
  /** Star idx → BFS distance from the alpha through the figure
   *  graph. Each shell pulses 320 ms after the previous, so the
   *  breath ripples outward from the alpha instead of firing in
   *  unison. */
  starDepth: Map<number, number>
  /** iOS "Reducir movimiento". Passed by PROP (never read via a hook
   *  inside this .map) to the per-star loops that can't derive a
   *  static rest from the parked clocks: NextStar's breathing halo
   *  rests VISIBLE at its high end ("te espera"), TodayRing rests
   *  visible without rotating, and the rising spark particles (pure
   *  ambient) are suppressed. The star body's breath/halo rest via the
   *  parked t/breathT clocks, but its twinkle is also forced to full
   *  brightness inside the worklet (a parked t leaves some indices
   *  dimmed mid-dip). */
  reduce: boolean
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (ignitingKey === `star-${i}`) return null
        if (isNext) return <NextStar key={`s-${i}`} s={s} t={t} reduce={reduce} />
        if (isLit) {
          const recency = starRecency.get(i) ?? 0
          const depth = starDepth.get(i) ?? 0
          return (
            <LitStar
              key={`s-${i}`}
              s={s}
              i={i}
              t={t}
              intensity={intensity}
              litPulse={litPulse}
              recency={recency}
              breathT={breathT}
              depth={depth}
              reduce={reduce}
            />
          )
        }
        return null
      })}
    </>
  )
}

/* "Next" reads as a queued summoning slot — quiet enough that the
 * lit stars stay the focal layer, but visibly turning so the user
 * sees a clock running. The actual sigilo layout (outer ring +
 * ticks rotating CCW, inner dashed ring rotating CW, plus a wish-
 * countdown pulse ring) is described inline below. */
function NextStar({ s, t, reduce }: { s: Resolved; t: SharedValue<number>; reduce: boolean }) {
  const baseR = starRadius(s.mag) + 0.5

  // Soft breath halo telegraphing "this is the next ignition" —
  // replaces the previous rotating-rings + ticks sigil which read
  // as a targeting reticle (HUD, not celestial). The signal is
  // now: a single warm magenta halo whose alpha + radius gently
  // swell once every ~3 s, plus the central StarSparkle tinted
  // magenta so the eye still finds the slot.
  //
  // REDUCED MOTION: the halo MUST stay legible as "próxima / te
  // espera", so it rests at the SWELL'S HIGH END (u = 1 → r = baseR
  // + 10, opacity 0.40) instead of disappearing — it simply stops
  // breathing. `reduce` is a constant prop captured as a worklet
  // closure scalar (the reveal reads its `instant` flag the same way).
  const breathProps = useAnimatedProps(() => {
    'worklet'
    const u = reduce ? 1 : 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 3))
    return {
      r: baseR + 4 + u * 6,
      opacity: 0.18 + 0.22 * u,
    }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 4}
        fill={colors.magenta}
        animatedProps={breathProps}
      />
      <StarSparkle cx={s.x} cy={s.y} r={baseR} mag={s.mag} fill="url(#starNext)" />
    </G>
  )
}

function LitStar({
  s,
  i,
  t,
  intensity,
  litPulse,
  recency,
  breathT,
  depth,
  reduce,
}: {
  s: Resolved
  i: number
  t: SharedValue<number>
  /** 0..1 overflow-phase intensifier. Each star grows up to 18% and
   *  its halo brightens accordingly when the user keeps marking past
   *  the day the constellation completed. Subtle on purpose — this is
   *  "you've built it, now you're polishing it", not a second
   *  building phase. */
  intensity: number
  /** 0..1 ripple — fires once per slider commit. Boosts the star's
   *  opacity and amplifies the halo so each "Hoy" tap visibly lifts
   *  the whole constellation, not only the newly-igniting element. */
  litPulse: SharedValue<number>
  /** Days since this star was marked. 0 = today. Drives halo decay
   *  so recent stars feel alive while older ones quiet down — the
   *  body remembers recent rhythm more vividly than old. */
  recency: number
  /** 16s clock that drives the cascading-ripple breath. Combined
   *  with `depth`, each star pulses 320 ms after the previous shell
   *  so the brighten wave radiates outward from the alpha. */
  breathT: SharedValue<number>
  /** BFS distance from the alpha through the figure graph. 0 means
   *  this star is the alpha. Used to offset its breath window. */
  depth: number
  /** iOS "Reducir movimiento". The body breath/halo rest at their high
   *  end via the parked t/breathT clocks, but the twinkle CANNOT rest
   *  from a parked t alone: `twinkleCycle = (t·2.4 + i·0.31) % 1` lands
   *  in the dip window (<0.08) for some star indices, leaving those
   *  stars dimmed (~0.65). So `starProps` branches on this flag to force
   *  full body brightness; the flag also gates TodayRing's rotation and
   *  suppresses the rising spark particles (ambient). */
  reduce: boolean
}) {
  const baseR = starRadius(s.mag) + 0.5
  const r = baseR * (1 + intensity * 0.18)
  const isHero = s.mag <= HERO_MAG

  // Per-star phase offset so adjacent stars breathe out of sync.
  const phase = (i * 0.137) % 1

  // Halo intensity multiplier from recency. Days 0..7 stay bright
  // (1.0 → 0.55), days 7..21 fade further (0.55 → 0.18), days 21+
  // floor at a quiet baseline so old-lit stars still glow faintly.
  // Computed on JS thread and captured as a worklet closure scalar.
  const haloMult = recencyHaloMultiplier(recency)

  // Magenta glow — this is what separates a LIT star from a
  // placeholder one. Both star bodies are cream (starlight), so
  // without this halo a freshly-marked day is invisible against the
  // placeholder silhouette. The magenta is the achievement colour:
  // a lit star glows with it. Recency still fades older glows.
  // Cascade: alpha (depth 0) starts its breath at bc=0.85; every
  // shell after that fires 0.02 of the 16 s cycle (~320 ms) later.
  // The wave radiates outward from the alpha instead of all stars
  // pulsing in unison. Modular so the cascade wraps cleanly when
  // very deep figures push the last shell past bc=1.0.
  const breathStart = 0.85 + depth * 0.02
  // Shared 8 s breath wave — the 4 layered worklets below (halo + body
  // + outer halo + core) used to each call Math.sin((t + phase) * 2π)
  // independently. useDerivedValue runs it ONCE per frame on the UI
  // thread and the worklets just read .value — saves 3 sin calls per
  // lit star per frame (~85 / s with 5 stars lit; scales linearly).
  const waveSV = useDerivedValue(() => 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI))

  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = waveSV.value
    // Halved ambient range vs. before (0.22→0.12 floor, 0.16→0.10
    // wave) so the lit halos read as glints, not glows. The
    // composition was reading "heavy" with full-strength halos
    // stacked on every lit star.
    const ambient = (0.08 + 0.08 * wave) * (1 + intensity * 0.5) * haloMult
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.12 * haloMult
    }
    return {
      opacity: ambient + litPulse.value * 0.4 + breath,
      r: r + 7 * haloMult + litPulse.value * 4 + breath * 12,
    }
  })

  // Body animation: slow breathing scale 1.00 → 1.10 driven by the 8 s
  // clock + an asynchronous twinkle flicker (~3.3 s period per star,
  // each with its own phase) that briefly dips opacity to ~0.65 and
  // snaps back. The breathing carries the continuous "alive" feel; the
  // twinkle gives the eye the universal scintillation cue of real
  // stars in a night sky. The transform string lives on AnimatedG
  // (not the Path) so the gradient fill `url(#starLit)` stays stable.
  const starProps = useAnimatedProps(() => {
    'worklet'
    const wave = waveSV.value
    const scale = 1 + wave * 0.1

    // Twinkle: t cycles 0..1 every 8 s; ×2.4 ⇒ ~3.3 s per twinkle.
    // Per-star phase keeps the field asynchronous. Under reduce-motion
    // `t` is parked, and for some indices `twinkleCycle` would land in
    // the dip window — so we force full brightness instead of letting
    // those stars rest mid-flicker.
    let twinkleOp = 1
    if (!reduce) {
      const twinkleCycle = (t.value * 2.4 + i * 0.31) % 1
      if (twinkleCycle < 0.04) {
        // Fast dim down (0 → 165 ms-ish at 4 % of 3.3 s).
        twinkleOp = 1 - (twinkleCycle / 0.04) * 0.35
      } else if (twinkleCycle < 0.08) {
        // Fast recover back to full brightness.
        twinkleOp = 0.65 + ((twinkleCycle - 0.04) / 0.04) * 0.35
      }
    }

    const ambient = (0.85 + 0.15 * wave) * twinkleOp
    // Cascade breath, depth-shifted (matches haloProps).
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.06
    }
    const boosted = ambient + litPulse.value * 0.15 + breath
    return {
      opacity: boosted > 1 ? 1 : boosted,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  // Outer diffuse halo — fades the star into the sky so it doesn't
  // sit as a hard punch-out on the magenta wash. Slow, low-amplitude
  // breath; recency-aware like the main halo.
  const outerHaloProps = useAnimatedProps(() => {
    'worklet'
    const wave = waveSV.value
    // Halved + radius trimmed so the outer bloom feels like a
    // breath of warmth, not a solid disc on top of every lit star.
    const ambient = (0.025 + 0.02 * wave) * haloMult
    return {
      opacity: ambient + litPulse.value * 0.06,
      r: r + 9 * haloMult + litPulse.value * 3,
    }
  })

  // Hot core — a small cream-pink disc that sits between the star
  // body and the magenta halo. Adds the white-hot centre look that
  // makes stars read as light, not stickers.
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const wave = waveSV.value
    return {
      opacity: (0.35 + 0.2 * wave) * haloMult + litPulse.value * 0.2,
      r: r + 2 + wave * 1.2,
    }
  })

  // Flare intensity scales with magnitude — every lit star now
  // earns at least a baby lens-flare, the brightest get full
  // streak + asymmetric cross. Threshold pushed from 3.0 → 4.2 so
  // even the faintest connectors (mag 3.9 Rasalas) get a hint of
  // flare, matching the Genshin reference where EVERY star in
  // the constellation sparks.
  //
  //   mag 1.5 (Regulus) → intensity 0.64
  //   mag 2.0 (Denebola) → 0.52
  //   mag 2.6 (Zosma) → 0.38
  //   mag 3.5 (Eta/Adhafera) → 0.17
  //   mag 3.9 (Rasalas) → 0.07
  //   mag 4.2+ → 0
  const flareIntensity = Math.max(0, (4.2 - s.mag) / 4.2)

  return (
    <G>
      {isHero ? <VolumetricRays cx={s.x} cy={s.y} r={r} t={t} /> : null}
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={r} t={t} phase={phase} /> : null}
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 12} fill="#D9AE6F" animatedProps={outerHaloProps} />
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 5} fill="#FFF6E5" animatedProps={haloProps} />
      {flareIntensity > 0 ? (
        <LitStarFlare
          cx={s.x}
          cy={s.y}
          r={r}
          intensity={flareIntensity}
          haloMult={haloMult}
          t={t}
          phase={phase}
        />
      ) : null}
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 2} fill="#FFF6E5" animatedProps={coreProps} />
      <AnimatedG animatedProps={starProps}>
        <StarSparkle cx={s.x} cy={s.y} r={r} mag={s.mag} fill="url(#starLit)" lit />
      </AnimatedG>
      {/* White-hot pinpoint */}
      <Circle cx={s.x} cy={s.y} r={Math.max(0.5, r * 0.16)} fill="#FFF1D6" opacity={0.75} />
      {/* Today's star ring — only renders when this is the star
          marked TODAY. Visual tie between the coach copy and the
          figure. Rests visible (no rotation) under reduce-motion. */}
      {recency === 0 ? <TodayRing cx={s.x} cy={s.y} r={r} t={t} reduce={reduce} /> : null}
      {/* Cream sparks drifting up from the star — particles. Hero
          + today's star emit double. Pure ambient: suppressed under
          reduce-motion (a parked t would freeze them mid-rise); the
          star stays fully legible without them. */}
      {reduce ? null : (
        <StarParticles
          cx={s.x}
          cy={s.y}
          r={r}
          t={t}
          seed={i}
          emit={isHero || recency === 0 ? 2 : 1}
        />
      )}
    </G>
  )
}

/* Volumetric rays — 8 thin cream strokes radiating from the alpha,
 * rotating slowly. The Genshin signature for "this is a real cosmic
 * body" instead of a coloured dot. Reads the parked `t` under
 * reduce-motion → rests static (rays stay drawn, simply stop turning). */
function VolumetricRays({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    // 40 s per rotation (~5 cycles of t).
    const deg = (t.value * (360 / 5)) % 360
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  const RAY_LEN = r * 6
  const RAY_INNER = r * 1.4
  return (
    <AnimatedG animatedProps={rotateProps}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = cx + Math.cos(rad) * RAY_INNER
        const y1 = cy + Math.sin(rad) * RAY_INNER
        const x2 = cx + Math.cos(rad) * RAY_LEN
        const y2 = cy + Math.sin(rad) * RAY_LEN
        // Cardinal rays (0/90/180/270) longer + slightly brighter.
        const isCardinal = deg % 90 === 0
        return (
          <Line
            key={`vr-${deg}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#FFF6E5"
            strokeOpacity={isCardinal ? 0.07 : 0.04}
            strokeWidth={isCardinal ? 0.6 : 0.4}
            strokeLinecap="round"
          />
        )
      })}
    </AnimatedG>
  )
}

/* Energy node — tiny bright disc pulsing under each lit star body,
 * a juncture-pulse that sells "energy flows through this point". */
/* Today's star ring — thin cream orbital ring around the star
 * marked today. Slow rotation + breath so it doesn't compete with
 * the next-star pulse but unmistakably marks "this is THE one".
 *
 * REDUCED MOTION: rests VISIBLE and static — no rotation (deg = 0)
 * and opacity parked at the wave's high end (0.36) so it still
 * unmistakably marks "this is THE one", it simply stops orbiting.
 * `reduce` is a constant prop captured as a worklet closure scalar. */
function TodayRing({
  cx,
  cy,
  r,
  t,
  reduce,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const RING_R = r + 11
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    const deg = reduce ? 0 : (t.value * (360 / 12)) % 360
    const wave = reduce ? 1 : 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * 0.6)
    return {
      opacity: 0.18 + 0.18 * wave,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={rotateProps}>
      <Circle
        cx={cx}
        cy={cy}
        r={RING_R}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={0.7}
        strokeDasharray="3 5"
      />
    </AnimatedG>
  )
}

/* StarParticles — cream sparks that drift upward from a lit star,
 * fading after ~3 s. Each star emits `emit` particles per cycle,
 * deterministically positioned by `seed` so adjacent stars don't
 * sync. */
function StarParticles({
  cx,
  cy,
  r,
  t,
  seed,
  emit,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  seed: number
  emit: number
}) {
  // Generate SPARK_BASE * emit sparks. Each has its own phase + lateral
  // jitter so they don't overlap.
  return (
    <G>
      {Array.from({ length: SPARK_BASE * emit }).map((_, i) => {
        const phase = ((seed * 17 + i * 23) % 100) / 100
        const lateral = (((seed * 31 + i * 13) % 100) / 100 - 0.5) * r * 2.6
        return (
          <StarSpark key={`sp-${i}`} cx={cx} cy={cy} r={r} t={t} phase={phase} lateral={lateral} />
        )
      })}
    </G>
  )
}

function StarSpark({
  cx,
  cy,
  r,
  t,
  phase,
  lateral,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
  lateral: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value * 0.35 + phase) % 1
    // Rise from cy to cy - 14 over the cycle.
    const dy = -u * 14
    // Slight lateral sway in addition to base offset.
    const dx = lateral + Math.sin(u * Math.PI * 2) * 1.2
    // Fade in 0..0.15, hold middle, fade out 0.7..1.
    let op = 0.7
    if (u < 0.15) op = (u / 0.15) * 0.7
    else if (u > 0.7) op = (1 - (u - 0.7) / 0.3) * 0.7
    return { cx: cx + dx, cy: cy + dy, opacity: op }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={Math.max(0.4, r * 0.12)}
      fill="#FFF6E5"
      animatedProps={animatedProps}
    />
  )
}

/*
 * Anamorphic lens flare for the brightest lit stars — a long
 * horizontal cream streak (camera anamorphic look) crossed by a
 * 4-ray diffraction starburst (H/V/two diagonals). Shimmers with a
 * subtle continuous scale wobble on `t` so the rays never freeze.
 *
 * Length + opacity both scale with `intensity` (per-magnitude
 * weight from LitStar) and `haloMult` (recency fade), so an older
 * lit star's flare dims along with its halo.
 */
function LitStarFlare({
  cx,
  cy,
  r,
  intensity,
  haloMult,
  t,
  phase,
}: {
  cx: number
  cy: number
  r: number
  intensity: number
  haloMult: number
  t: SharedValue<number>
  phase: number
}) {
  // Lens-flare geometry — further trimmed to almost-invisible on
  // the alpha. With the ornate ring of the new zodiac-art assets
  // taking the decorative role, the cross's job is just a hint of
  // "this is a bright star", not a feature.
  const rayH = r * (1.0 + intensity * 1.4) // ~1.0r dim → ~2.4r bright
  const rayV = rayH * 0.6
  const rayDiag = rayH * 0.28
  const flareThickness = Math.max(0.35, r * 0.11)
  const op = intensity * 0.22 * haloMult

  // Shimmer: scale-about-(cx, cy) wobble + opacity twinkle so the
  // flare visibly breathes like a real lens catching ambient motion.
  const shimmer = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.3)
    const scale = 0.92 + wave * 0.16
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={shimmer} opacity={op}>
      {/* Horizontal anamorphic streak — the lens flare signature. */}
      <Ellipse cx={cx} cy={cy} rx={rayH} ry={flareThickness} fill="#FFF6E5" opacity={0.28} />
      {/* Asymmetric cross — H thick + bright, V medium, diagonals thin. */}
      <Line
        x1={cx - rayH}
        y1={cy}
        x2={cx + rayH}
        y2={cy}
        stroke="#FFF6E5"
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Line
        x1={cx}
        y1={cy - rayV}
        x2={cx}
        y2={cy + rayV}
        stroke="#FFF6E5"
        strokeWidth={0.6}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy - rayDiag}
        x2={cx + rayDiag}
        y2={cy + rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy + rayDiag}
        x2={cx + rayDiag}
        y2={cy - rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
    </AnimatedG>
  )
}

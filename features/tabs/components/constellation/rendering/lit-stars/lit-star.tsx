import { useAnimatedProps, useDerivedValue, type SharedValue } from 'react-native-reanimated'
import { Circle, G } from 'react-native-svg'

import { AnimatedCircle, AnimatedG } from '../../animation/animated-components'
import { HERO_MAG } from '../../constants'
import { recencyHaloMultiplier, starRadius } from '../../geometry'
import type { Resolved } from '../../types'
import { HeroGlow } from '../figure-base'
import { StarSparkle } from '../static'

import { LitStarFlare } from './lit-star-flare'
import { StarParticles } from './star-particles'
import { TodayRing } from './today-ring'
import { VolumetricRays } from './volumetric-rays'

/*
 * LitStar — the composed render for an already-lit star. Combines:
 *
 *   1. Volumetric rays (hero only, rotating cardinal/diagonal strokes)
 *   2. HeroGlow (hero only, the big soft magenta wash)
 *   3. Outer diffuse halo (Circle, breath-driven)
 *   4. Main magenta halo (Circle, breath + litPulse)
 *   5. LitStarFlare (anamorphic cross + streak, mag-weighted)
 *   6. Core (cream pinpoint between body and halo)
 *   7. StarSparkle body (4/8-point glint via shared `StarSparkle`)
 *   8. White-hot centre (tiny Circle)
 *   9. TodayRing (only if recency === 0)
 *  10. StarParticles (cream sparks rising — suppressed under reduce-motion)
 *
 * Most layers read the SHARED 8 s breath wave `waveSV` instead of each
 * computing its own sin(); per-frame work drops from 4 → 1 sin calls
 * for the layered halos. Recency fades the halos (newest = brightest,
 * old = faintly remembered).
 */
export function LitStar({
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

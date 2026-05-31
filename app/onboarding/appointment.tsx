import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import { useBriefContext } from '@/features/brief/hooks'
import { useUpsertMacroTargets } from '@/features/macros/hooks'
import {
  AtmosphericSky,
  DustMote,
  StepHeader,
  WizardLayout,
} from '@/features/onboarding/components'
import {
  type BiologicalSex,
  type CycleSituation,
  type MonthlyFocus,
  type TrainingFrequency,
} from '@/features/profile/api'
import { calculateMacros } from '@/features/profile/calcMacros'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
// ParticleBurst lives next to StarBurst but is not re-exported by the
// burst index.ts (that surfaces only StarBurst); import it directly from
// its module. It is gated by a `pulse` SharedValue (renders only while
// 0 < pulse < 1) so it stays inert outside the climax.
import { ParticleBurst } from '@/features/tabs/components/constellation/rendering/burst/particle-burst'
// The pictorial zodiac art map — the SAME mechanism the Órbita tab uses.
// CRITICAL: these `.svg` assets are imported by react-native-svg-transformer
// as COMPONENTS (FC<SvgProps>), NOT as image sources. We reuse ART_BY_SIGN
// verbatim and render it through the same `renderAsset` runtime check the
// tab's ZodiacEngraving uses — never as an <Image href>.
import { ART_BY_SIGN } from '@/features/tabs/components/constellation/data/sign-maps'
// The asset union (FC<SvgProps> | ImageSourcePropType) + render contract
// shared with the Órbita tab. ART_BY_SIGN is typed Record<ZodiacSign,
// ZodiacAsset>, so we reuse the type rather than re-declaring it.
import type { ZodiacAsset } from '@/features/tabs/components/ZodiacEngraving'
import { ZODIAC, zodiacFromDate, type ZodiacSign } from '@/features/tabs/zodiac'
import { track } from '@/lib/analytics'
import { deviceTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
// expo-blur's BlurView animated for the optional desenfoque→foco pass.
// PROGRESSIVE ENHANCEMENT only — gated by its own mount/unmount window.
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView)

/** Verb phrase the reveal cites in the multi-datum line. Reads like
 *  the user's own goal, not a Stelar-side categorization. */
const FOCUS_VERB: Record<MonthlyFocus, string> = {
  weight: 'quieres bajar de peso',
  energy: 'quieres más energía',
  sleep: 'quieres dormir mejor',
  food: 'quieres reconciliarte con la comida',
  cycle: 'quieres conocer tu ciclo',
  patterns: 'quieres entender tus patrones',
  mind: 'quieres calmar la mente',
  other: 'estás buscando algo propio',
}

/*
 * Step 12 — Reveal. The emotional peak of the wizard. Marks
 * onboarding_completed_at (RouteGuard then lets the user into
 * /(tabs)) and shows the first personalised Voz de Stelar.
 *
 * UX REFINEMENT (audit + usuaria): the reveal is the PEAK — "llegaste".
 * The 12/12 progress bar is hidden here (WizardLayout showProgress=false)
 * so nothing meters the moment. The eyebrow "Tu cielo en Stelar" is
 * CENTRED right above the art (StepHeader align="center") so it reads as
 * the art's title, not a top-left label. And the "QUÉ SIGUE" expectation
 * block MOVED to Día 1 — the reveal now closes on three clean beats:
 * art + headline + body + CTA. The vertical rhythm centres the STAGE in
 * the upper space and anchors the TEXT as one cohesive group below.
 *
 * THE CEREMONY — dual audit (illustrator art-direction + uxui timing):
 * the constellation is the VEILED SKELETON; the pictorial art is the
 * FLESH that ignites over it. During anticipation the user sees only
 * cold silver-índigo points under a niebla VEIL — unreadable. At the
 * climax the painted ART reveals with a COIN-SPIN: it whirls on its Y
 * axis (rotateY SPINS*360°→0°) FAST at first and DECELERATES hard to a
 * dead stop DE FRENTE — like a coin spun on a table that wobbles down
 * and lands flat.
 *
 * SLOW + 3-TURN PASS (usuaria pidió "más lento para apreciar la
 * revelación; 2-3 giros y más lento"): SPINS = 3 (1080° of rotateY) and
 * the spinClock duration grew 2500 → 3800 ms (still ease-out, decelerando
 * de más a menos). The coin lands de frente at ~4900 ms (1100 + 3800), and
 * every post-landing beat is re-timed so the arc breathes — total ≈ 6 s.
 *
 * REST STATE (usuaria + uxui — "la constelación compite con el halo"): the
 * constellation now FORMS at the climax (the payoff: she sees HER sign
 * ignite over the art), holds a beat of GLORIA, then DESAPARECE por
 * completo as the golden halo florece to full. At rest the stage is the
 * painted ART (op 0.55 EFECTIVO) + the diffuse GOLDEN HALO (now bigger) +
 * the broken art-deco ring — NO constellation. A `constSettle` shared value
 * (=1 during climax + gloria, animated to 0) wraps the WHOLE asterism
 * (stars + lines + anchor) in an AnimatedG whose opacity it drives, AND
 * gates the asterism's MOUNT (the figure subtree is unmounted once
 * constSettle lands at 0 — no zombie worklets/twinkles at rest).
 *
 * COIN-SPIN — the art is NOT inside the constellation <Svg>. SVG
 * <G transform> is 2D-affine only (no 3D rotateY). The art lives in its
 * OWN Animated.View layer (RN transforms DO support perspective +
 * rotateY), positioned absolute over the stage, BEHIND the constellation
 * Svg. Layer order (back→front): cool atmosphere → ART Animated.View
 * (coin-spin) → constellation/ephemeral Svg → text.
 *
 * The spin is driven by a DEDICATED MONOTONIC clock (spinClock 0→1,
 * ease-out) — separate from artClock (which only carries the opacity
 * arc). Decoupling them is what guarantees the art freezes EXACTLY de
 * frente at the end: once spinClock reaches 1, deg=0 forever, and the
 * opacity settle no longer tugs the angle back open.
 *
 * GENSHIN-STYLE BUILD-UP (illustrator-specialist pass). NOTHING touches the
 * coin-spin anchor beyond SPINS=3 + the 3800 ms duration nor the art opacity
 * (rests 0.55 EFECTIVO). Everything new hangs off new/existing clocks:
 *   · ORBITACIÓN — the convergence motes orbit in their radius BEFORE
 *     collapsing, so they fall in a SPIRAL (orbitClock). Gold motes rise as
 *     embers.
 *   · INHALACIÓN — a 150 ms held breath where the wash implosiona and the
 *     seed charges (inhaleClock), released into the estallido.
 *   · ANILLOS DE ENERGÍA — three broken, rotated, asymmetric rings expand
 *     + fade at the climax (ringsClock) — rotated so the gaps never align
 *     into a diana.
 *   · COLUMNA DE LUZ — a vertical beam that destella in sync with each coin
 *     turn (beamClock).
 *   · AURA DORADA EN REPOSO — a diffuse golden glow (3 inline radial
 *     gradients, now bigger/more diffuse) behind the warm layers that fades
 *     in with haloClock and breathes on its own desincronizado pulse
 *     (auraBreath).
 *
 * Choreography (ms from mount — climax at ~1100 ms; the slow 3-turn spin
 * lands de frente at ~4900 ms; B0–B2 carry the orbit + inhale unchanged):
 *   B0  0–250    loaded void: ambient at op 0.06, a cream seed is born;
 *                the ART View mounts (spinning offscreen-angle, invisible);
 *                the VEIL fades.
 *   B1  250–950  anticipation: 30 motes ORBIT (orbitClock) then collapse in
 *                a spiral; gold motes rise as embers; the ghost figure
 *                mounts COLD; the AmbientWash contracts; the veil sits 0.5.
 *   B2  950–1100 INHALACIÓN (~150 ms): the wash implosiona, the seed
 *                charges, the collapsing motes accelerate.
 *   B3  1100→    CLIMAX + COIN-SPIN: climaxClock fires (140 ms). Inhale
 *                releases. Flash bloom, god rays, particle burst, energy
 *                rings, light column; the ART SPINS on Y (SPINS*360°→0°)
 *                over ~3800 ms (poly(5) ease-out), landing de frente at
 *                ~4900 ms. Opacity climbs to 0.72 glory then rests 0.55.
 *   B4  4850→    the constellation (stars + lines) SNAPS in once the coin
 *                has essentially LANDED — `constSettle` is at 1 so the
 *                figure ignites over the art.
 *   B5  4900     halo + golden aura bloom to FULL; CTA blooms atenuado→
 *                solid. Heavy haptic — the "clack" of the coin coming to rest.
 *   B5b 5650→    after a beat of GLORIA, `constSettle` drops 1→0 (~700 ms):
 *                the constellation se hunde into the art as the oro reaches
 *                full bloom, then UNMOUNTS once it reaches 0. Rest = art +
 *                halo, no constellation (and no worklets/twinkles running).
 *   B6  5900→    Stelar speaks — headline FadeIn + haptic Medium, then body
 *                (~6300).
 *
 * REDUCED MOTION / RE-ENTRY: a parallel branch jumps straight to settle —
 * art pre-revealed DE FRENTE (spinClock=1 → rotateY 0°, op 0.55 EFECTIVO),
 * figure available but `constSettle=0` so the asterism NEVER mounts (rest =
 * art + halo), halo + golden aura STATIC (haloClock=1, auraBreath=0), text
 * prompt — no spin/flash/rays/veil/blur/convergence/orbit/inhale/rings/beam.
 * The `instant` flag is read INSIDE flipStyle so deg=0.
 *
 * HAPTICS: exactly TWO meaningful — Heavy at the coin's LANDING (the
 * clack), Medium when Stelar speaks.
 */
export default function RevealScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()
  const updateProfile = useUpdateProfile()
  const upsertMacros = useUpsertMacroTargets()
  const [advancing, setAdvancing] = useState(false)

  const { height: winH } = useWindowDimensions()
  // iPhone SE / short screens (≤568 pt): shrink the stage so the
  // headline + body + CTA fit WITHOUT forced scroll. The culmination —
  // Stelar's line — must be readable without scrolling. On tall screens
  // the stage sits at 320 (down from 360) so the art doesn't float with a
  // big gap above the headline — it reads as the headline "saliendo" from
  // the art (vertical-rhythm pass).
  const stageSize = winH <= 568 ? 288 : 320

  // Reduced-motion: reanimated's hook gives the synchronous-at-mount
  // value; we also read the imperative API once so first paint is
  // already correct on the rare platforms where the hook lags.
  const reanimatedReduced = useReducedMotion()
  const [reduceMotion, setReduceMotion] = useState(reanimatedReduced)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on || reanimatedReduced)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [reanimatedReduced])

  // RE-ENTRY INSTANTÁNEA — if onboarding_completed_at is already set the
  // user has SEEN the reveal; never replay the ceremony. Captured once
  // at mount (a ref so it doesn't flip mid-animation when this screen's
  // own handleStart patch lands) and folded into the same instant branch
  // as reduced motion. `instant` is what every clock/schedule keys off.
  const alreadyRevealedRef = useRef<boolean>(profile?.onboarding_completed_at != null)
  const instant = reduceMotion || alreadyRevealedRef.current

  const firstName = useMemo(
    () => (profile?.display_name ?? '').trim().split(' ')[0] || 'tú',
    [profile?.display_name],
  )
  const focusVerb = useMemo(() => {
    const k = (profile?.monthly_focus as MonthlyFocus | null) ?? null
    // Fallback is a VERB clause (not the noun "tu intención") so the
    // multi-datum line stays grammatical: "…, buscas algo propio. Stelar…".
    return k ? FOCUS_VERB[k] : 'buscas algo propio'
  }, [profile?.monthly_focus])

  // Signo zodiacal — derived strictly from date_of_birth. We need both
  // the label (for the body line) AND the sign key (to look up the
  // constellation figure + the pictorial art). FALLBACK CHANGED: if
  // date_of_birth is missing we DO NOT invent a sign — showing a false
  // sign at the most intimate moment betrays the user. `hasSign` gates
  // BOTH the figure/art render and the "{SIGNO}" body line; without it
  // the stage shows only the neutral cosmic atmosphere + halo, and the
  // body simply omits the sign clause.
  const hasSign = profile?.date_of_birth != null
  const zodiacSign: ZodiacSign | null = useMemo(
    () => (profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null),
    [profile?.date_of_birth],
  )
  const zodiacLabel = useMemo(() => (zodiacSign ? ZODIAC[zodiacSign].label : null), [zodiacSign])

  // Estado del ciclo — solo lo cito si la usuaria menstrúa.
  const cycleActiveSituations: readonly CycleSituation[] = [
    'menstruates',
    'contraception',
    'irregular',
  ]
  const showsCycle =
    profile?.cycle_situation != null &&
    cycleActiveSituations.includes(profile.cycle_situation as CycleSituation)

  // ── Ceremony clocks ─────────────────────────────────────────────
  // climaxClock — the master "tada". Fires once at B3 over 140 ms and
  // drives EVERYTHING that ignites: ghost→full stars, flares, the warm
  // crossfade, the line-draw, the flash bloom, the god rays.
  const climaxClock = useSharedValue(0)
  // artClock — the art's EFFECTIVE OPACITY arc now. 0 → 0.72 (glory) → 0.55
  // (settle). Non-monotonic on purpose (rises then eases down). It NO
  // LONGER drives rotation — that lives on spinClock so the art freezes
  // perfectly de frente at the end instead of de-tensing on the settle.
  // The worklet renders artClock VERBATIM (clamped ≤0.72) — there is no
  // extra ×0.72 cap, so the rest value 0.55 is what shows on screen.
  const artClock = useSharedValue(0)
  // spinClock — the coin SPIN. A MONOTONIC 0→1 ramp (ease-out) that drives
  // rotateY: SPINS*360°→0° (fast at first, decelerating to a dead stop de
  // frente). Separate from artClock so once it lands at 1 the angle is 0
  // forever. SLOW PASS: now a 3800 ms ramp (was 2500) for the 3-turn,
  // appreciable spin.
  const spinClock = useSharedValue(0)
  // constSettle — the WHOLE constellation's opacity AND mount gate. Stays at
  // 1 through the climax + gloria (the user sees her sign ignite over the
  // art), then animates 1→0 so the asterism fades and DESAPARECE at rest,
  // leaving only art + golden halo. A useAnimatedReaction inside the figure
  // unmounts the stars/lines once it lands at 0 (predicate `> 0.001` keeps
  // them mounted through the whole fade). On the instant branch it starts at
  // 0 → the figure never mounts.
  const constSettle = useSharedValue(instant ? 0 : 1)
  // veilClock — the niebla veil. 0→0.5 (B0–B1) then disipates 0.5→0 at
  // the climax. Gates its own mount.
  const veilClock = useSharedValue(0)
  // igniteClock — the warm-ignite bloom OVER the art (cream→magentaHot→
  // transparent). Spikes ~0.55 at the climax, decays to 0 in glory.
  const igniteClock = useSharedValue(0)
  // flashClock — the white→magenta bloom that lives ~250 ms and dies.
  const flashClock = useSharedValue(0)
  // raysClock — god-ray length + opacity, ~200 in / ~480 out.
  const raysClock = useSharedValue(0)
  // burstPulse — gates ParticleBurst (renders only while 0<pulse<1).
  const burstPulse = useSharedValue(0)
  // haloClock — the ceremonial halo + golden aura fade-in at settle.
  const haloClock = useSharedValue(0)
  // lineBoost — momentary opacity bloom of the constellation filament
  // right after the climax (0→1→0 over ~400 ms), then settles.
  const lineBoost = useSharedValue(0)

  // ── New anticipation / climax clocks (Genshin-style build-up) ────
  // orbitClock — 0→1 over 700 ms (B1, fires ~250 ms). Drives the ORBITAL
  // phase of the convergence motes: they rotate in their radius BEFORE
  // collapsing, so they fall inward in a SPIRAL (angle keeps advancing as
  // r→0), never a straight radial line. Also lifts the gold "ember" motes.
  const orbitClock = useSharedValue(0)
  // inhaleClock — 0→1 over 150 ms (B2, the held breath). The whole field
  // INHALES: the AmbientWash implosiona, the seed charges, the collapsing
  // motes accelerate. Released to 0 (120 ms) at the climax so it never
  // lingers — the inhale is spent on the estallido.
  const inhaleClock = useSharedValue(0)
  // ringsClock — 0→1 over 620 ms at the climax. Three asymmetric, BROKEN,
  // rotated energy rings expand + fade (gated inside ClimaxBurst). Rotated
  // to distinct angles so their gaps never align into a cross/diana.
  const ringsClock = useSharedValue(0)
  // beamClock — a withSequence pulse (180 ms in / 700 ms out) for the
  // vertical light COLUMN that sweeps with the coin (gated in ClimaxBurst).
  const beamClock = useSharedValue(0)
  // auraBreath — the GOLDEN AURA's resting pulse. Infinite, period 4200 ms
  // (≠ AmbientWash 2800 ms, ≠ skyOrbit 40 s) so the aura never breathes in
  // unison with anything else. Started in its own effect; cancelled on
  // unmount. On the instant branch it stays at 0 (aura is static).
  const auraBreath = useSharedValue(0)

  // Atmosphere clocks — created ONCE here, shared by every atmosphere
  // layer so the background breathes on one compás (mirrors tu-base):
  //   skyClock   5 s  magenta dust drift
  //   skyOrbit  40 s  star-strata parallax + ceremonial halo rotation
  const skyClock = useSharedValue(0)
  const skyOrbit = useSharedValue(0)

  // ── Reveal stage flags ──────────────────────────────────────────
  // `figureMounted` mounts the ghost figure + ART (op 0) at B0/B1 so the
  // raster decodes during the anticipation, never at the climax.
  const [figureMounted, setFigureMounted] = useState(false)
  const [linesLit, setLinesLit] = useState(false)
  const [headlineReady, setHeadlineReady] = useState(false)
  const [bodyReady, setBodyReady] = useState(false)
  // CTA two-stage: secondary/atenuado during the ceremony, blooms to
  // its full solid form at settle.
  const [ctaSettled, setCtaSettled] = useState(false)

  useEffect(() => {
    skyClock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    skyOrbit.value = withRepeat(
      withTiming(1, { duration: 40000, easing: Easing.linear }),
      -1,
      false,
    )
    // auraBreath — only animate the resting pulse on the FULL ceremony. On
    // the instant branch it stays at 0 so the golden aura is dead-static.
    if (!instant) {
      auraBreath.value = withRepeat(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    }
    return () => {
      cancelAnimation(skyClock)
      cancelAnimation(skyOrbit)
      cancelAnimation(auraBreath)
    }
  }, [skyClock, skyOrbit, auraBreath, instant])

  // ── The ceremony schedule ───────────────────────────────────────
  useEffect(() => {
    // INSTANT branch — reduced motion OR re-entry. Jump straight to settle:
    // art pre-revealed DE FRENTE (spinClock=1 → flipStyle reads `instant`
    // so deg=0) at its resting op (artClock=0.55 → renders 0.55 EFECTIVO),
    // figure available but constSettle=0 → the asterism NEVER mounts (rest =
    // art + halo), halo + golden aura up (haloClock=1; auraBreath stays 0 →
    // static), CTA already solid. No convergence/orbit/inhale, no veil, no
    // flash/rays/burst/rings/beam (their clocks stay 0 → every gate stays
    // false). Text appears promptly.
    if (instant) {
      climaxClock.value = 1
      artClock.value = 0.55
      spinClock.value = 1
      constSettle.value = 0
      haloClock.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
      setFigureMounted(true)
      setLinesLit(true)
      setCtaSettled(true)
      const tH = setTimeout(() => setHeadlineReady(true), 250)
      const tB = setTimeout(() => setBodyReady(true), 650)
      return () => {
        clearTimeout(tH)
        clearTimeout(tB)
        cancelAnimation(climaxClock)
        cancelAnimation(artClock)
        cancelAnimation(spinClock)
        cancelAnimation(constSettle)
        cancelAnimation(haloClock)
      }
    }

    const timeouts: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => {
      timeouts.push(setTimeout(fn, ms))
    }

    // B0 · loaded void → seed born in AmbientWash. The veil fades in and
    // the ghost figure + ART (spinning, op 0) mount at B1's start.
    veilClock.value = withTiming(0.5, { duration: 400, easing: Easing.out(Easing.quad) })

    // B1 · anticipation — mount the ghost figure + ART + convergence, and
    // start the ORBITAL phase: motes rotate in their radius before collapsing.
    at(250, () => {
      setFigureMounted(true)
      orbitClock.value = withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) })
    })

    // B2 · INHALACIÓN (~950 ms) — the held breath. The field implosiona for
    // 150 ms (wash contracts, seed charges, collapsing motes accelerate)
    // right before the estallido.
    at(950, () => {
      inhaleClock.value = withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) })
    })

    // B3 · CLIMAX "tada" at t=1100 (the inhale's tail releases into it).
    at(1100, () => {
      // (e) figure ignites ghost→full (cold→warm crossfade keyed off this)
      climaxClock.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) })
      // ART reveal — the COIN-SPIN. SLOW PASS: spinClock is a MONOTONIC 0→1
      // ramp, duration 4200 ms, Easing.out(Easing.cubic) — cubic (not poly5)
      // so the turns decelerate EVENLY and read, instead of whipping past in
      // the first frames. flipStyle maps it to rotateY SPINS*360°→0° so the
      // art whirls and FREEZES de frente at ~5300 ms (1100 + 4200).
      spinClock.value = withTiming(1, { duration: 4200, easing: Easing.out(Easing.cubic) })
      // INHALE release — the contracted field snaps back as it estalla.
      inhaleClock.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) })
      // EFFECTIVE-opacity arc (artClock): climb to 0.72 glory, HOLD through
      // the slow spin + gloria, then ease to rest 0.55 once the constellation
      // has sunk away. The worklet renders these values verbatim (no ×0.72
      // cap), so glory shows 0.72 and rest shows 0.55. Decoupled from rotation.
      artClock.value = withSequence(
        withTiming(0.72, { duration: 1100, easing: Easing.out(Easing.cubic) }),
        withDelay(3600, withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.ease) })),
      )
      // warm-ignite bloom over the art: spike, decay to 0 in glory.
      igniteClock.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 560, easing: Easing.in(Easing.quad) }),
      )
      // veil disipates: 0.5 → 0 as the art spins into view.
      veilClock.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) })
      // (a) flash bloom: rise fast, die ~290 ms total.
      flashClock.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
      )
      // (b) god rays — 200 in / 480 out.
      raysClock.value = withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) }),
      )
      // (c) particle burst: pulse 0→1 once over ~900 ms.
      burstPulse.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })
      // NEW (f) energy rings — three broken/rotated rings expand + fade.
      ringsClock.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) })
      // NEW (g) light column — a quick destello that sweeps with the coin.
      beamClock.value = withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }),
      )
    })

    // B4 · the constellation SNAPS in once the coin has essentially LANDED
    // de frente (~4850 ms ≈ after the 3800 ms whirl from t=1100). constSettle
    // is still 1, so the figure ignites over the art — the payoff.
    at(5250, () => {
      // filament bloom: spike then settle (0→1→0 over ~400 ms)
      lineBoost.value = withSequence(
        withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
      )
      setLinesLit(true)
    })

    // B5 · halo + golden aura bloom to FULL + CTA blooms to its full solid
    // form, right as the coin lands. Heavy haptic HERE — the "clack" of the
    // coin coming to a dead stop de frente (haptic #1 of 2). The aura's
    // 900 ms bloom reaches full as the constellation sinks (B5b) — handoff.
    at(5300, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {})
      haloClock.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })
      setCtaSettled(true)
    })

    // B5b · after a beat of GLORIA (~750 ms — the user appreciates her sign
    // lit over the art), the constellation HUNDE into the art: constSettle
    // 1→0 over 700 ms while the golden halo finishes blooming to full. The
    // figure's mount-gate (a useAnimatedReaction on constSettle > 0.001) then
    // UNMOUNTS the stars/lines once it reaches 0. Rest = art + halo, no
    // constellation (no zombie worklets/twinkles).
    at(6050, () => {
      constSettle.value = withTiming(0, { duration: 700, easing: Easing.inOut(Easing.ease) })
    })

    // B6 · Stelar speaks (haptic #2 of 2 — Medium, when she speaks). She
    // enters LATE — only after the coin has LANDED and the figure begins to
    // settle into the art.
    at(6300, () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      setHeadlineReady(true)
    })
    at(6700, () => setBodyReady(true))

    return () => {
      timeouts.forEach(clearTimeout)
      cancelAnimation(climaxClock)
      cancelAnimation(artClock)
      cancelAnimation(spinClock)
      cancelAnimation(constSettle)
      cancelAnimation(veilClock)
      cancelAnimation(igniteClock)
      cancelAnimation(flashClock)
      cancelAnimation(raysClock)
      cancelAnimation(burstPulse)
      cancelAnimation(haloClock)
      cancelAnimation(lineBoost)
      cancelAnimation(orbitClock)
      cancelAnimation(inhaleClock)
      cancelAnimation(ringsClock)
      cancelAnimation(beamClock)
    }
    // NOTE: `zodiacSign` is intentionally NOT a dependency. It is not
    // referenced inside this effect — it flows as a prop to the stage
    // components, which re-render on their own when the sign hydrates.
    // Keeping it here re-ran the WHOLE ceremony from zero when
    // profile.date_of_birth hydrated late. The clocks/setters are stable
    // refs/dispatchers, so eslint-exhaustive-deps stays satisfied.
  }, [
    instant,
    climaxClock,
    artClock,
    spinClock,
    constSettle,
    veilClock,
    igniteClock,
    flashClock,
    raysClock,
    burstPulse,
    haloClock,
    lineBoost,
    orbitClock,
    inhaleClock,
    ringsClock,
    beamClock,
  ])

  const handleStart = async () => {
    setAdvancing(true)
    try {
      await updateProfile.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
        timezone: deviceTimezone(),
      })
      track('onboarding_completed')
      const macros = calculateMacros({
        weight_kg: brief?.latest_measurement?.weight_kg ?? null,
        height_cm: profile?.height_cm ?? null,
        date_of_birth: profile?.date_of_birth ?? null,
        biological_sex: (profile?.biological_sex as BiologicalSex | null) ?? null,
        // monthly_focus replaces the legacy `goal` input — calcMacros
        // derives the deficit / maintain mode from it internally.
        monthly_focus: (profile?.monthly_focus as MonthlyFocus | null) ?? null,
        training_frequency: (profile?.training_frequency as TrainingFrequency | null) ?? null,
      })
      if (macros) {
        try {
          await upsertMacros.mutateAsync(macros)
        } catch {
          // Soft failure: macros are nice-to-have day 1, not blocking.
        }
      }
    } catch {
      // Día 1 re-fetches the profile on mount — transient patch failure
      // doesn't strand the user here.
    }
    router.replace('/onboarding/notificaciones')
  }

  // A11Y — announce WHAT was revealed (the SVG stage is otherwise
  // invisible to VoiceOver beyond the text below it).
  const stageA11yLabel = zodiacLabel ? `Tu constelación de ${zodiacLabel}` : 'Tu cielo de Stelar'

  return (
    <WizardLayout
      step={12}
      totalSteps={12}
      // No back: the data is saved; there is nothing to edit behind this.
      showBack={false}
      // The reveal is the PEAK — hide the 12/12 meter so nothing measures
      // the moment. WizardLayout swaps in an equal spacer so the layout
      // doesn't jump (default true keeps the other eleven steps unchanged).
      showProgress={false}
      canContinue
      loading={advancing}
      onContinue={handleStart}
      // CTA two-stage. During the ceremony it is present but SECONDARY
      // (soft variant, sentence-case "Entrar") so a stray tap at the
      // climax doesn't feel like a mistake — and the SAME action ("entrar")
      // is always offered; the ceremony only decides how much it celebrates
      // it. At settle it BLOOMS to the full solid primary "ENTRAR A TU
      // ÓRBITA →". Never a gate.
      continueLabel={ctaSettled ? 'Entrar a tu órbita →' : 'Entrar'}
      ctaVariant={ctaSettled ? 'primary' : 'soft'}
      ctaTransform={ctaSettled ? 'uppercase' : 'none'}
      atmosphere={
        // Shared atmosphere — a11y-hidden + pointerEvents none so VoiceOver
        // never reads it. Cool sky FRAMES the constellation from behind; no
        // warm field (would empaste with the centre's AmbientWash magenta).
        <Animated.View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Cool índigo glow centred-high — recedes behind the figure. */}
          <AtmosphericSky glow={{ cx: '50%', cy: '40%', r: '64%' }} />
          {/* Local star strata + magenta dust motes for volumetric depth. */}
          <RevealSky clock={skyClock} orbit={skyOrbit} />
        </Animated.View>
      }
    >
      {/* Vertical rhythm — flexGrow:1 lets the content claim the whole
          column so the STAGE zone (eyebrow + art) can centre optically in
          the upper space and the TEXT group anchors below as one block,
          with the breathing repartido on purpose instead of pooling above.
          On short screens flexGrow still lets it grow past the viewport so
          nothing is clipped; it just won't force scroll on tall ones. */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* STAGE zone — eyebrow title + art, centred in the upper space. */}
        <View style={styles.stageZone}>
          <StepHeader
            eyebrow="Tu cielo en Stelar"
            eyebrowColor="magenta"
            align="center"
            question=""
          />

          <View
            style={[styles.stage, { width: stageSize, height: stageSize }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={stageA11yLabel}
          >
            {/* ── THE PICTORIAL ART — its OWN layer, BEHIND the constellation
                Svg. SVG <G transform> can't do 3D rotateY, so the coin-spin
                lives in this Animated.View (RN transforms support perspective).
                Only when a real sign exists. Decorative — a11y-hidden; the
                stage View already carries the accessibilityLabel. */}
            {figureMounted && zodiacSign ? (
              <RevealArt
                sign={zodiacSign}
                artClock={artClock}
                spinClock={spinClock}
                size={stageSize}
                instant={instant}
              />
            ) : null}

            <RevealConstellation
              size={stageSize}
              climaxClock={climaxClock}
              artClock={artClock}
              veilClock={veilClock}
              igniteClock={igniteClock}
              flashClock={flashClock}
              raysClock={raysClock}
              haloClock={haloClock}
              lineBoost={lineBoost}
              burstPulse={burstPulse}
              skyOrbit={skyOrbit}
              orbitClock={orbitClock}
              inhaleClock={inhaleClock}
              ringsClock={ringsClock}
              beamClock={beamClock}
              auraBreath={auraBreath}
              spinClock={spinClock}
              constSettle={constSettle}
              figureMounted={figureMounted}
              linesLit={linesLit}
              sign={zodiacSign}
              instant={instant}
            />
            {/* Optional desenfoque→foco — PROGRESSIVE ENHANCEMENT. Mounts
                ONLY while 0 < artClock < 0.6 (same gate philosophy as
                ClimaxBurst); if it janks on the simulator it can be removed
                with zero effect on the core reveal. Never runs on the instant
                branch (artClock rests at 0.55 → gate false). */}
            {hasSign && !instant ? <RevealBlur artClock={artClock} size={stageSize} /> : null}
            {/* Bottom breathing strip — keeps the art (op 0.55) confined to
                the stage and OFF the headline, preserving body contrast. */}
            <View pointerEvents="none" style={styles.fadeBottom} />
          </View>
        </View>

        {/* TEXT group — headline + body anchored together below the stage.
            The headline sits close to the art so it reads as "saliendo" of
            the constellation, not as a separate paragraph. */}
        <View style={styles.textGroup}>
          {headlineReady ? (
            <Animated.Text entering={FadeIn.duration(520)} style={styles.headline}>
              {firstName}, <Text style={styles.headlineEm}>aquí empieza tu lectura</Text>.
            </Animated.Text>
          ) : (
            <View style={styles.headlinePlaceholder} />
          )}

          {bodyReady ? (
            <Animated.Text entering={FadeIn.duration(480)} style={styles.body}>
              {/* Sign clause — only when we ACTUALLY have a derived sign.
                  No invented sign is ever shown; if date_of_birth is
                  missing the clause is omitted entirely. */}
              {zodiacLabel ? <Text style={styles.bodyEm}>{zodiacLabel}</Text> : null}
              {zodiacLabel && showsCycle ? ', ' : null}
              {/* Ciclo segment — NO magenta (brand magenta economy: max 2
                  strong accents/screen). "con tu ciclo en cuenta" replaces
                  the old "en fase lútea": the phase was ASSERTED for anyone
                  who menstruates without computing the real cycle day, so it
                  could be false (contraception / irregular) and was the only
                  clinical term on the screen. Plain leche, no emphasis. */}
              {showsCycle ? 'con tu ciclo en cuenta' : null}
              {zodiacLabel || showsCycle ? ', ' : null}
              {focusVerb}. Stelar ya empezó a leerte. Cuanto más registres, más se afina.
            </Animated.Text>
          ) : (
            <View style={styles.bodyPlaceholder} />
          )}
        </View>
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Constellation ─────────────────────── */

// The constellation's [0..1] viewport maps onto this central area
// of the SVG canvas. Spread is derived from the live stage size so the
// figure fits proportionally on small screens too.
function spread(size: number) {
  // Anchor the asterism to the ART's own frame (78 % of the stage) and
  // compress ×0.82 so the joints sit INSIDE the painted creature instead
  // of spraying over the full stage. Square on purpose (x === y) — the
  // figure's asymmetry comes from the star coords, not from stretching.
  const ART_FRAME = 0.78
  const TIGHTEN = 0.82
  return { x: size * ART_FRAME * TIGHTEN, y: size * ART_FRAME * TIGHTEN }
}

// Convergence — how many motes rush the centre, and the radius band they
// spawn from (px from centre). Count + angles + radii are DETERMINISTIC per
// index (no Math.random in render) so the field is stable across re-renders
// and frame-perfect on the UI thread. Bumped 22→30 and the band widened
// (110→185) so the orbital build-up has more bodies in a deeper field.
const MOTE_COUNT = 30
const MOTE_R_MIN = 110
const MOTE_R_MAX = 185
// A handful of motes are magenta (the rest cream); deterministic pick.
const MOTE_MAGENTA_EVERY = 4 // ~7 of 30

/** Map a zodiac star's normalised (x, y) coords (0..1) onto canvas
 *  coords centred on (CX, CY), spread by (sx, sy). */
function projectStar(x: number, y: number, cx: number, cy: number, sx: number, sy: number) {
  return {
    x: cx + (x - 0.5) * sx,
    y: cy + (y - 0.5) * sy,
  }
}

/** Star size factor from the figure's iconographic magnitude. Bumped a
 *  modest step (~×1.22) over the previous fine bands so the joints read
 *  more PRESENT on the now-tenuous art — still delicate points, not blobs. */
function magToSize(mag: number): number {
  if (mag <= 1.3) return 1.4
  if (mag <= 1.7) return 1.2
  if (mag <= 2.1) return 1.0
  if (mag <= 2.7) return 0.85
  if (mag <= 3.3) return 0.7
  return 0.58
}

/* God-ray geometry — transcribed EXACTLY from assets/reveal/god-rays.svg
 * (11 irregular shafts, none on cardinal axes, viewBox centred 180,180).
 * Each entry's (x2,y2) is the FULL extent; the frontend animates length
 * 0→full + opacity 0→peak→0 on raysClock. peak = the svg's opacity. */
const GOD_RAYS: { x2: number; y2: number; width: number; peak: number }[] = [
  { x2: 180, y2: 22, width: 1.4, peak: 0.55 },
  { x2: 262, y2: 64, width: 0.7, peak: 0.3 },
  { x2: 318, y2: 138, width: 1.1, peak: 0.45 },
  { x2: 330, y2: 206, width: 0.6, peak: 0.26 },
  { x2: 292, y2: 286, width: 1.2, peak: 0.42 },
  { x2: 214, y2: 324, width: 0.7, peak: 0.3 },
  { x2: 150, y2: 336, width: 1.0, peak: 0.4 },
  { x2: 74, y2: 300, width: 0.6, peak: 0.24 },
  { x2: 40, y2: 216, width: 1.3, peak: 0.48 },
  { x2: 56, y2: 120, width: 0.7, peak: 0.3 },
  { x2: 118, y2: 50, width: 0.9, peak: 0.36 },
]

/* Energy rings — three concentric, BROKEN (strokeDasharray), ROTATED arcs
 * that expand + fade at the climax. The rotations (23°, -47°, 71°) are
 * irregular so the gaps NEVER align into a cross/diana, and they are
 * strokes (not fills) so they read as rings of energy, not solid discs.
 * Each ring's worklet lives in its own component (EnergyRing) — never a
 * hook in a .map. r expands from 92 to rFinal × scale; opacity enters fast,
 * expands, then fades to 0 across ringsClock. */
const ENERGY_RINGS: {
  rotate: number
  stroke: string
  width: number
  dash: string
  rFinal: number
  peak: number
}[] = [
  { rotate: 23, stroke: '#FFF6E5', width: 1.4, dash: '40 14', rFinal: 168, peak: 0.55 },
  { rotate: -47, stroke: '#D9AE6F', width: 1.0, dash: '22 60', rFinal: 196, peak: 0.4 },
  { rotate: 71, stroke: colors.magentaHot, width: 0.7, dash: '8 90', rFinal: 228, peak: 0.28 },
]

/* Ceremonial-halo ornament ticks — transcribed EXACTLY from
 * assets/reveal/ceremonial-halo.svg (7 irregular ticks). */
const HALO_TICKS: { x1: number; y1: number; x2: number; y2: number }[] = [
  { x1: 180, y1: 14, x2: 180, y2: 26 },
  { x1: 296, y1: 64, x2: 288, y2: 73 },
  { x1: 346, y1: 180, x2: 334, y2: 180 },
  { x1: 300, y1: 292, x2: 291, y2: 284 },
  { x1: 120, y1: 338, x2: 124, y2: 327 },
  { x1: 34, y1: 230, x2: 46, y2: 225 },
  { x1: 42, y1: 108, x2: 53, y2: 113 },
]

/** The reveal constellation: the user's actual zodiac figure ignited
 *  over the pictorial art. The art is the FLESH (now in its own
 *  Animated.View layer behind this Svg), the asterism the joints. When
 *  `sign` is null (no derivable sign) NO figure is drawn — only the
 *  neutral atmosphere + halo.
 *
 *  REST STATE: the WHOLE asterism (stars + lines) lives inside the
 *  ConstellationFigure component, which BOTH drives its opacity from
 *  constSettle AND gates its MOUNT on a useAnimatedReaction (constSettle >
 *  0.001). At the climax/gloria constSettle is 1 (the figure ignites over
 *  the art); then it animates to 0 so the constellation fades and, once it
 *  reaches 0, the subtree UNMOUNTS — killing the ~70 worklets + the per-star
 *  twinkles instead of leaving them running under an invisible group. The
 *  art + the two halo layers live OUTSIDE that subtree, so only the figure
 *  fades + unmounts. */
function RevealConstellation({
  size,
  climaxClock,
  artClock,
  veilClock,
  igniteClock,
  flashClock,
  raysClock,
  haloClock,
  lineBoost,
  burstPulse,
  skyOrbit,
  orbitClock,
  inhaleClock,
  ringsClock,
  beamClock,
  auraBreath,
  spinClock,
  constSettle,
  figureMounted,
  linesLit,
  sign,
  instant,
}: {
  size: number
  climaxClock: SharedValue<number>
  artClock: SharedValue<number>
  veilClock: SharedValue<number>
  igniteClock: SharedValue<number>
  flashClock: SharedValue<number>
  raysClock: SharedValue<number>
  haloClock: SharedValue<number>
  lineBoost: SharedValue<number>
  burstPulse: SharedValue<number>
  skyOrbit: SharedValue<number>
  orbitClock: SharedValue<number>
  inhaleClock: SharedValue<number>
  ringsClock: SharedValue<number>
  beamClock: SharedValue<number>
  auraBreath: SharedValue<number>
  spinClock: SharedValue<number>
  constSettle: SharedValue<number>
  figureMounted: boolean
  linesLit: boolean
  sign: ZodiacSign | null
  instant: boolean
}) {
  const CX = size / 2
  const CY = size / 2
  // Scale the transcribed 360-px ceremony geometry (rays/halo/etc.) to
  // the live stage so small screens keep proportions.
  const geom = size / 360

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        {/* ── STAR GRADIENTS — the illustrator's "mapa estelar trazado
            sobre la criatura". The KEY is the final stop at stopOpacity 0:
            the magenta halo VANISHES into transparency at the edge instead
            of ending in solid magenta. A solid magenta edge fused with the
            magenta-dominant art (it read as a sticker glued on). A white-hot
            core with a halo that dissolves reads as LIGHT traced on top of
            the painted creature. */}
        <RadialGradient id="reveal-anchor" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="30%" stopColor="#FFF6E5" />
          <Stop offset="62%" stopColor={colors.magentaHot} stopOpacity={0.85} />
          <Stop offset="100%" stopColor={colors.magentaDeep} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reveal-star" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="35%" stopColor="#FFF6E5" />
          <Stop offset="70%" stopColor="#FBD7E3" stopOpacity={0.9} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
        {/* Cold ghost star — silver-blue → índigo. The asterism reads as
            cold, unreadable points UNDER the veil before the climax. */}
        <RadialGradient id="reveal-ghost" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#E4ECF7" />
          <Stop offset="55%" stopColor={colors.dimension.ciclo} />
          <Stop offset="100%" stopColor={colors.dimension.sueno} />
        </RadialGradient>
        <RadialGradient id="reveal-ambient" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.16} />
          <Stop offset="50%" stopColor={colors.magenta} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
        {/* Climax flash — white core → soft pink → magentaHot → gone. */}
        <RadialGradient id="reveal-flash" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="20%" stopColor="#FBD7E3" stopOpacity={1} />
          <Stop offset="45%" stopColor={colors.magentaHot} stopOpacity={0.85} />
          <Stop offset="100%" stopColor={colors.magentaHot} stopOpacity={0} />
        </RadialGradient>
        {/* Warm ignite — cream core → magentaHot → transparent. Painted
            OVER the art's centre to "light it on fire". */}
        <RadialGradient id="reveal-warm-ignite" cx="50%" cy="50%" r="55%">
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.95} />
          <Stop offset="38%" stopColor={colors.magentaHot} stopOpacity={0.7} />
          <Stop offset="100%" stopColor={colors.magentaHot} stopOpacity={0} />
        </RadialGradient>
        {/* Niebla veil — magenta-índigo blend that hides what's coming. */}
        <RadialGradient id="reveal-veil" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor={colors.dimension.sueno} stopOpacity={0.5} />
          <Stop offset="55%" stopColor={colors.magentaDeep} stopOpacity={0.4} />
          <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
        </RadialGradient>
        {/* ── GOLDEN AURA — the resting halo dorado the usuaria asked for,
            now BIGGER + more diffuse. Replicated INLINE from
            assets/reveal/golden-aura.svg (we own the stops here so the pulse
            can drive them). Three radials, all soft falloff to transparent:
            bloom (vapor exterior), body (the warm mass), rim (a gradient PEAK
            at ~66% that decays — insinúa un borde circular WITHOUT a closed
            stroke, so it never reads as a diana). cx/cy 48% keeps the optical
            centre slightly high. */}
        <RadialGradient id="reveal-aura-bloom" cx="50%" cy="48%" r="50%">
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.1} />
          <Stop offset="42%" stopColor="#D9AE6F" stopOpacity={0.16} />
          <Stop offset="78%" stopColor="#D9AE6F" stopOpacity={0.06} />
          <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reveal-aura-body" cx="50%" cy="48%" r="50%">
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.22} />
          <Stop offset="34%" stopColor="#E8B872" stopOpacity={0.2} />
          <Stop offset="68%" stopColor="#D9AE6F" stopOpacity={0.12} />
          <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="reveal-aura-rim" cx="50%" cy="48%" r="50%">
          <Stop offset="0%" stopColor="#D9AE6F" stopOpacity={0} />
          <Stop offset="52%" stopColor="#D9AE6F" stopOpacity={0} />
          <Stop offset="66%" stopColor="#FFE9C2" stopOpacity={0.3} />
          <Stop offset="76%" stopColor="#D9AE6F" stopOpacity={0.1} />
          <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
        </RadialGradient>
        {/* ── LIGHT COLUMN — vertical cream→oro→transparent. Drawn on a Rect
            whose width destella with the coin's turn; the gradient is a soft
            radial so the column's core is warm and the edges feather out. */}
        <RadialGradient id="reveal-beam" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.9} />
          <Stop offset="45%" stopColor="#D9AE6F" stopOpacity={0.5} />
          <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Ambient magenta wash — contracts + intensifies in B1, peaks at
          the climax, settles at rest. INHALE contracts it further in B2. */}
      <AmbientWash
        climaxClock={climaxClock}
        inhaleClock={inhaleClock}
        cx={CX}
        cy={CY}
        active={figureMounted}
        scale={geom}
      />

      {/* GOLDEN AURA — the resting halo dorado, BEHIND the warm layers.
          Fades in + grows from centre on haloClock, then breathes on
          auraBreath. Static on the instant branch (auraBreath=0). OUTSIDE
          the constSettle group — it persists at rest as the protagonist. */}
      <GoldenAura clock={haloClock} breath={auraBreath} cx={CX} cy={CY} scale={geom} />

      {/* Ceremonial halo (the broken art-deco ring on TOP of the aura) —
          fades in at settle. Together: aura dorada CON estructura. */}
      <CeremonialHalo clock={haloClock} orbit={skyOrbit} cx={CX} cy={CY} scale={geom} />

      {/* LIGHT COLUMN — sweeps with the coin at the climax. Behind the
          constellation, over the warm layers. Gated by beamClock. */}
      {figureMounted && !instant ? (
        <BeamColumn
          clock={beamClock}
          spinClock={spinClock}
          cx={CX}
          cy={CY}
          size={size}
          scale={geom}
        />
      ) : null}

      {/* Warm-ignite bloom — over the art's centre, "lights it on fire".
          Only meaningful when there's art to ignite. */}
      {figureMounted && sign && !instant ? (
        <IgniteBloom clock={igniteClock} cx={CX} cy={CY} scale={geom} />
      ) : null}

      {/* ── THE ASTERISM — stars + lines wrapped in ConstellationFigure,
          which drives the subtree's opacity from constSettle AND gates its
          MOUNT on a useAnimatedReaction (constSettle > 0.001). At the
          climax/gloria constSettle is 1 (the figure ignites over the art);
          then it animates to 0 so the WHOLE figure fades, hands protagonism
          to the golden halo, and UNMOUNTS once it reaches 0 — no zombie
          worklets/twinkles at rest. On the instant branch constSettle starts
          at 0 → the figure never mounts. */}
      <ConstellationFigure
        size={size}
        cx={CX}
        cy={CY}
        sign={sign}
        figureMounted={figureMounted}
        linesLit={linesLit}
        climaxClock={climaxClock}
        lineBoost={lineBoost}
        constSettle={constSettle}
      />

      {/* The veil — niebla over everything in B0/B1, disipates at the
          climax. Only when there's a figure to hide (and not instant). */}
      {figureMounted && sign && !instant ? (
        <RevealVeil clock={veilClock} cx={CX} cy={CY} size={size} />
      ) : null}

      {/* The centre seed (B0) + convergence motes (B1, orbital → spiral). */}
      {figureMounted && !instant ? (
        <ConvergenceField cx={CX} cy={CY} orbitClock={orbitClock} inhaleClock={inhaleClock} />
      ) : null}

      {/* ── CLIMAX burst (radial from centre, all ephemeral) — flash +
          11 god rays + 3 energy rings wrapped in ClimaxBurst, which
          mounts/unmounts the whole group via a useAnimatedReaction so the
          worklets only exist DURING the climax window. (Shockwave removed —
          the clímax is warmth, not "achievement unlocked".) */}
      <ClimaxBurst
        cx={CX}
        cy={CY}
        scale={geom}
        flashClock={flashClock}
        raysClock={raysClock}
        ringsClock={ringsClock}
      />
      {/* (d) particle burst — gated internally by burstPulse */}
      <ParticleBurst cx={CX} cy={CY} pulse={burstPulse} trainedCount={1} />
    </Svg>
  )
}

/* ───────────────────── The asterism (mount-gated) ───────────────────── */

/** The stars + lines subtree. WORKLET-ZOMBIE GATE (reanimated-guardian,
 *  severidad media): the ~10 ConstellationStar (each ~7 useAnimatedProps +
 *  an infinite `twinkle`) and the ConstellationLine nodes used to stay
 *  MOUNTED under an opacity-0 AnimatedG at rest, leaving ~70 worklets + 10
 *  perpetual twinkles drawing nothing. This component now gates their MOUNT
 *  on `constSettle > 0.001` — the SAME pattern the ephemeral nodes
 *  (BeamColumn/ClimaxBurst) use — so the figure mounts when it forms (climax,
 *  constSettle=1) and UNMOUNTS once constSettle lands at 0 after the fade.
 *
 *  Timing: the predicate `> 0.001` keeps the subtree mounted through the
 *  ENTIRE fade-out (the fade is VISIBLE — the unmount happens AFTER 0 is
 *  reached, not before). On the instant branch constSettle starts at 0 →
 *  the reaction yields active=false → the figure NEVER mounts (coherent with
 *  "reposo = arte + halo, sin constelación").
 *
 *  The reaction + state live HERE at component top-level (never inline in a
 *  .map), and runOnJS hops the predicate result to JS to flip the state. */
function ConstellationFigure({
  size,
  cx,
  cy,
  sign,
  figureMounted,
  linesLit,
  climaxClock,
  lineBoost,
  constSettle,
}: {
  size: number
  cx: number
  cy: number
  sign: ZodiacSign | null
  figureMounted: boolean
  linesLit: boolean
  climaxClock: SharedValue<number>
  lineBoost: SharedValue<number>
  constSettle: SharedValue<number>
}) {
  // MOUNT GATE — mirror constSettle's "alive" window into JS state. While
  // constSettle > 0.001 the figure is mounted (forms at the climax, stays
  // through the visible fade); once it lands at 0 the subtree unmounts and
  // every star/line worklet + twinkle is gone. Starts inactive; the reaction
  // fires synchronously at mount so the instant branch (constSettle=0) never
  // mounts the figure.
  const [constActive, setConstActive] = useState(false)
  useAnimatedReaction(
    () => constSettle.value > 0.001,
    (active, prev) => {
      if (active === prev) return
      runOnJS(setConstActive)(active)
    },
    [],
  )

  // The WHOLE asterism's opacity = constSettle (1 at climax/gloria → 0 at
  // rest). Wraps the stars + lines so the figure sinks into the art cleanly
  // as it fades, then the gate above unmounts it.
  const constGroupProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: constSettle.value }
  })

  if (!constActive) return null

  const sp = spread(size)
  const figure = sign ? ZODIAC[sign] : null
  const stars = figure?.stars ?? []
  const lines = figure?.lines ?? []

  return (
    <AnimatedG animatedProps={constGroupProps}>
      {/* Constellation lines — drawn before the stars so the blooms
          cover the line ends. Snap in at B4 (once the coin is de frente). */}
      {linesLit
        ? lines.map((pair, i) => {
            const a = stars[pair[0]]
            const b = stars[pair[1]]
            if (!a || !b) return null
            const p1 = projectStar(a.x, a.y, cx, cy, sp.x, sp.y)
            const p2 = projectStar(b.x, b.y, cx, cy, sp.x, sp.y)
            return (
              <ConstellationLine
                key={`line-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                delay={i * 28}
                lineBoost={lineBoost}
              />
            )
          })
        : null}

      {/* The figure's stars — mounted COLD (ghost, silver-índigo) when the
          gate opens, crossfaded to WARM at the climax. */}
      {figureMounted
        ? stars.map((star, i) => {
            const { x, y } = projectStar(star.x, star.y, cx, cy, sp.x, sp.y)
            return (
              <ConstellationStar
                key={`star-${i}`}
                index={i}
                cx={x}
                cy={y}
                size={magToSize(star.mag)}
                isAnchor={star.mag <= 1.7}
                climaxClock={climaxClock}
              />
            )
          })
        : null}
    </AnimatedG>
  )
}

/* ───────────────────── The pictorial art ───────────────────── */

/** Render a zodiac art asset. It is EITHER a transformer-generated SVG
 *  component (FC<SvgProps> — the case for ALL our `.svg` art) OR a bitmap
 *  source. The path is picked at runtime via `typeof === 'function'`,
 *  EXACTLY as ZodiacEngraving.renderAsset does. For the coin-spin layer
 *  the art renders inside a plain RN Animated.View (no surrounding <Svg>),
 *  so the FC<SvgProps> draws its OWN root <Svg>; bitmaps use <RNImage>. */
function renderArt(asset: ZodiacAsset, size: number) {
  if (typeof asset === 'function') {
    const Component = asset
    return <Component width={size} height={size} />
  }
  return <RNImage source={asset} style={{ width: size, height: size }} resizeMode="contain" />
}

/** Whole turns the coin spins before it stops. 3 = 1080° of rotateY — fast
 *  at first (ease-out on spinClock, now 3800 ms) and decelerating to a dead
 *  stop de frente. The usuaria asked for 2–3 turns and a slower spin to
 *  appreciate the revelation. */
const SPINS = 3

/** The pictorial zodiac art — the FLESH. Lives in its OWN Animated.View
 *  (NOT inside the constellation <Svg>) so it can do a true 3D COIN-SPIN:
 *  rotateY SPINS*360° → 0° (de frente, revealed) with a perspective,
 *  driven by the MONOTONIC spinClock (0→1, ease-out). Once spinClock
 *  reaches 1 the angle is 0 and STAYS there — the opacity settle (artClock)
 *  no longer tugs the angle, so the art freezes perfectly de frente.
 *
 *  OPACITY: artClock now carries the EFFECTIVE opacity directly. It peaks at
 *  0.72 (glory) then rests at 0.55 — and the worklet renders it VERBATIM
 *  (clamped ≤0.72), with NO extra ×0.72 cap. That is what makes the painted
 *  toro settle at ~0.55 EFFECTIVE (protagonist, not dimmer than its halo),
 *  while the flip glory still peaks at 0.72.
 *
 *  INSTANT branch (reduced-motion / re-entry): `instant` is read inside the
 *  worklet so deg=0 (de frente) + opacity 0.55 directly — never mid-spin. */
function RevealArt({
  sign,
  artClock,
  spinClock,
  size,
  instant,
}: {
  sign: ZodiacSign
  artClock: SharedValue<number>
  spinClock: SharedValue<number>
  size: number
  instant: boolean
}) {
  // The art fills almost the whole stage now (~95 %) — bigger, the painted
  // creature dominates the stage as the user asked. The View is centred.
  const artSize = size * 0.95
  const offset = (size - artSize) / 2
  // `instant` is a plain prop; mirror it into a shared value so the worklet
  // reads it on the UI thread without closing over a JS boolean each frame.
  const reduce = useSharedValue(instant ? 1 : 0)
  useEffect(() => {
    reduce.value = instant ? 1 : 0
  }, [reduce, instant])

  const flipStyle = useAnimatedStyle(() => {
    'worklet'
    const isInstant = reduce.value > 0.5
    // SPIN — monotonic 0→1 (ease-out). rotateY whirls SPINS*360°→0°: lots of
    // turns up front, decelerating to 0 and SE QUEDA there (static forever).
    const spin = spinClock.value
    const deg = isInstant ? 0 : SPINS * 360 * (1 - spin)
    // OPACITY — artClock NOW carries the EFFECTIVE opacity directly (no extra
    // ×0.72 cap): it rises 0 → 0.72 (glory peak) and eases to 0.55 (rest), and
    // the worklet renders it verbatim. Clamped to 0.72 so the emerge never
    // overshoots even if the clock is mid-spring. This is what makes the toro
    // settle at ~0.55 EFFECTIVE — protagonist, not dimmer than its halo.
    const c = artClock.value
    const opacity = isInstant ? 0.55 : c <= 0 ? 0 : Math.min(0.72, c)
    return {
      opacity,
      // perspective + rotateY on the Y axis (degrees, not %). backface
      // hidden makes only the front face show as it whirls — the coin
      // "destella" past edge instead of revealing a mirrored back. If it
      // flickers on the simulator, switch backfaceVisibility to 'visible'.
      transform: [{ perspective: 900 }, { rotateY: `${deg}deg` }],
      backfaceVisibility: 'hidden',
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: 'absolute',
          left: offset,
          top: offset,
          width: artSize,
          height: artSize,
        },
        flipStyle,
      ]}
    >
      {renderArt(ART_BY_SIGN[sign], artSize)}
    </Animated.View>
  )
}

/* ───────────────────── Golden aura (resting halo) ───────────────────── */

/** The GOLDEN AURA the usuaria asked for — a diffuse halo dorado in reposo,
 *  BEHIND the CeremonialHalo's broken ring (together: aura CON estructura,
 *  never a HUD dial). Three inline radial gradients (replicated from
 *  assets/reveal/golden-aura.svg) on three concentric circles, all centred
 *  on (CX, CY - 9*scale) so the optical centre is slightly high — breaks the
 *  perfect-circle symmetry without reading as miscentred (offset bumped 6→9
 *  so the now-bigger glow clears the eyebrow above).
 *
 *  BIGGER + DIFFUSE PASS (usuaria): the three radii grew 180/148/150 →
 *  225/195/198 (outer radius ~0.50 → ~0.62 of the stage). The falloff to
 *  transparent is UNCHANGED, so growing them makes the glow MORE diffuse,
 *  never more defined — it must not read as a diana/anillo.
 *
 *  Choreography: reuses haloClock for the fade-in/grow-from-centre at settle
 *  (group opacity = haloClock, group scale 0.86→1). The aura FLORECE to full
 *  as the constellation sinks (constSettle 1→0) — the handoff: the figure
 *  disappears, the oro takes over. Once haloClock ≥ 1 the aura BREATHES on
 *  auraBreath (period 4200 ms): opacity oscila 0.50↔0.62, scale 1.00↔1.025.
 *
 *  INSTANT branch: auraBreath stays at 0 → opacity 0.50, scale 1.0 → static
 *  golden aura, exactly the resting frame. */
function GoldenAura({
  clock,
  breath,
  cx,
  cy,
  scale,
}: {
  clock: SharedValue<number>
  breath: SharedValue<number>
  cx: number
  cy: number
  scale: number
}) {
  // Optical centre desplazado slightly up (anti-symmetry); offset bumped to
  // 9*scale so the bigger glow doesn't invade the eyebrow above on the
  // short (288) stage.
  const acx = cx
  const acy = cy - 9 * scale
  const groupProps = useAnimatedProps(() => {
    'worklet'
    const h = clock.value
    // Until the halo has fully bloomed (h<1) it's the entrance: grow from
    // 0.86→1, opacity straight from h. After it settles, breathe.
    const settled = h >= 1
    const s = settled ? 1 + 0.025 * breath.value : 0.86 + 0.14 * h
    const opacity = settled ? 0.5 + 0.12 * breath.value : h
    return {
      opacity,
      // scale about the optical centre (acx, acy).
      transform: `translate(${acx} ${acy}) scale(${s}) translate(${-acx} ${-acy})`,
    }
  })
  return (
    <AnimatedG animatedProps={groupProps}>
      <Circle cx={acx} cy={acy} r={225 * scale} fill="url(#reveal-aura-bloom)" />
      <Circle cx={acx} cy={acy} r={195 * scale} fill="url(#reveal-aura-body)" />
      <Circle cx={acx} cy={acy} r={198 * scale} fill="url(#reveal-aura-rim)" />
    </AnimatedG>
  )
}

/* ───────────────────── Light column (climax) ───────────────────── */

/** A vertical LIGHT COLUMN that sweeps with the coin at the climax. Its
 *  width destella in sync with each coin turn (Math.cos of the remaining
 *  spin angle), opacity rides beamClock. Drawn on a Rect, centred, full
 *  stage height, behind the constellation.
 *
 *  WORKLET-ZOMBIE GATE: after the climax beamClock rests at 0; this node
 *  mounts/unmounts on its own reaction so the worklet only exists while the
 *  beam has something to draw — never a lingering opacity-0 node. (On the
 *  instant branch the callsite never mounts it.) */
function BeamColumn({
  clock,
  spinClock,
  cx,
  cy,
  size,
  scale,
}: {
  clock: SharedValue<number>
  spinClock: SharedValue<number>
  cx: number
  cy: number
  size: number
  scale: number
}) {
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => clock.value > 0.001,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  const props = useAnimatedProps(() => {
    'worklet'
    const b = clock.value
    // width pulses with the coin: |cos(remaining angle)| → narrow when the
    // coin is edge-on, wider when face-on. Same SPINS the art uses.
    const remaining = SPINS * 360 * (1 - spinClock.value)
    const w = (10 + 18 * Math.abs(Math.cos((remaining * Math.PI) / 180))) * scale
    return {
      x: cx - w / 2,
      width: w,
      opacity: 0.5 * b,
    }
  })
  if (!active) return null
  return (
    <AnimatedRect y={cy - size / 2} height={size} fill="url(#reveal-beam)" animatedProps={props} />
  )
}

/** The warm-ignite bloom painted over the art — cream→magentaHot→
 *  transparent. Spikes ~0.55 at the climax, decays to 0 in glory.
 *
 *  WORKLET-ZOMBIE GATE: after the climax igniteClock rests at 0; without
 *  a gate this node's useAnimatedProps would keep running every frame at
 *  opacity 0 forever. We mount/unmount on a reaction over the clock so the
 *  worklet only exists while it has something to draw. (On the instant
 *  branch the callsite never mounts it; this gate is the in-flight close.) */
function IgniteBloom({
  clock,
  cx,
  cy,
  scale,
}: {
  clock: SharedValue<number>
  cx: number
  cy: number
  scale: number
}) {
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => clock.value > 0.001,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  const props = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: (60 + w * 70) * scale, opacity: 0.55 * w }
  })
  if (!active) return null
  return <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-warm-ignite)" animatedProps={props} />
}

/** The niebla veil — sits over the cold ghost + dormant art in B0/B1
 *  (op → 0.5) and DISIPATES at the climax (contracts r + drops op).
 *
 *  WORKLET-ZOMBIE GATE: the veil starts veilClock>0 in B0 so it mounts
 *  immediately; after the climax veilClock decays back to 0 and would
 *  otherwise leave this node's useAnimatedProps running forever at opacity
 *  0. The `> 0.001` reaction keeps it mounted through the whole dissipation
 *  (while it still decays it stays visible) and unmounts it once it
 *  reaches 0. (Instant branch never mounts it via the callsite.) */
function RevealVeil({
  clock,
  cx,
  cy,
  size,
}: {
  clock: SharedValue<number>
  cx: number
  cy: number
  size: number
}) {
  const baseR = size * 0.46
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => clock.value > 0.001,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  const props = useAnimatedProps(() => {
    'worklet'
    const v = clock.value // 0 → 0.5 (B1) → 0 (climax)
    // contract slightly as it dies so it reads as "burning off".
    return { r: baseR * (0.78 + 0.22 * (v / 0.5)), opacity: v }
  })
  if (!active) return null
  return <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-veil)" animatedProps={props} />
}

/* ───────────────────── Optional blur (enhancement) ───────────────────── */

/** Desenfoque→foco — PROGRESSIVE ENHANCEMENT over the stage. opacity =
 *  1 - (artClock/0.6) while 0 < artClock < 0.6; mounts/unmounts on its
 *  own reaction so it never lingers. If it janks on the simulator,
 *  deleting this component + its callsite changes nothing essential. */
function RevealBlur({ artClock, size }: { artClock: SharedValue<number>; size: number }) {
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => artClock.value > 0 && artClock.value < 0.6,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  const style = useAnimatedStyle(() => {
    'worklet'
    const stamp = Math.min(1, artClock.value / 0.6)
    return { opacity: 1 - stamp }
  })
  if (!active) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: size, height: size }, style]}
    >
      <AnimatedBlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
    </Animated.View>
  )
}

/* ───────────────────── Climax burst group ───────────────────── */

/** Wraps the ephemeral climax effects (flash bloom + 11 god rays + 3 energy
 *  rings) and mounts/unmounts the WHOLE group on a useAnimatedReaction over
 *  their clocks — so outside the climax window the SVG nodes (and their
 *  worklets) are gone. The predicate now ALSO watches ringsClock so the
 *  rings ride the same window with no zombies. (The beam has its own gate in
 *  BeamColumn since it also needs spinClock + size from the parent.) The
 *  shockwave double-ring was removed: it read as "achievement unlocked".
 *
 *  INSTANT branch: the schedule never starts flash/rays/rings (all rest at
 *  0) → predicate false → ClimaxBurst never mounts. */
function ClimaxBurst({
  cx,
  cy,
  scale,
  flashClock,
  raysClock,
  ringsClock,
}: {
  cx: number
  cy: number
  scale: number
  flashClock: SharedValue<number>
  raysClock: SharedValue<number>
  ringsClock: SharedValue<number>
}) {
  const [active, setActive] = useState(false)
  useAnimatedReaction(
    () => raysClock.value > 0 || flashClock.value > 0 || ringsClock.value > 0,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
    },
    [],
  )
  if (!active) return null

  return (
    <>
      {/* (f) energy rings — broken, rotated, asymmetric — behind the rays */}
      {ENERGY_RINGS.map((ring, i) => (
        <EnergyRing
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          ring={ring}
          clock={ringsClock}
          scale={scale}
        />
      ))}
      {/* (b) god rays */}
      {GOD_RAYS.map((ray, i) => (
        <GodRay key={`ray-${i}`} cx={cx} cy={cy} ray={ray} clock={raysClock} scale={scale} />
      ))}
      {/* (a) flash bloom */}
      <FlashBloom cx={cx} cy={cy} clock={flashClock} scale={scale} />
    </>
  )
}

/* ───────────────────────── Centre / motes ───────────────────────── */

/** B0 cream seed + B1 convergence motes. The seed is born at the centre
 *  and PULSES (never a static freeze during the held breath); it CHARGES
 *  during the inhalación (r 3→5, op 0.9→1). The motes ORBIT then collapse
 *  in a spiral. Each mote owns its own clock. */
function ConvergenceField({
  cx,
  cy,
  orbitClock,
  inhaleClock,
}: {
  cx: number
  cy: number
  orbitClock: SharedValue<number>
  inhaleClock: SharedValue<number>
}) {
  const seed = useSharedValue(0)
  useEffect(() => {
    seed.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
      // gentle living pulse through the held breath — "this is forming",
      // not "image broken". Eaten by the flash at the climax visually.
      withRepeat(withTiming(0.7, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true),
    )
    return () => cancelAnimation(seed)
  }, [seed])
  const seedProps = useAnimatedProps(() => {
    'worklet'
    // base pulse + INHALE charge: r 3→5, op 0.9→1 during the held breath.
    const inh = inhaleClock.value
    const r = 1 + seed.value * 2 + inh * 2
    const opacity = Math.min(1, 0.4 + seed.value * 0.5 + inh * 0.2)
    return { r, opacity }
  })

  return (
    <>
      <AnimatedCircle cx={cx} cy={cy} fill="#FFF6E5" animatedProps={seedProps} />
      {Array.from({ length: MOTE_COUNT }).map((_, i) => (
        <ConvergenceMote
          key={`mote-${i}`}
          cx={cx}
          cy={cy}
          index={i}
          orbitClock={orbitClock}
          inhaleClock={inhaleClock}
        />
      ))}
    </>
  )
}

/** A single converging mote. Deterministic angle/radius by index. TWO
 *  phases over its own progress `u`:
 *    · orbital (u < 0.6): rotates in its radius (angle += orbitClock*1.4)
 *      at constant radius — the field SWIRLS before it collapses.
 *    · collapse (u ≥ 0.6): radius eases to 0 while the angle keeps
 *      advancing → the mote falls in a SPIRAL, never a straight line.
 *  Gold motes (index % 3 === 0) rise as EMBERS during the orbital phase.
 *  The collapse accelerates with the inhalación. */
function ConvergenceMote({
  cx,
  cy,
  index,
  orbitClock,
  inhaleClock,
}: {
  cx: number
  cy: number
  index: number
  orbitClock: SharedValue<number>
  inhaleClock: SharedValue<number>
}) {
  const angle = index * 2.39996 + (index % 3) * 0.21
  const radius = MOTE_R_MIN + ((index * 53) % (MOTE_R_MAX - MOTE_R_MIN))
  const isMagenta = index % MOTE_MAGENTA_EVERY === 0
  const isEmber = index % 3 === 0
  const fill = isMagenta ? colors.magenta : '#FFF6E5'

  const t = useSharedValue(0)
  useEffect(() => {
    // B1 progress ~700 ms — orbital then collapse, straight into the climax.
    t.value = withTiming(1, { duration: 700, easing: Easing.in(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [t])

  const props = useAnimatedProps(() => {
    'worklet'
    // inhalación accelerates the collapse (multiplies progress).
    const u = Math.min(1, t.value * (1 + inhaleClock.value * 0.4))
    // angle keeps advancing across BOTH phases (orbit swing + spiral tail).
    const ang = angle + orbitClock.value * 1.4
    // radius: constant through the orbital phase (u<0.6), then ease-in to 0.
    let r = radius
    if (u >= 0.6) {
      const k = (u - 0.6) / 0.4 // 0→1 across the collapse
      r = radius * (1 - k * k) // ease-in shrink
    }
    // ember lift — gold motes rise during the orbital phase.
    const lift = isEmber ? orbitClock.value * 12 : 0
    const x = cx + Math.cos(ang) * r
    const y = cy + Math.sin(ang) * r - lift
    const dotR = 0.6 + u * 0.8
    const opacity = u < 0.1 ? (u / 0.1) * 0.9 : u > 0.92 ? (1 - (u - 0.92) / 0.08) * 0.9 : 0.9
    return { cx: x, cy: y, r: dotR, opacity }
  })

  return <AnimatedCircle cx={cx} cy={cy} fill={fill} animatedProps={props} />
}

/* ───────────────────── Ambient wash (ARC) ───────────────────── */

/** Soft magenta radial wash behind the constellation. ARC tied to the
 *  ceremony: contracts + intensifies in B1, IMPLOSIONA further during the
 *  inhalación (B2), peaks at the climax, settles with a slow living breath
 *  at rest (never a freeze). */
function AmbientWash({
  climaxClock,
  inhaleClock,
  cx,
  cy,
  active,
  scale,
}: {
  climaxClock: SharedValue<number>
  inhaleClock: SharedValue<number>
  cx: number
  cy: number
  active: boolean
  scale: number
}) {
  const arc = useSharedValue(0)
  useEffect(() => {
    if (!active) return
    arc.value = withSequence(
      // compressed B1 contraction (~700 ms, matching the motes)
      withTiming(1, { duration: 700, easing: Easing.in(Easing.cubic) }),
      // settle / calm breath from B5 onward
      withRepeat(withTiming(1.06, { duration: 2800, easing: Easing.inOut(Easing.ease) }), -1, true),
    )
    return () => cancelAnimation(arc)
  }, [arc, active])

  const props = useAnimatedProps(() => {
    'worklet'
    const a = Math.min(1, arc.value)
    const breath = Math.max(0, arc.value - 1)
    const c = climaxClock.value
    // INHALE implosiona the wash: contract r by up to 22*scale during B2.
    const r = (140 - a * 50 + c * 18 + breath * 8 - inhaleClock.value * 22) * scale
    const opacity = 0.06 + a * 0.24 + c * 0.25
    return { r, opacity }
  })

  return <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-ambient)" animatedProps={props} />
}

/* ───────────────────── Climax burst elements ───────────────────── */

/** (a) The flash bloom — white→pink→magentaHot radial. r 3→90, opacity
 *  0→0.85→0 on flashClock. Critically covers the frame the art
 *  ignites in. */
function FlashBloom({
  cx,
  cy,
  clock,
  scale,
}: {
  cx: number
  cy: number
  clock: SharedValue<number>
  scale: number
}) {
  const props = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: (3 + w * 87) * scale, opacity: 0.85 * w }
  })
  return <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-flash)" animatedProps={props} />
}

/** (f) One energy ring — a BROKEN (strokeDasharray), ROTATED arc that
 *  expands + fades on ringsClock. It is a STROKE (no fill) and rotated to
 *  an irregular angle so its gaps never align into a cross/diana. Worklet
 *  per ring (never a hook in a .map): r expands 92→rFinal × scale; opacity
 *  enters fast (×min(1, t*4)), then fades as it expands (×(1-t)). */
function EnergyRing({
  cx,
  cy,
  ring,
  clock,
  scale,
}: {
  cx: number
  cy: number
  ring: {
    rotate: number
    stroke: string
    width: number
    dash: string
    rFinal: number
    peak: number
  }
  clock: SharedValue<number>
  scale: number
}) {
  const props = useAnimatedProps(() => {
    'worklet'
    const t = clock.value
    const r = (92 + t * (ring.rFinal - 92)) * scale
    const opacity = ring.peak * (1 - t) * Math.min(1, t * 4)
    return { r, opacity }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="none"
      stroke={ring.stroke}
      strokeWidth={ring.width}
      strokeDasharray={ring.dash}
      strokeLinecap="round"
      // rotate the dashed ring so its gaps sit at an irregular angle (the
      // gaps of the three rings never align into a cross). Numeric degrees
      // about the live centre — static prop, UI-thread safe.
      transform={`rotate(${ring.rotate} ${cx} ${cy})`}
      animatedProps={props}
    />
  )
}

/** (b) One god ray — animates length + opacity on raysClock. Cream tint.
 *  Recolocated as "the light that ignites the art". */
function GodRay({
  cx,
  cy,
  ray,
  clock,
  scale,
}: {
  cx: number
  cy: number
  ray: { x2: number; y2: number; width: number; peak: number }
  clock: SharedValue<number>
  scale: number
}) {
  const dx = (ray.x2 - 180) * scale
  const dy = (ray.y2 - 180) * scale
  const props = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return {
      x2: cx + dx * w,
      y2: cy + dy * w,
      opacity: ray.peak * w,
    }
  })
  return (
    <AnimatedLine
      x1={cx}
      y1={cy}
      stroke="#FFF6E5"
      strokeWidth={ray.width}
      strokeLinecap="round"
      animatedProps={props}
    />
  )
}

/* ───────────────────── Ceremonial halo ───────────────────── */

/** The settle-state frame — two broken concentric rings + 7 irregular
 *  ornament ticks. Fades in op 0→0.5 on haloClock (bumped from 0.4 so the
 *  art-deco structure reads over the new golden aura); rotates VERY slowly on
 *  the 40 s skyOrbit. ENMARCA art+constellation, never a solid dial. The
 *  inner magenta ring drops to op 0.22 so the magenta CEDES to the oro and
 *  leaves the magenta protagonism to the stars. NOT grown by the bigger-aura
 *  pass — only the diffuse GLOW grew; this broken ring stays its size. */
function CeremonialHalo({
  clock,
  orbit,
  cx,
  cy,
  scale,
}: {
  clock: SharedValue<number>
  orbit: SharedValue<number>
  cx: number
  cy: number
  scale: number
}) {
  const groupProps = useAnimatedProps(() => {
    'worklet'
    const deg = orbit.value * 360
    // scale the transcribed 360-px geometry about the live centre, then
    // rotate — all numeric, UI-thread safe.
    return {
      opacity: 0.5 * clock.value,
      transform: `translate(${cx - 180 * scale} ${cy - 180 * scale}) scale(${scale}) rotate(${deg} 180 180)`,
    }
  })
  return (
    <AnimatedG animatedProps={groupProps}>
      {/* outer cream-gold ring, broken with a wide top-right gap */}
      <Path
        d="M 180 22 A 158 158 0 1 1 70 60"
        stroke="#D9AE6F"
        strokeWidth={0.8}
        opacity={0.4}
        strokeLinecap="round"
        fill="none"
      />
      {/* inner magenta ring, dashed, gap to the lower-left. Op dropped
          0.3→0.22 so the magenta cedes the protagonism to the stars/oro. */}
      <Path
        d="M 246 300 A 138 138 0 1 1 116 312"
        stroke={colors.magenta}
        strokeWidth={0.6}
        opacity={0.22}
        strokeDasharray="2 9"
        strokeLinecap="round"
        fill="none"
      />
      {/* ornament ticks — irregular angles, odd count */}
      <G stroke="#D9AE6F" strokeWidth={0.7} strokeLinecap="round" opacity={0.5}>
        {HALO_TICKS.map((tk, i) => (
          <Line key={`tick-${i}`} x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2} />
        ))}
      </G>
    </AnimatedG>
  )
}

/* ───────────────────── Stars + lines ───────────────────── */

/** A single constellation star — the joint of the painted creature.
 *  Mounts COLD (ghost, silver-índigo) in B1; at the climax climaxClock
 *  crossfades it to WARM and lights the flares so the whole figure
 *  ignites at once. Two overlaid cores (cold fades out, warm fades in)
 *  because interpolating an SVG gradient fill mid-flight isn't trivial.
 *
 *  ILLUSTRATOR PASS: the warm core gradients now end TRANSPARENT, so the
 *  star reads as white-hot LIGHT traced on the creature (its magenta halo
 *  dissolves into the art) rather than a magenta sticker fused with it.
 *  The anchor florece (haloBoost + brighter coreHi), the connectors stay
 *  quiet (their outer halos DROP) → clear jerarquía. A subtle per-star
 *  TWINKLE breathes ONLY the white coreHi spark (never the halo).
 *
 *  ZOMBIE FIX: the whole star group lives inside ConstellationFigure, which
 *  UNMOUNTS the subtree once constSettle lands at 0 — so the per-star
 *  twinkle (an infinite withRepeat) and these ~7 worklets are GONE at rest,
 *  not running invisibly under an opacity-0 group. The cleanup
 *  cancelAnimation(twinkle/ghost) fires on unmount. */
function ConstellationStar({
  index,
  cx,
  cy,
  size,
  isAnchor,
  climaxClock,
}: {
  index: number
  cx: number
  cy: number
  size: number
  isAnchor: boolean
  climaxClock: SharedValue<number>
}) {
  // Ghost clock: 0 → 0.3 over 500 ms on mount (the faint cold draw), then
  // a tiny calm breath visible only once the climax has lifted w.
  const ghost = useSharedValue(0)
  useEffect(() => {
    ghost.value = withSequence(
      withTiming(0.3, { duration: 500, easing: Easing.out(Easing.cubic) }),
      withDelay(
        600,
        withRepeat(
          withTiming(0.36, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      ),
    )
    return () => cancelAnimation(ghost)
  }, [ghost])

  // TWINKLE — a slow, sutil breath driven independently per star. It ONLY
  // modulates the white coreHi spark (not the halo, which would shimmer the
  // whole bloom). Staggered by index so the field never pulses in unison.
  // The anchor (Aldebarán) breathes a touch WIDER + SLOWER than the
  // connectors so it reads as the living heart of the figure even at rest.
  // (Now cancelled on unmount via the mount-gate in ConstellationFigure.)
  const twinkle = useSharedValue(0)
  useEffect(() => {
    // anchor: slower period (+600 ms base) so its "latido" is calm and
    // legible; connectors keep the original quicker shimmer.
    const period = (isAnchor ? 3200 : 2600) + index * 120
    twinkle.value = withDelay(
      index * 140,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(twinkle)
  }, [twinkle, index, isAnchor])

  // baseR — anchor bumped 3.6→4.0, connector dropped 2.8→2.4 so the anchor
  // reads clearly bigger than the rest (more contraste anchor↔resto).
  const baseR = (isAnchor ? 4.0 : 2.4) * size
  // coreHi (the white spark) — brighter anchor (0.52) vs connector (0.40).
  const coreHiFactor = isAnchor ? 0.52 : 0.4
  // Shorter, asymmetric anchor flare — H dominant, V shorter/fainter. No
  // diagonals (the cross read as a camera-reticle / mira). H = baseR*2.2.
  const flareH = baseR * 2.2
  const flareV = flareH * 0.55
  // haloBoost REACTIVATED for the anchor — it florece a touch bigger than
  // the connectors so the brightest joints bloom and the rest stay points.
  const haloBoost = isAnchor ? 1.35 : 1

  const haloOuter = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, ghost.value + climaxClock.value * 0.7)
    const breath = Math.max(0, ghost.value + climaxClock.value * 0.7 - 1)
    return {
      r: baseR * 4 * haloBoost * (0.5 + 0.5 * w + breath * 0.5),
      // warm halo only with the ignition (× climaxClock) — cold ghost
      // carries its own índigo core below, not a magenta halo. Connectors
      // DROP (0.03) while the anchor florece (0.08) → jerarquía.
      opacity: (isAnchor ? 0.08 : 0.03) * w * climaxClock.value,
    }
  })
  const haloMid = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, ghost.value + climaxClock.value * 0.7)
    return {
      r: baseR * 2.2 * haloBoost * (0.5 + 0.5 * w),
      opacity: (isAnchor ? 0.2 : 0.1) * w * climaxClock.value,
    }
  })
  // Cold ghost core — visible before the climax, fades OUT as warm rises.
  const coldCore = useAnimatedProps(() => {
    'worklet'
    const c = climaxClock.value
    const w = Math.min(1, ghost.value + c * 0.7)
    return { r: baseR * (0.4 + 0.6 * w), opacity: 1 - c }
  })
  // Warm core — fades IN with the ignition over the cold one.
  const warmCore = useAnimatedProps(() => {
    'worklet'
    const c = climaxClock.value
    const w = Math.min(1, ghost.value + c * 0.7)
    return { r: baseR * (0.4 + 0.6 * w), opacity: c }
  })
  const coreHi = useAnimatedProps(() => {
    'worklet'
    const c = climaxClock.value
    const w = Math.min(1, ghost.value + c * 0.7)
    // the white hot-spot only appears with the warm ignition, and BREATHES
    // on its own twinkle. Anchor breathes a touch wider/slower (68–100%),
    // connectors tighter (78–100%) — never the halo, only this spark.
    const tw = isAnchor ? 0.68 + 0.32 * twinkle.value : 0.78 + 0.22 * twinkle.value
    return { r: baseR * coreHiFactor * w, opacity: 0.95 * w * c * tw }
  })
  const streakH = useAnimatedProps(() => {
    'worklet'
    const c = climaxClock.value
    const len = flareH * c
    return { x1: cx - len, x2: cx + len, opacity: 0.38 * c }
  })
  const streakV = useAnimatedProps(() => {
    'worklet'
    const c = climaxClock.value
    const len = flareV * c
    return { y1: cy - len, y2: cy + len, opacity: 0.18 * c }
  })

  return (
    <>
      <AnimatedCircle cx={cx} cy={cy} fill={colors.magenta} animatedProps={haloOuter} />
      <AnimatedCircle cx={cx} cy={cy} fill={colors.magentaHot} animatedProps={haloMid} />
      {isAnchor ? (
        <>
          <AnimatedLine
            y1={cy}
            y2={cy}
            stroke="#FFF6E5"
            strokeWidth={1}
            strokeLinecap="round"
            animatedProps={streakH}
          />
          <AnimatedLine
            x1={cx}
            x2={cx}
            stroke="#FFF6E5"
            strokeWidth={0.7}
            strokeLinecap="round"
            animatedProps={streakV}
          />
        </>
      ) : null}
      {/* cold ghost core (fades out at ignition) */}
      <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-ghost)" animatedProps={coldCore} />
      {/* warm core (fades in at ignition) */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill={isAnchor ? 'url(#reveal-anchor)' : 'url(#reveal-star)'}
        animatedProps={warmCore}
      />
      <AnimatedCircle cx={cx} cy={cy} fill="#FFFFFF" animatedProps={coreHi} />
    </>
  )
}

/** A constellation line — a 2-layer cream-gold FILAMENT. Snaps in fast at
 *  B4 (120 ms, once the coin is de frente); opacity peaks momentarily on
 *  lineBoost, then settles.
 *
 *  ILLUSTRATOR PASS: thinned to a more intentional STROKE — the dorado
 *  bloom is now narrow + subtle (2.6, lower op) while the cream spine is
 *  thinner but MORE defined (0.9, higher op). Reads as a drawn trace with
 *  a faint golden halo, not a wide worm. Draw delay widened (i*28) so the
 *  order in which the figure is traced is perceptible. */
function ConstellationLine({
  x1,
  y1,
  x2,
  y2,
  delay,
  lineBoost,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  delay: number
  lineBoost: SharedValue<number>
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic) })
    }, delay)
    return () => {
      clearTimeout(id)
      cancelAnimation(t)
    }
  }, [t, delay])

  const bloomProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: (0.1 + 0.06 * lineBoost.value) * t.value }
  })
  const spineProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: (0.58 + 0.18 * lineBoost.value) * t.value }
  })

  return (
    <>
      <AnimatedLine
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#D9AE6F"
        strokeWidth={2.6}
        strokeLinecap="round"
        animatedProps={bloomProps}
      />
      <AnimatedLine
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#FFF6E5"
        strokeWidth={0.9}
        strokeLinecap="round"
        animatedProps={spineProps}
      />
    </>
  )
}

/* ───────────────────── Reveal atmosphere sky ────────────────────── */

/*
 * RevealSky — local volumetric depth behind the constellation. UNCHANGED
 * by the ceremony redesign. Mirrors tu-base.tsx's BaseSky tuned for the
 * reveal: all strata <0.32, central band clear, dust MAGENTA on the 5 s
 * clock, slow parallax on the 40 s orbit. Gradient ids `reveal-sky-*`.
 */
// Cool, faint, far field (parallax 2px). DENSIFIED 6→11 — fills the
// mid/lateral belt that was empty, always outside the central dead zone
// (x 0.32–0.68 / y 0.36–0.56). Density/brightness GROW with distance from
// the optical centre.
const REVEAL_DEEP: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.08, r: 0.6, opacity: 0.08 },
  { x: 0.88, y: 0.11, r: 0.7, opacity: 0.1 },
  { x: 0.5, y: 0.05, r: 0.5, opacity: 0.07 },
  { x: 0.06, y: 0.3, r: 0.6, opacity: 0.07 },
  { x: 0.94, y: 0.27, r: 0.6, opacity: 0.08 },
  { x: 0.09, y: 0.52, r: 0.5, opacity: 0.06 },
  { x: 0.93, y: 0.55, r: 0.6, opacity: 0.07 },
  { x: 0.18, y: 0.86, r: 0.6, opacity: 0.08 },
  { x: 0.84, y: 0.9, r: 0.7, opacity: 0.1 },
  { x: 0.5, y: 0.94, r: 0.5, opacity: 0.07 },
  { x: 0.3, y: 0.68, r: 0.5, opacity: 0.06 },
]
// Warmer, nearer field (parallax 5px). DENSIFIED 4→7.
const REVEAL_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.22, y: 0.14, r: 0.8, opacity: 0.22 },
  { x: 0.8, y: 0.16, r: 0.7, opacity: 0.26 },
  { x: 0.1, y: 0.4, r: 0.7, opacity: 0.18 },
  { x: 0.9, y: 0.43, r: 0.7, opacity: 0.2 },
  { x: 0.28, y: 0.84, r: 0.7, opacity: 0.22 },
  { x: 0.74, y: 0.87, r: 0.7, opacity: 0.24 },
  { x: 0.7, y: 0.66, r: 0.6, opacity: 0.18 },
]

// Twinkling stars — the only animated members of the field. They live in
// the OUTER ring (corners/edges), NEVER in the central dead zone. Blink is
// opacity lo↔hi + a gentle scale, easing inOut(sin), staggered per index and
// each with its own period → organic, slow, never strobing. `halo:true`
// stars breathe a wide soft glow (they "shine"); `halo:false` stay flat
// points (organic contrast). Economy of magenta: exactly ONE, low op, far.
const REVEAL_TWINKLE: {
  x: number
  y: number
  r: number
  lo: number
  hi: number
  period: number
  color: string
  halo: boolean
}[] = [
  { x: 0.1, y: 0.12, r: 1.1, lo: 0.22, hi: 0.6, period: 2600, color: '#FFF6E5', halo: true },
  { x: 0.66, y: 0.1, r: 0.9, lo: 0.18, hi: 0.5, period: 3400, color: '#FFF6E5', halo: false },
  { x: 0.9, y: 0.16, r: 1.2, lo: 0.24, hi: 0.62, period: 3000, color: '#FFF6E5', halo: true },
  { x: 0.07, y: 0.42, r: 0.85, lo: 0.16, hi: 0.44, period: 3800, color: '#D9AE6F', halo: false },
  { x: 0.93, y: 0.5, r: 0.9, lo: 0.18, hi: 0.48, period: 2900, color: '#FFF6E5', halo: false },
  {
    x: 0.16,
    y: 0.74,
    r: 1.0,
    lo: 0.14,
    hi: 0.4,
    period: 3300,
    color: colors.magentaHot,
    halo: true,
  },
  { x: 0.24, y: 0.88, r: 0.9, lo: 0.2, hi: 0.52, period: 2700, color: '#FFF6E5', halo: false },
  { x: 0.82, y: 0.86, r: 1.1, lo: 0.22, hi: 0.58, period: 3500, color: '#FFF6E5', halo: true },
  { x: 0.54, y: 0.92, r: 0.8, lo: 0.12, hi: 0.34, period: 4000, color: '#D9AE6F', halo: false },
]

const REVEAL_DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
  fill: string
}[] = [
  { x: 0.1, baseR: 0.9, period: 1.05, sway: 7, opacity: 0.22, phase: 0.1, fill: colors.magenta },
  { x: 0.9, baseR: 0.8, period: 0.95, sway: 8, opacity: 0.2, phase: 0.5, fill: colors.magenta },
  { x: 0.13, baseR: 0.65, period: 1.2, sway: 6, opacity: 0.17, phase: 0.7, fill: colors.magenta },
  { x: 0.87, baseR: 0.7, period: 1.12, sway: 7, opacity: 0.18, phase: 0.32, fill: colors.magenta },
  { x: 0.5, baseR: 0.55, period: 1.3, sway: 5, opacity: 0.14, phase: 0.85, fill: colors.magenta },
  // One COOL mote (ciclo silver-blue) for chromatic depth.
  {
    x: 0.78,
    baseR: 0.6,
    period: 1.18,
    sway: 6,
    opacity: 0.14,
    phase: 0.22,
    fill: colors.dimension.ciclo,
  },
]

/*
 * RevealTwinkle — ONE component per twinkling star (hooks must never live
 * inline in a .map). Each owns its own sharedValue + effect + cleanup. The
 * core breathes opacity lo↔hi and scales 0.85↔1.0; halo stars also breathe a
 * wide soft glow. Staggered by index*180ms + per-star period → organic, never
 * in unison. reduce-motion: no withRepeat, parks at t=0.5 (static mid-opacity)
 * — coherent with the rest of the file.
 */
function RevealTwinkle({
  x,
  y,
  r,
  lo,
  hi,
  period,
  color,
  halo,
  index,
  w,
  h,
  reduce,
}: {
  x: number
  y: number
  r: number
  lo: number
  hi: number
  period: number
  color: string
  halo: boolean
  index: number
  w: number
  h: number
  reduce: boolean
}) {
  const t = useSharedValue(reduce ? 0.5 : 0)
  useEffect(() => {
    if (reduce) return
    t.value = withDelay(
      index * 180,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(t)
  }, [t, period, index, reduce])
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: lo + (hi - lo) * t.value, r: r * (0.85 + 0.15 * t.value) }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    return {
      opacity: (lo * 0.4 + (hi * 0.5 - lo * 0.4) * t.value) * 0.5,
      r: r * (2.4 + 0.6 * t.value),
    }
  })
  const cx = x * w
  const cy = y * h
  return (
    <G>
      {halo ? (
        <AnimatedCircle
          cx={cx}
          cy={cy}
          fill="url(#reveal-twinkle-glow)"
          animatedProps={haloProps}
        />
      ) : null}
      <AnimatedCircle cx={cx} cy={cy} fill={color} animatedProps={coreProps} />
    </G>
  )
}

const RevealSky = memo(function RevealSky({
  clock,
  orbit,
}: {
  clock: SharedValue<number>
  orbit: SharedValue<number>
}) {
  // reduce-motion gate for the twinkle field (the depth circles + vignette
  // are static regardless; only RevealTwinkle reads this).
  const reduce = useReducedMotion()
  const SKY_W = 360
  const SKY_H = 760

  const deepDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 2} ${Math.cos(u) * 2})` }
  })
  const midDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(orbit.value * 2 * Math.PI * 3)
    return { transform: `translate(${Math.sin(u) * 5} ${Math.cos(u) * 5})`, opacity: flicker }
  })

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SKY_W} ${SKY_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="reveal-sky-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Warm lateral nebula well — cool→warm→fade. */}
          <RadialGradient id="reveal-depth-warm" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#7C8FFF" stopOpacity="0.05" />
            <Stop offset="0.6" stopColor="#A6164A" stopOpacity="0.03" />
            <Stop offset="1" stopColor="#0A0608" stopOpacity="0" />
          </RadialGradient>
          {/* Cool lower well. */}
          <RadialGradient id="reveal-depth-cool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#B5C4DD" stopOpacity="0.045" />
            <Stop offset="1" stopColor="#0A0608" stopOpacity="0" />
          </RadialGradient>
          {/* Vignette — clear centre (hugging the optical centre ~45%),
              darkening only the outer frame. */}
          <RadialGradient id="reveal-vignette" cx="50%" cy="45%" r="65%">
            <Stop offset="0" stopColor="#0A0608" stopOpacity="0" />
            <Stop offset="0.58" stopColor="#0A0608" stopOpacity="0" />
            <Stop offset="1" stopColor="#0A0608" stopOpacity="0.55" />
          </RadialGradient>
          {/* Twinkle micro-halo (clones reveal-sky-glow). */}
          <RadialGradient id="reveal-twinkle-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Lateral/lower depth wells — STATIC, back-most. Asymmetric on
            purpose. Centred away from the art disc so the toro's face
            (the dead zone) stays clean. */}
        <Circle cx={24} cy={360} r={200} fill="url(#reveal-depth-warm)" opacity={0.7} />
        <Circle cx={336} cy={300} r={180} fill="url(#reveal-depth-warm)" opacity={0.6} />
        <Circle cx={180} cy={660} r={240} fill="url(#reveal-depth-cool)" opacity={0.5} />

        {REVEAL_DUST.map((d, i) => (
          <DustMote key={`reveal-dust-${i}`} {...d} clock={clock} stage={SKY_H} />
        ))}

        <AnimatedG animatedProps={deepDriftProps}>
          {REVEAL_DEEP.map((s, i) => (
            <G key={`reveal-deep-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#reveal-sky-glow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        <AnimatedG animatedProps={midDriftProps}>
          {REVEAL_MID.map((s, i) => (
            <Circle
              key={`reveal-mid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* Twinkle field — outer ring only, in front of the strata. */}
        {REVEAL_TWINKLE.map((s, i) => (
          <RevealTwinkle
            key={`reveal-twinkle-${i}`}
            {...s}
            index={i}
            w={SKY_W}
            h={SKY_H}
            reduce={reduce}
          />
        ))}

        {/* Vignette — STATIC, last child so it sits over everything. */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#reveal-vignette)" />
      </Svg>
    </View>
  )
})

const styles = StyleSheet.create({
  // Vertical rhythm — the content claims the whole column (flexGrow 1) so
  // the stage centres optically in the upper space and the text anchors
  // below as a group, instead of everything stacking from the top with a
  // big gap above the headline.
  scrollContent: {
    flexGrow: 1,
  },
  // STAGE zone — eyebrow title + art. Takes the upper space and centres
  // its children so the art sits ópticamente centred there (with the
  // eyebrow as its title just above), not floating with a hole below.
  stageZone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
  stage: {
    // Tighter to the eyebrow above; the art reads as the eyebrow's subject.
    marginTop: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Breathing strip — a soft gap along the stage's bottom edge so the
  // art (op 0.55) is confined to the stage and never bleeds onto the
  // headline; keeps the serif body contrast clean.
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  // TEXT group — headline + body anchored together below the stage. The
  // small negative-ish top pull (just a tight marginTop) keeps the headline
  // close to the art so it reads as "saliendo" of it.
  textGroup: {
    marginTop: 4,
  },
  headlinePlaceholder: {
    height: 72,
  },
  bodyPlaceholder: {
    marginTop: 14,
    height: 66,
  },
  headline: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.macroNum,
    lineHeight: 36,
    color: colors.leche,
    letterSpacing: -1,
  },
  headlineEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.macroNum,
    color: colors.magenta,
  },
  body: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    // Bumped bone→leche: over the residual warm AmbientWash the serif
    // italic body needs the higher-contrast cream to stay ≥4.5:1.
    color: colors.leche,
  },
  bodyEm: {
    color: colors.magenta,
    fontFamily: typography.serifSemi,
  },
})

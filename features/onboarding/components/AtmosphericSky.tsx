import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Shared full-screen atmosphere for the onboarding wizard. Extracted
 * from welcome.tsx (step 1) so steps 1 and 2 breathe with the same
 * sky — same cool edge wash, same vertical density, same off-centre
 * warm glow — and only the glow's centre/radius moves to give each
 * step its own composition.
 *
 * Three static layers, all whisper-low (alphas 0.03–0.12), all
 * resolving to transparent so the bg shows through. Static on purpose:
 * the motion lives in each step's foreground field so this never
 * competes with it. pointerEvents none.
 *
 *   S0. Cool edge wash — diagonal índigo (sueno) → silver-blue (ciclo),
 *       the cold stratum that recedes (aerial perspective).
 *   S1. Vertical density — lightens the ceiling, sinks the floor into
 *       near-bg so the canvas reads top→bottom.
 *   S2. Off-centre warm glow — the "sun outside the frame". Position
 *       and radius are the `glow` prop; default reproduces step 1
 *       exactly (38% / 42% / 65%).
 *
 * The glow is rendered with an SVG RadialGradient (true falloff to
 * transparent). The id is derived from the glow coordinates so two
 * mounts on the same screen can never collide on a shared gradient id.
 */

type Glow = { cx: string; cy: string; r: string }

const DEFAULT_GLOW: Glow = { cx: '38%', cy: '42%', r: '65%' }

export function AtmosphericSky({ glow = DEFAULT_GLOW }: { glow?: Glow }) {
  // Per-instance gradient id so a second AtmosphericSky on the same
  // screen (different glow) never shares S2's def with the first.
  const gid = `skyGlow-${glow.cx}-${glow.cy}-${glow.r}`.replace(/[^a-zA-Z0-9-]/g, '')
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* S0. Cool edge wash — índigo → transparent → silver-blue. */}
      <LinearGradient
        colors={['rgba(124,143,255,0.06)', 'rgba(124,143,255,0)', 'rgba(181,196,221,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* S1. Vertical density — sinks the floor into near-bg shadow. An
          intermediate stop (0.74 → 0.32) was added so the floor curve is
          continuous and empalma cleanly with step 2's in-scene floor-fade
          (qh-floorFade). The ceiling stays transparent and the floor still
          lands at 0.6, so step 1 (welcome) is affected only imperceptibly
          (~0.03 alpha mid-floor, on a near-black layer). */}
      <LinearGradient
        colors={['rgba(10,6,8,0)', 'rgba(10,6,8,0)', 'rgba(9,5,7,0.32)', 'rgba(8,4,6,0.6)']}
        locations={[0, 0.45, 0.74, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* S2. Off-centre warm glow — the "sun outside the frame". */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={gid} cx={glow.cx} cy={glow.cy} r={glow.r}>
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity="0.10" />
            <Stop offset="0.5" stopColor={colors.magentaDeep} stopOpacity="0.04" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={glow.cx} cy={glow.cy} r={glow.r} fill={`url(#${gid})`} />
      </Svg>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * WarmBloomField — the deep WARM atmosphere for step 2 (what-it-does),
 * rendered FULL-SCREEN (absoluteFill, no bounded viewBox) so its big
 * radial washes resolve to transparent before ANY screen edge and can
 * never be clipped to a rectangle.
 *
 * WHY THIS EXISTS — the step-2 scene used to draw these washes (a field
 * bloom, an off-frame "sceneCore" sun, a deep nebula, a low fog) INSIDE
 * the scene's bounded <Svg viewBox 320×236>. That Svg renders entire and
 * centred within the screen (preserveAspectRatio meet) — it does NOT
 * bleed past the screen edges the way welcome's square hero does — so the
 * Svg viewport clipped those still-luminous washes in a straight line on
 * all four sides (the visible hard rectangle, worst on the right + floor).
 * Moving them to a full-screen layer kills the clip at the root and mirrors
 * how welcome delegates its big atmosphere to AtmosphericSky.
 *
 * It breathes on the host step's 5 s `clock` (no new clock introduced),
 * so it inhales/exhales on the same compás as the orbs. The bloom centre
 * sits LOW on screen (cy ~66%) so the warm pool falls under the trio of
 * orbs, exactly where the in-Svg sceneCore (viewBox 50%/72%) used to land.
 *
 * Percentages are screen-relative, so the radii are expressed as a
 * fraction of the SVG's own coordinate box via an explicit large `r` in
 * percent units — RadialGradient `r` is fine in %, and the painted
 * <Circle>/<Ellipse> use % too so everything scales with the device.
 *
 * VARIANT (illustrator pass for step 3 — attribution):
 *   'orbs'     (DEFAULT) — the EXACT original composition. Used by
 *              welcome (step 1, indirectly) and what-it-does (step 2), where
 *              the painted orb PNGs sit on top of it. Four coaxial
 *              radials (all cx~50–62% / cy~66–82%) read as a smooth disc
 *              — fine BECAUSE the orbs cover them.
 *   'exposed'  — for step 3, where the warm field is seen ALONE (no orbs
 *              over it). The coaxial disc reads as a flat magenta blob,
 *              so this variant DE-coaxialises the wash (centres in a
 *              triangle), gives the nebula an organic wisp border (two
 *              crossed rotated ellipses), replaces the single fog with
 *              three stacked volumetric haze bands (depth), and sinks the
 *              white-hot core low + small so it reads as a glow ON the
 *              horizon rather than a central sun.
 *   'exposed-low-left'
 *              — for step 4 (about-you), a FORM screen. The warm weight is
 *              pulled to the lower-LEFT corner so the central vertical
 *              channel (name input + date picker) stays a calm zone with
 *              minimal atmosphere. Same wisp-nebula technique as 'exposed'
 *              but re-anchored AND de-coaxialised further (illustrator
 *              elevation pass): the field bloom is pulled to cx34%/cy86%
 *              and shrunk to r46% so it stops reading as a circular smudge
 *              and pools as a painterly diagonal wisp in the inf-left
 *              corner; the second nebula ellipse opens its angle from
 *              cx22%/cy80% to cx14%/cy86%; the far ember core stays tucked
 *              at cx16%/cy92% r14%.
 *   'exposed-low-right'
 *              — for step 5 (body-base), the MIRRORED TWIN of about-you.
 *              An EXACT horizontal mirror of 'exposed-low-left' (every x →
 *              100−x, every rotation angle negated, every rotation pivot
 *              mirrored across the 50% axis: 79 → 281 ≈ 78%×360). The warm
 *              weight pools in the lower-RIGHT corner, so advancing from
 *              step 4 → 5 reads as the sky "rotating": the cold stays high,
 *              the warm slides corner-to-corner. Central channel (slider +
 *              sex pills) stays clear. Same wisp-nebula technique, same
 *              fieldProps/coreProps, only the geometry is reflected.
 *
 * All variants share the SAME four gradient defs (wbf-nebula / -field /
 * -core / -fog) and breathe on the SAME 5 s clock with the SAME opacity
 * worklets — only the painted geometry differs.
 */
export function WarmBloomField({
  clock,
  variant = 'orbs',
}: {
  clock: SharedValue<number>
  variant?: 'orbs' | 'exposed' | 'exposed-low-left' | 'exposed-low-right'
}) {
  // Field-bloom breath — OPACITY only on the 5 s clock. The radius is a
  // static % (no animated length-percent: react-native-svg re-resolves
  // "%" against the viewport every frame, which janks; and an animated-
  // only `r` flashes at r=0 on the first mount frame). Breathing the
  // opacity alone reads identically and stays on the numeric fast-path.
  const fieldProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.85 + w * 0.15 }
  })
  // Off-frame core breath — the "sun outside the frame". Opacity only.
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.8 + w * 0.2 }
  })

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {/* Deep nebula — off-centre elliptical mass, the deepest warm
              atmosphere. Falls off to transparent well inside the box. */}
          <RadialGradient id="wbf-nebula" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaDeep} stopOpacity="0.05" />
            <Stop offset="0.6" stopColor={colors.magentaDeep} stopOpacity="0.025" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
          {/* Field bloom — the warm light the three orbs sit in. */}
          <RadialGradient id="wbf-field" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity="0.20" />
            <Stop offset="0.5" stopColor={colors.magentaDeep} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
          {/* Off-frame sceneCore — burns to white at centre → pink →
              magentaHot → transparent. The "sun outside the cuadro". */}
          <RadialGradient id="wbf-core" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
            <Stop offset="0.2" stopColor="#FBD7E3" stopOpacity="0.42" />
            <Stop offset="0.45" stopColor={colors.magentaHot} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.magentaHot} stopOpacity="0" />
          </RadialGradient>
          {/* Low fog — a wide faint magentaDeep ellipse near the floor. */}
          <RadialGradient id="wbf-fog" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaDeep} stopOpacity="0.05" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {variant === 'exposed' ? (
          <>
            {/* DE-COAXIALISED WASH — centres form a triangle (nebula
                left-low, field right-mid, core right-low) so the eye no
                longer integrates them into one smooth disc. */}

            {/* Deep nebula — TWO crossed rotated ellipses sharing the
                wbf-nebula gradient, so the deepest warm mass has an
                organic wisp border instead of a clean circle. Centred
                left-low (cx 34% / cy 72%). */}
            <G transform={[{ translateX: 122 }, { translateY: 547 }, { rotate: '-20deg' }, { translateX: -122 }, { translateY: -547 }]}>
              <Ellipse cx="34%" cy="72%" rx="80%" ry="40%" fill="url(#wbf-nebula)" />
            </G>
            <G transform={[{ translateX: 122 }, { translateY: 547 }, { rotate: '35deg' }, { translateX: -122 }, { translateY: -547 }]}>
              <Ellipse cx="34%" cy="72%" rx="55%" ry="50%" fill="url(#wbf-nebula)" />
            </G>

            {/* Field bloom — moved right-mid (cx 58% / cy 64%), breathing.
                Off-axis from the nebula so the warm light is not concentric
                with the deep mass. */}
            <AnimatedCircle
              cx="58%"
              cy="64%"
              r="58%"
              fill="url(#wbf-field)"
              animatedProps={fieldProps}
            />

            {/* Volumetric haze — THREE wide horizontal bands stacked at
                cy 74 / 82 / 90%, decreasing opacity, so the lower screen
                reads as layered bruma with depth (aerial perspective),
                not one flat fog. Shares the wbf-fog gradient. */}
            <Ellipse cx="50%" cy="74%" rx="100%" ry="8%" fill="url(#wbf-fog)" opacity={0.06} />
            <Ellipse cx="50%" cy="82%" rx="95%" ry="12%" fill="url(#wbf-fog)" opacity={0.045} />
            <Ellipse cx="50%" cy="90%" rx="90%" ry="14%" fill="url(#wbf-fog)" opacity={0.03} />

            {/* White-hot core — sunk LOW and SMALL (cx 64% / cy 86% /
                r 18%) so it reads as a glow on the horizon, not a central
                sun. Breathes on the same core worklet. */}
            <AnimatedCircle
              cx="64%"
              cy="86%"
              r="18%"
              fill="url(#wbf-core)"
              animatedProps={coreProps}
            />
          </>
        ) : variant === 'exposed-low-left' ? (
          <>
            {/* LOW-LEFT WASH — for the about-you FORM. Everything is
                re-anchored to the lower-left corner so the centre channel
                (name input + date picker) stays empty. Same wisp-nebula
                technique as 'exposed', smaller bloom, floor-hugging haze. */}

            {/* Deep nebula — TWO crossed rotated ellipses. The first
                (rotate -20) stays anchored at cx22%/cy80%; the second
                (rotate 35) is opened OUT to cx14%/cy86% so the wisp
                fans diagonally into the corner instead of stacking
                coaxially over the first. Both share wbf-nebula. */}
            <G transform={[{ translateX: 79 }, { translateY: 608 }, { rotate: '-20deg' }, { translateX: -79 }, { translateY: -608 }]}>
              <Ellipse cx="22%" cy="80%" rx="74%" ry="38%" fill="url(#wbf-nebula)" />
            </G>
            <G transform={[{ translateX: 79 }, { translateY: 608 }, { rotate: '35deg' }, { translateX: -79 }, { translateY: -608 }]}>
              <Ellipse cx="14%" cy="86%" rx="50%" ry="48%" fill="url(#wbf-nebula)" />
            </G>

            {/* Field bloom — DE-COAXIALISED + shrunk (illustrator
                elevation): pulled to cx34%/cy86% and r46% so it stops
                reading as a circular disc and pools as a painterly
                diagonal wisp in the inf-left corner. Still clear of the
                central input channel. Breathing on the same worklet. */}
            <AnimatedCircle
              cx="34%"
              cy="86%"
              r="46%"
              fill="url(#wbf-field)"
              animatedProps={fieldProps}
            />

            {/* Volumetric haze — THREE floor-hugging bands at cy 80 / 88 /
                94%, decreasing opacity (0.05 / 0.035 / 0.025), so the
                weight pools at the very bottom and the centre stays clear. */}
            <Ellipse cx="50%" cy="80%" rx="100%" ry="8%" fill="url(#wbf-fog)" opacity={0.05} />
            <Ellipse cx="50%" cy="88%" rx="95%" ry="11%" fill="url(#wbf-fog)" opacity={0.035} />
            <Ellipse cx="50%" cy="94%" rx="90%" ry="13%" fill="url(#wbf-fog)" opacity={0.025} />

            {/* White-hot core — a far ember tucked into the bottom-left
                rincón (cx 16% / cy 92% / r 14%). Breathes on core worklet. */}
            <AnimatedCircle
              cx="16%"
              cy="92%"
              r="14%"
              fill="url(#wbf-core)"
              animatedProps={coreProps}
            />
          </>
        ) : variant === 'exposed-low-right' ? (
          <>
            {/* LOW-RIGHT WASH — the MIRRORED TWIN for body-base. An exact
                horizontal reflection of 'exposed-low-left': every cx → 100−cx,
                every rotation angle negated, every rotation pivot mirrored
                across the 50% axis (px 79 → 281, i.e. 22%×360 → 78%×360). The
                warm weight pools in the lower-RIGHT corner so the sky appears
                to "rotate" when advancing from step 4. Central channel
                (slider + sex pills) stays clear. */}

            {/* Deep nebula — TWO crossed rotated ellipses, mirror of the
                low-left pair. First (rotate +20) at cx78%/cy80%; second
                (rotate -35) opened OUT to cx86%/cy86% so the wisp fans
                diagonally into the RIGHT corner. Both share wbf-nebula. */}
            <G transform={[{ translateX: 281 }, { translateY: 608 }, { rotate: '20deg' }, { translateX: -281 }, { translateY: -608 }]}>
              <Ellipse cx="78%" cy="80%" rx="74%" ry="38%" fill="url(#wbf-nebula)" />
            </G>
            <G transform={[{ translateX: 281 }, { translateY: 608 }, { rotate: '-35deg' }, { translateX: -281 }, { translateY: -608 }]}>
              <Ellipse cx="86%" cy="86%" rx="50%" ry="48%" fill="url(#wbf-nebula)" />
            </G>

            {/* Field bloom — mirror of low-left's cx34% → cx66%, same
                cy86% / r46%, pooling as a painterly diagonal wisp in the
                inf-right corner. Clear of the central channel. Breathing
                on the same fieldProps worklet. */}
            <AnimatedCircle
              cx="66%"
              cy="86%"
              r="46%"
              fill="url(#wbf-field)"
              animatedProps={fieldProps}
            />

            {/* Volumetric haze — THREE floor-hugging bands. cx50% is
                symmetric under the mirror, so these are byte-for-byte the
                low-left bands (cy 80 / 88 / 94%, opac 0.05 / 0.035 / 0.025). */}
            <Ellipse cx="50%" cy="80%" rx="100%" ry="8%" fill="url(#wbf-fog)" opacity={0.05} />
            <Ellipse cx="50%" cy="88%" rx="95%" ry="11%" fill="url(#wbf-fog)" opacity={0.035} />
            <Ellipse cx="50%" cy="94%" rx="90%" ry="13%" fill="url(#wbf-fog)" opacity={0.025} />

            {/* White-hot core — far ember mirrored to the bottom-RIGHT
                rincón (cx 84% / cy 92% / r 14%). Breathes on core worklet. */}
            <AnimatedCircle
              cx="84%"
              cy="92%"
              r="14%"
              fill="url(#wbf-core)"
              animatedProps={coreProps}
            />
          </>
        ) : (
          <>
            {/* Deep nebula — pushed down-right, off-centre. */}
            <Ellipse cx="62%" cy="74%" rx="80%" ry="46%" fill="url(#wbf-nebula)" />

            {/* Field bloom — centred under the trio (cy 66%), breathing. */}
            <AnimatedCircle
              cx="50%"
              cy="66%"
              r="62%"
              fill="url(#wbf-field)"
              animatedProps={fieldProps}
            />

            {/* Off-frame sceneCore — the warm pool under the orbs (cy 70%). */}
            <AnimatedCircle
              cx="50%"
              cy="70%"
              r="34%"
              fill="url(#wbf-core)"
              animatedProps={coreProps}
            />

            {/* Low volumetric fog near the floor. */}
            <Ellipse cx="50%" cy="82%" rx="86%" ry="14%" fill="url(#wbf-fog)" />
          </>
        )}
      </Svg>
    </View>
  )
}

/*
 * Cosmic dust mote — suspended light rising bottom→top with sway, used
 * by both onboarding steps. The rising kinematics (position + fade
 * curve) are computed ONCE in a derived value; the soft halo and the
 * inner core only differ in their final opacity factor, so two
 * AnimatedCircles share one worklet of math (×N motes → N worklets).
 *
 * `stage` is the canvas height the mote travels (defaults to a 320
 * square = step 1). `clock` is a shared 0→1 ramp (the step's dust
 * clock); the mote derives its own phase from it.
 */
export function DustMote({
  x,
  baseR,
  period,
  sway,
  opacity,
  phase,
  clock,
  stage = 320,
  fill = '#F8DBCE',
}: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
  clock: SharedValue<number>
  stage?: number
  fill?: string
}) {
  const baseX = x * stage
  const motion = useDerivedValue(() => {
    'worklet'
    const u = (clock.value / period + phase) % 1
    const y = stage + 10 - u * (stage + 20)
    const cx = baseX + Math.sin(u * Math.PI * 2) * sway
    let op = opacity
    if (u < 0.12) op *= u / 0.12
    else if (u > 0.88) op *= 1 - (u - 0.88) / 0.12
    return { cx, cy: y, op }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.cx, cy: motion.value.cy, opacity: motion.value.op * 0.3 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.cx, cy: motion.value.cy, opacity: motion.value.op }
  })
  return (
    <>
      <AnimatedCircle cx={baseX} cy={stage} r={baseR * 3} fill={fill} animatedProps={haloProps} />
      <AnimatedCircle cx={baseX} cy={stage} r={baseR} fill={fill} animatedProps={coreProps} />
    </>
  )
}

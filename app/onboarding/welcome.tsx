import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import NorthStar from '@/assets/icons/north-star.svg'
import { PrimaryCta } from '@/components/PrimaryCta'
import {
  AtmosphericSky,
  DustMote,
  ProgressBar,
  WizardBackdrop,
} from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedG = Animated.createAnimatedComponent(G)

/*
 * Step 1 — Manifesto. Hero is the `north-star` glyph from the design
 * system. After a SECOND illustrator audit ("se ve plana, no parece
 * Genshin") the depth was rebuilt around three ideas the flat version
 * lacked: (1) atmosphere fills the WHOLE screen, not a 320px island;
 * (2) light sources are OFF-CENTRE so the scene reads as 3D space, not
 * a coaxial "diana"; (3) a COOL stratum (índigo/silver-blue) recedes
 * behind the warm core, creating aerial perspective. We keep ~60-70%
 * negative space; every alpha is whisper-low. Dark only — every layer
 * terminates in bg (#0A0608) at opacity 0, never cold black.
 *
 * AtmosphericSky + DustMote now live in features/onboarding/components
 * so step 2 (que-hace) breathes with the same sky. This step mounts
 * AtmosphericSky with its DEFAULT glow (38%/42%/65%) so it renders
 * exactly as before the extraction.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted
 * PER SCREEN (its own <WizardBackdrop />, opaque colors.bg base) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts.
 * AtmosphericSky still layers above the backdrop.
 *
 * Z-stack back-to-front:
 *
 *   FULL-SCREEN SKY (AtmosphericSky, absoluteFill, behind the hero):
 *     S0. Cool edge wash — diagonal índigo→silver, recedes (aerial
 *         perspective). The cold stratum the old scene was missing.
 *     S1. Vertical density gradient — lightens the ceiling, sinks the
 *         floor into bg, so the canvas has up/down weight.
 *     S2. Off-centre warm glow — radial at 38%/42% (NOT 50/50): the
 *         "sun outside the frame" that advances toward the viewer.
 *
 *   HERO SVG (320px stage, centred on the icon):
 *     0. Nebula — pushed far down-right + enlarged: abstract elliptical
 *        mass (no figure), the deepest atmosphere.
 *     1. Far stars — COOL (silver-blue), near-invisible: lo lejano es
 *        frío. Slow 2px parallax drift. Each carries a soft halo.
 *     2. heroGlow — large magenta RadialGradient, OFF-CENTRE (42%/44%),
 *        bleeding past the viewBox, breathing on t. The light body.
 *     3. heroCore — warm core bloom that burns to WHITE at centre
 *        (color-dodge ignition), CENTRED exactly = the icon anchor.
 *        The off-centre glow vs centred core is what makes depth.
 *     4. Mid stars — intermediate tint, middle depth, 5px drift.
 *     5. Cosmic dust × 5 — suspended light (halo falloff, not solid
 *        dots) rising bottom→top with sway.
 *     6. Micro stars — nearest field, warm, 9px drift + group twinkle,
 *        each with a 2.5× halo so they glow rather than sit drawn.
 *     7. Lens-flare — ONE soft horizontal streak faked as 3 concentric
 *        ellipses (fake gaussian: rx grows, opacity decays) — no hard
 *        vector edges, no second tilted twin (read as a cross).
 *     8. Vignette — directional: denser bottom-right, lighter top-left,
 *        matching the light that now originates upper-left.
 *     [end Svg]
 *     9. NorthStar icon — breathing scale (1.0 → 1.03 over 6 s).
 *    10. White-hot pinpoint — dead-centre ignition spark, 4 s pulse.
 *
 * Shared clocks (unchanged set — no new shared values introduced):
 *   t      6 s  breath / glow / core / flare / icon
 *   pulse  4 s  white-hot pinpoint
 *   orbit 40 s  starfield parallax (god-rays removed; orbit still
 *               drives the three star strata's differential drift)
 *   dust  18 s  dust drift
 * Removed in this pass: the 6 rotating god-rays and the radar pulse
 * ring (both delators of "sun-icon / radar / diana") and their
 * GOD_RAYS const, godRaysProps + radar animatedProps.
 */

const STAGE = 320
const STAGE_CX = STAGE / 2
const STAGE_CY = STAGE / 2
const ICON_W = 260
const ICON_H = 260

// Perimeter micro-stars (twinkle as a group via 1 worklet). Nearest
// field — warmest tint, largest parallax drift, gets a halo so they
// read as points of light.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.18, r: 1.4, opacity: 0.5 },
  { x: 0.86, y: 0.24, r: 1.1, opacity: 0.4 },
  { x: 0.92, y: 0.74, r: 1.6, opacity: 0.6 },
  { x: 0.08, y: 0.82, r: 1.2, opacity: 0.45 },
  { x: 0.5, y: 0.06, r: 0.9, opacity: 0.35 },
  { x: 0.18, y: 0.5, r: 1.0, opacity: 0.38 },
  { x: 0.82, y: 0.52, r: 1.0, opacity: 0.38 },
  { x: 0.34, y: 0.92, r: 0.9, opacity: 0.32 },
  { x: 0.7, y: 0.88, r: 1.2, opacity: 0.42 },
]

// Mid-depth stars — middle stratum. Intermediate tint (#E8D9DD),
// medium parallax drift. Irregular scatter, no grid.
const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.22, y: 0.28, r: 0.8, opacity: 0.26 },
  { x: 0.74, y: 0.16, r: 0.7, opacity: 0.24 },
  { x: 0.9, y: 0.46, r: 0.9, opacity: 0.3 },
  { x: 0.66, y: 0.7, r: 0.8, opacity: 0.27 },
  { x: 0.38, y: 0.64, r: 0.7, opacity: 0.23 },
  { x: 0.14, y: 0.4, r: 0.9, opacity: 0.28 },
  { x: 0.48, y: 0.84, r: 0.7, opacity: 0.22 },
  { x: 0.28, y: 0.1, r: 0.8, opacity: 0.25 },
  { x: 0.84, y: 0.86, r: 0.9, opacity: 0.29 },
  { x: 0.56, y: 0.36, r: 0.7, opacity: 0.24 },
]

// Far background stars — COOL silver-blue (dimension.ciclo) and very
// dim: the farthest things are cold and almost invisible, which is
// what gives aerial perspective. Slow 2px parallax.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.04, y: 0.32, r: 0.6, opacity: 0.12 },
  { x: 0.96, y: 0.4, r: 0.7, opacity: 0.14 },
  { x: 0.6, y: 0.98, r: 0.5, opacity: 0.1 },
  { x: 0.42, y: 0.04, r: 0.6, opacity: 0.12 },
  { x: 0.96, y: 0.92, r: 0.5, opacity: 0.09 },
  { x: 0.02, y: 0.62, r: 0.5, opacity: 0.09 },
  { x: 0.32, y: 0.46, r: 0.5, opacity: 0.08 },
  { x: 0.78, y: 0.62, r: 0.6, opacity: 0.11 },
  { x: 0.5, y: 0.72, r: 0.5, opacity: 0.08 },
  { x: 0.24, y: 0.78, r: 0.6, opacity: 0.1 },
]

// 5 dust motes. Each carries its own period + sway + phase so the
// field reads as floating pollen, not a stamped pattern. Two motes are
// smaller / fainter (background depth) and ride the same drift clock.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.3, baseR: 1.2, period: 1.0, sway: 10, opacity: 0.55, phase: 0 },
  { x: 0.55, baseR: 0.9, period: 0.9, sway: 14, opacity: 0.45, phase: 0.33 },
  { x: 0.75, baseR: 1.4, period: 1.1, sway: 8, opacity: 0.6, phase: 0.66 },
  { x: 0.42, baseR: 0.6, period: 1.25, sway: 16, opacity: 0.28, phase: 0.18 },
  { x: 0.68, baseR: 0.7, period: 1.15, sway: 12, opacity: 0.3, phase: 0.5 },
]

function ManifestoHero() {
  // 6 s breath / glow / core / flare / icon clock.
  const t = useSharedValue(0)
  // 4 s slower core pulse, decoupled so it doesn't lock with t.
  const pulse = useSharedValue(0)
  // 40 s slow rotation — now drives ONLY the starfield parallax
  // (god-rays removed). Kept: the three strata still derive their
  // differential drift from it.
  const orbit = useSharedValue(0)
  // 18 s dust drift base — each mote derives its own phase from this.
  const dust = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false)
    pulse.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(pulse)
      cancelAnimation(orbit)
      cancelAnimation(dust)
    }
  }, [t, pulse, orbit, dust])

  // Starfield parallax — each stratum drifts on a tiny Lissajous curve
  // derived from `orbit` (no new clock). Amplitude grows toward the
  // viewer: far 2px, mid 5px, micro 9px — depth via differential motion.
  const farDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 2} ${Math.cos(u) * 2})` }
  })
  const midDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 5} ${Math.cos(u) * 5})` }
  })

  // Micro-star group: parallax drift (9px) combined with the group
  // twinkle. Opacity scintillates 3× per 6 s cycle; keeps the nearest
  // perimeter alive without per-star worklets.
  const microGroupProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(t.value * 2 * Math.PI * 3)
    return {
      transform: `translate(${Math.sin(u) * 9} ${Math.cos(u) * 9})`,
      opacity: flicker,
    }
  })

  // Hero glow — large OFF-CENTRE magenta RadialGradient with real
  // falloff to zero (centre lives in the gradient def at 42%/44%, so
  // the light body is decoupled from the dead-centre icon → depth).
  // Breathes on t; radius bleeds well past the viewBox edge.
  const glowProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { r: 152 + w * 18, opacity: 0.85 + w * 0.15 }
  })

  // Warm core bloom — burns to white at the centre (color-dodge
  // ignition) → magentaHot → 0. Stays dead-centre: the contrast of a
  // centred core against the off-centre glow is what reads as 3D.
  const coreBloomProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { opacity: 0.8 + w * 0.2 }
  })

  // Lens-flare — single soft horizontal streak, faked as three
  // concentric ellipses (rx grows, opacity decays) so there is no hard
  // vector edge and no second tilted twin (which read as a cross).
  // One worklet drives all three via a shared inhale `w`.
  const flareInnerProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { rx: 70 + w * 10, opacity: 0.16 + w * 0.08 }
  })
  const flareMidProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { rx: 100 + w * 12, opacity: 0.08 + w * 0.04 }
  })
  const flareOuterProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { rx: 132 + w * 14, opacity: 0.03 + w * 0.02 }
  })

  // Icon breath — slow scale 1.0 → 1.03 over 6 s.
  const iconStyle = useAnimatedStyle(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { transform: [{ scale: 1 + w * 0.03 }] }
  })

  // White-hot core pinpoint — pulse on the 4 s clock.
  const coreStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: 0.6 + pulse.value * 0.4,
      transform: [{ scale: 0.85 + pulse.value * 0.35 }],
    }
  })

  return (
    // Decorative atmospheric field — hidden from the screen reader so the
    // VO reading order is eyebrow → titular → coach → meta → CTA, never
    // landing on the (purely visual) hero.
    <Animated.View
      entering={FadeIn.duration(800)}
      style={styles.hero}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Atmospheric backdrop — single Svg holds the layered field
          so z-order is implicit and we don't grow a canvas per layer. */}
      <Svg
        width={STAGE}
        height={STAGE}
        viewBox={`0 0 ${STAGE} ${STAGE}`}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* Off-centre nebula wash — the deepest atmosphere. */}
          <RadialGradient id="nebula" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#A6164A" stopOpacity="0.07" />
            <Stop offset="0.6" stopColor="#A6164A" stopOpacity="0.03" />
            <Stop offset="1" stopColor="#A6164A" stopOpacity="0" />
          </RadialGradient>
          {/* Hero glow — magenta light body, OFF-CENTRE (42%/44%),
              falloff to zero. Decoupled from the centred icon.
              The gradient centre is off-centre but the Circle it fills is
              centred, so the circle's NEAR edge (toward the gradient centre)
              sits at ~offset 0.8 of the gradient. The opacity MUST reach 0
              before that (here by 0.72) or the circle geometry cuts off a
              still-visible ~0.02 band → a hard circular seam against the bg.
              Reaching 0 by 0.72 keeps every edge of the circle transparent,
              so the glow blends seamlessly (offsets 0.72→1 pad to 0). */}
          <RadialGradient id="heroGlow" cx="42%" cy="44%" r="50%">
            <Stop offset="0" stopColor="#E91E63" stopOpacity="0.42" />
            <Stop offset="0.32" stopColor="#E91E63" stopOpacity="0.20" />
            <Stop offset="0.6" stopColor="#A6164A" stopOpacity="0.06" />
            <Stop offset="0.72" stopColor="#A6164A" stopOpacity="0" />
          </RadialGradient>
          {/* Warm core bloom — burns to WHITE at centre (color-dodge
              ignition) → leche → magentaHot → transparent. Centred. */}
          <RadialGradient id="heroCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="0.18" stopColor="#FBD7E3" stopOpacity="0.7" />
            <Stop offset="0.4" stopColor="#FF4886" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#FF4886" stopOpacity="0" />
          </RadialGradient>
          {/* Star halo — a tight white falloff that lets each near star
              glow rather than read as a flat drawn dot. */}
          <RadialGradient id="starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Vignette — directional: lighter top-left, denser
              bottom-right, matching the upper-left light source. Radius
              widened (62%→72%) and the final stop softened (0.6→0.45)
              so the falloff bleeds out instead of reading as a hard
              circular ring / "diana". */}
          <RadialGradient id="vignette" cx="38%" cy="36%" r="72%">
            <Stop offset="0.5" stopColor="#0A0608" stopOpacity="0" />
            <Stop offset="1" stopColor="#0A0608" stopOpacity="0.45" />
          </RadialGradient>
        </Defs>

        {/* 0. Nebula — pushed far down-right + enlarged: abstract
            elliptical mass (no figure), the deepest atmosphere. */}
        <Ellipse cx={STAGE_CX * 0.65} cy={STAGE_CY * 1.35} rx={260} ry={200} fill="url(#nebula)" />

        {/* 1. Far cool stars — deep depth of field, halo + slow 2px drift. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * STAGE}
                cy={s.y * STAGE}
                r={s.r * 2.2}
                fill="url(#starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * STAGE}
                cy={s.y * STAGE}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* 2. Hero glow — off-centre radial falloff, breathing. */}
        <AnimatedCircle
          cx={STAGE_CX}
          cy={STAGE_CY}
          fill="url(#heroGlow)"
          animatedProps={glowProps}
        />

        {/* 3. Warm core bloom — centred ignition, white-hot core. */}
        <AnimatedCircle
          cx={STAGE_CX}
          cy={STAGE_CY}
          r={64}
          fill="url(#heroCore)"
          animatedProps={coreBloomProps}
        />

        {/* 4. Mid stars — middle depth, intermediate tint, 5px drift. */}
        <AnimatedG animatedProps={midDriftProps}>
          {MID_STARS.map((s, i) => (
            <Circle
              key={`mid-${i}`}
              cx={s.x * STAGE}
              cy={s.y * STAGE}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* 5. Cosmic dust motes — suspended light, rising (rides dust drift). */}
        {DUST.map((d, i) => (
          <DustMote key={`dust-${i}`} {...d} clock={dust} stage={STAGE} />
        ))}

        {/* 6. Perimeter micro-stars — nearest field, warm, halo + 9px
            parallax + twinkle. Halo first so the point sits on a glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`m-${i}`}>
              <Circle
                cx={s.x * STAGE}
                cy={s.y * STAGE}
                r={s.r * 2.5}
                fill="url(#starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * STAGE}
                cy={s.y * STAGE}
                r={s.r}
                fill="#FBD7E3"
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* 7. Anamorphic lens-flare — single soft horizontal streak,
            three concentric ellipses (fake gaussian: rx grows, opacity
            decays). No hard edge, no tilted twin. */}
        <AnimatedEllipse
          cx={STAGE_CX}
          cy={STAGE_CY}
          rx={132}
          ry={9}
          fill="#FFE9D6"
          animatedProps={flareOuterProps}
        />
        <AnimatedEllipse
          cx={STAGE_CX}
          cy={STAGE_CY}
          rx={100}
          ry={6}
          fill="#FFE9D6"
          animatedProps={flareMidProps}
        />
        <AnimatedEllipse
          cx={STAGE_CX}
          cy={STAGE_CY}
          rx={70}
          ry={3.5}
          fill="#FFE9D6"
          animatedProps={flareInnerProps}
        />

        {/* 8. Vignette — directional, denser bottom-right. */}
        <Circle cx={STAGE_CX} cy={STAGE_CY} r={STAGE_CX} fill="url(#vignette)" />
      </Svg>

      {/* 9. The hero icon — breathing cream north star, tinted via
          currentColor (react-native-svg maps `color` → currentColor). */}
      <Animated.View style={iconStyle}>
        <NorthStar
          width={ICON_W}
          height={ICON_H}
          color={colors.leche}
          preserveAspectRatio="xMidYMid meet"
        />
      </Animated.View>

      {/* 10. White-hot pinpoint dead-centre — the ignition spark. */}
      <Animated.View style={[styles.coreWrap, coreStyle]} pointerEvents="none">
        <View style={styles.core} />
      </Animated.View>
    </Animated.View>
  )
}

export default function ManifiestoScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* The base cosmic backdrop is mounted PER SCREEN (opaque colors.bg
          base + starfield + breathing presence) so the slide transition
          fully occludes the screen behind it. The presence breath is
          shared via WizardPresenceContext so it never restarts. The
          full-screen atmosphere below sits above this backdrop but behind
          all content. Default glow (38%/42%/65%) = unchanged. */}
      <WizardBackdrop />
      <AtmosphericSky />
      <View style={styles.progressWrap}>
        <ProgressBar current={1} total={9} />
      </View>

      <View style={styles.stage}>
        <Text style={styles.eyebrow}>Stelar · tu manifiesto</Text>
        <Text style={styles.quote}>La perfección{'\n'}no es necesaria.</Text>
        <Text style={styles.quoteEmphasis}>La dirección sí.</Text>

        <View style={styles.heroWrap}>
          <ManifestoHero />
        </View>

        <Text style={styles.meta}>
          Stelar observa contigo, sin presión.{'\n'}
          Desde hoy. <Text style={styles.metaStrong}>En 28 días</Text>, tu propio ritmo.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryCta
          label="Empecemos"
          variant="soft"
          transform="none"
          onPress={() => router.push('/onboarding/que-hace')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // OPAQUE so the incoming screen occludes the outgoing one during the
  // slide; the per-screen WizardBackdrop paints the sky on top of this.
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  stage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    // CAMBIO 4 — single reading axis: everything in the stage is
    // centred, so the eye no longer jumps left (block) → centre (meta).
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.magenta,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  quote: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    lineHeight: 40,
    color: colors.leche,
    letterSpacing: -1.6,
    textAlign: 'center',
  },
  quoteEmphasis: {
    marginTop: 6,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    lineHeight: 40,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // CAMBIO 5 — stable vertical rhythm: the hero no longer relies only
  // on flex:1 (which over-compressed it on an SE/mini and left dead
  // air on a Pro Max). It keeps flex:1 to absorb spare space but is
  // bounded by a minHeight (so the SE never crushes it / the CTA stays
  // on-screen) and a maxHeight (so the Pro Max air doesn't feel
  // indifferent). marginTop 18→30 separates the coach line from the
  // atmospheric field; marginBottom adds explicit hero→meta breathing.
  heroWrap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 24,
    minHeight: 240,
    maxHeight: STAGE,
  },
  hero: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreWrap: {
    position: 'absolute',
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFB8D4',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
  },
  // CAMBIO 3 — accessibility: the meta is the promise, so it must read.
  // Bumped 13→15 (typography.sizes.ui, ≥14pt min), lineHeight 20→22,
  // and the body colour lifted bone→leche for legibility. The "En 28
  // días" emphasis stays leche/serif as before.
  meta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.leche,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  metaStrong: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.leche,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
})

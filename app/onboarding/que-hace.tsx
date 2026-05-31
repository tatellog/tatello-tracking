import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  G,
  Image as SvgImage,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
  TSpan,
} from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import {
  AtmosphericSky,
  DustMote,
  ProgressBar,
  WarmBloomField,
  WizardBackdrop,
} from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

/*
 * Step 2 — what Stelar does. Where step 1 (welcome) is ONE body of
 * light (the polar star), step 2 is THREE bodies inside the SAME sky.
 * Same atmosphere (shared AtmosphericSky), its own composition (a
 * constellation of three) → sibling identity.
 *
 * "Tres orbes pintados" (illustrator round 4): the inline-primitive
 * miniatures (a six-petalled bloom, a comet ring, a void+veil) read
 * FLAT after three rounds — they were vector diagrams, not bodies. They
 * are now redrawn as the REAL Órbita artwork: the painted PNGs the live
 * product already ships (day-orb / orbit-week / orbit-month-bh), each
 * mounted inside the Svg via <Image href> and crowned with two thin
 * SVG overlays (a breathing ring + one orbiting dust particle) so the
 * painted orb is alive rather than a pasted thumbnail.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER
 * SCREEN (its own <WizardBackdrop />, opaque colors.bg base) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts.
 * AtmosphericSky + WarmBloomField layer above the backdrop.
 *
 * ATMOSPHERE LIVES FULL-SCREEN (clip fix): the deep WARM apparatus (a
 * breathing field bloom, an off-frame sceneCore "sun", the nebula and a
 * low fog) used to be drawn INSIDE this scene's bounded <Svg viewBox
 * 320×236>. That Svg renders entire + centred within the screen
 * (preserveAspectRatio meet) — it does NOT bleed past the screen edges
 * the way welcome's square hero does — so the Svg viewport clipped those
 * still-luminous washes in a straight line on ALL FOUR sides (the hard
 * rectangle, worst on the right + floor). A previous floor-fade only
 * hid the bottom edge. The fix moves the entire warm apparatus to a
 * FULL-SCREEN layer (WarmBloomField, absoluteFill, no bounded viewBox)
 * that resolves to transparent before any screen edge → no rectangle,
 * any side. This mirrors how welcome delegates its big atmosphere to
 * AtmosphericSky. The bounded scene Svg now holds ONLY elements that
 * never reach the edges with luminance: star strata, the arc, the three
 * orbs, flowing particles, labels and a soft vignette.
 *
 * SEMANTIC PARITY (uxui round 2): the three lenses are EQUIVALENT views
 * of the same data, never hierarchical — and DÍA is the product home,
 * so it must not be demoted. Therefore:
 *   - All three orbs share the SAME apparent size (ORB), the SAME warm
 *     body halo (#qh-bodyHalo) and render at FULL opacity — no lens is
 *     bigger, warmer or brighter.
 *   - Depth is carried ONLY by composition + motion: (a) the vertical
 *     Y offset (centre sits lower = the arc's comba), (b) a differential
 *     parallax drift (centre vs sides), (c) the shared field bloom they
 *     sit in.
 *
 * Each orb carries a label + a 2–3 word preview, drawn INSIDE the Svg
 * (viewBox space) so they scale with the bodies and never desalign on a
 * small screen (SE/mini). The preview copy is NEW and must be reviewed
 * by voice-and-copy (see LENSES below).
 *
 * Shared clocks — SAME periods as step 1 so both steps breathe on the
 * same compás. Now hoisted to the screen so WarmBloomField and the
 * scene share ONE clock set (no duplicated shared values):
 *   clock  5 s  the orbs' breath (halo bloom, ring) + warm-field breath
 *   dust  18 s  cosmic-dust drift (same as welcome)
 *   orbit 40 s  star-strata + arc + body parallax + orbiting particle
 *
 * Dark only — every layer terminates in bg (#0A0608) at opacity 0,
 * never cold black. No human figure — the PNGs are abstract galaxies /
 * a black hole.
 */

// The painted Órbita artwork — the SAME PNGs the live product ships.
const DIA_ART = require('@/assets/orbits-art/day-orb.png')
const SEM_ART = require('@/assets/orbits-art/orbit-week-art.png')
const MES_ART = require('@/assets/orbits-art/orbit-month-bh.png')

// Scene canvas. The labels live INSIDE the viewBox so they scale with
// the scene and never desalign on narrow screens.
const VB_W = 320
const VB_H = 236

// All three orbs are the SAME apparent size — equivalent lenses.
const ORB = 112

// Nuclei in viewBox space (320 × 236). Centre sits LOWER than the sides
// so the trio is an asymmetric constellation, not a row — and the
// celestial arc combes gently down through it.
const NUC_DIA = { x: 64, y: 96 }
const NUC_SEM = { x: 160, y: 112 }
const NUC_MES = { x: 256, y: 96 }

// Lens labels + previews. Data-driven and module-level so the copy is
// trivial to swap. The `preview` strings are NEW copy → flag for
// voice-and-copy review. Sentence case on previews by design.
const LENSES: {
  key: 'dia' | 'semana' | 'mes'
  art: number
  label: string
  preview: string
  nuc: { x: number; y: number }
}[] = [
  { key: 'dia', art: DIA_ART, label: 'DÍA', preview: 'Tu día', nuc: NUC_DIA },
  { key: 'semana', art: SEM_ART, label: 'SEMANA', preview: 'Tu ritmo', nuc: NUC_SEM },
  { key: 'mes', art: MES_ART, label: 'MES', preview: 'Tu cielo', nuc: NUC_MES },
]

// Label typography in viewBox units (kept here so the in-Svg text and
// the styles stay in one place). Sizes are viewBox px ≈ screen px at the
// reference width; they scale with the Svg on smaller devices.
const LABEL_FONT = 11
const PREVIEW_FONT = 9
const LABEL_DY = ORB / 2 + 10 // first text baseline below the nucleus
const PREVIEW_DY = 11 // preview baseline below the label

// Celestial arc — a single quadratic Bézier from DÍA to MES whose
// control point is placed so the curve's midpoint (t=0.5) lands on
// SEMANA's nucleus, giving a gentle downward comba through all three.
// midpoint = 0.25·P0 + 0.5·C + 0.25·P2  ⟹  C = 2·(mid) − 0.5·(P0+P2)
const ARC_P0 = NUC_DIA
const ARC_P2 = NUC_MES
const ARC_C = {
  x: 2 * NUC_SEM.x - 0.5 * (ARC_P0.x + ARC_P2.x),
  y: 2 * NUC_SEM.y - 0.5 * (ARC_P0.y + ARC_P2.y),
}
const ARC_PATH = `M ${ARC_P0.x} ${ARC_P0.y} Q ${ARC_C.x} ${ARC_C.y} ${ARC_P2.x} ${ARC_P2.y}`

// ── Star strata (cloned from welcome) ─────────────────────────────
// Three depth layers. x/y are 0→1 fractions of the canvas; amplitude
// of parallax drift grows toward the viewer (far 2px, mid 5px, micro
// 9px). Module-level so they are never recreated per render.

// Far COOL stars — the cold distant stratum (silver-blue): lo lejano es
// frío. Slow 2px parallax. Background depth only — NOT one of the lenses.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.09, y: 0.14, r: 0.6, opacity: 0.1 },
  { x: 0.94, y: 0.1, r: 0.7, opacity: 0.12 },
  { x: 0.34, y: 0.07, r: 0.5, opacity: 0.08 },
  { x: 0.72, y: 0.17, r: 0.6, opacity: 0.1 },
  { x: 0.5, y: 0.04, r: 0.5, opacity: 0.08 },
  { x: 0.2, y: 0.74, r: 0.5, opacity: 0.09 },
]

// Mid-depth stars — intermediate tint (#E8D9DD), medium 5px parallax.
const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.18, y: 0.3, r: 0.8, opacity: 0.26 },
  { x: 0.82, y: 0.22, r: 0.7, opacity: 0.24 },
  { x: 0.9, y: 0.5, r: 0.9, opacity: 0.3 },
  { x: 0.46, y: 0.16, r: 0.7, opacity: 0.23 },
  { x: 0.12, y: 0.52, r: 0.8, opacity: 0.28 },
  { x: 0.6, y: 0.08, r: 0.7, opacity: 0.22 },
  { x: 0.3, y: 0.62, r: 0.7, opacity: 0.24 },
  { x: 0.7, y: 0.66, r: 0.8, opacity: 0.25 },
]

// Nearest field — warm micro stars (#FBD7E3), 9px parallax + group
// twinkle, each with a 2.5× halo so they glow rather than sit drawn.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.2, r: 1.2, opacity: 0.5 },
  { x: 0.88, y: 0.34, r: 1.0, opacity: 0.4 },
  { x: 0.5, y: 0.12, r: 0.9, opacity: 0.35 },
  { x: 0.16, y: 0.66, r: 1.1, opacity: 0.42 },
  { x: 0.78, y: 0.78, r: 1.0, opacity: 0.38 },
  { x: 0.4, y: 0.7, r: 0.9, opacity: 0.32 },
]

// Cosmic dust rising through the upper dead zone (same physics as
// welcome's DustMote; x is a 0→1 fraction of the canvas WIDTH here).
// 5 motes — two smaller/fainter ones sit in the background depth.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.2, baseR: 0.9, period: 1.05, sway: 10, opacity: 0.42, phase: 0.1 },
  { x: 0.5, baseR: 1.1, period: 0.95, sway: 12, opacity: 0.5, phase: 0.55 },
  { x: 0.78, baseR: 0.8, period: 1.15, sway: 9, opacity: 0.38, phase: 0.3 },
  { x: 0.36, baseR: 0.55, period: 1.25, sway: 14, opacity: 0.24, phase: 0.7 },
  { x: 0.64, baseR: 0.6, period: 1.12, sway: 11, opacity: 0.26, phase: 0.42 },
]

// Particle phases — deliberately NOT equispaced so the pair never reads
// as a moving train.
const PARTICLE_PHASES = [0, 0.55]

// Scene height bounds (inherited from welcome's heroWrap discipline):
// minHeight stops the SE/mini from crushing the scene & pushing the CTA
// off-screen; maxHeight stops a Pro Max from leaving indifferent air.
const SCENE_MIN_H = 236
const SCENE_MAX_H = 256

// Combined VoiceOver label — the scene is decorative for VO (all the
// visual depth is non-semantic), but the three lenses ARE information,
// so we expose them once, in reading order, on the wrapper.
const SCENE_A11Y_LABEL = 'Tres vistas de tu progreso: Día, Semana y Mes.'

export default function QueHaceScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // Shared clocks for the whole step — hoisted here so the full-screen
  // WarmBloomField and the bounded scene Svg breathe on the SAME values
  // (no duplicated shared values, no drift between the warm field and
  // the orbs that sit in it).
  //   clock 5 s  orb breath (halo / ring) + warm-field breath
  //   dust 18 s  cosmic-dust drift
  //   orbit 40 s star-strata + arc + body parallax + orbiting particle
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(clock)
      cancelAnimation(dust)
      cancelAnimation(orbit)
    }
  }, [clock, dust, orbit])

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* The base cosmic backdrop is mounted PER SCREEN (opaque colors.bg
          base + starfield + breathing presence) so the slide transition
          fully occludes the screen behind it. The presence breath is
          shared via WizardPresenceContext so it never restarts. Shared
          cool atmosphere below — same sky as step 1, glow lowered to where
          the three bodies live so the cool wash pools under them. */}
      <WizardBackdrop />
      <AtmosphericSky glow={{ cx: '50%', cy: '64%', r: '70%' }} />
      {/* Deep WARM atmosphere — full-screen so it NEVER clips to a
          rectangle. Breathes on the shared 5 s clock; its bloom centre
          sits low (cy ~66%) so the warm pool falls under the trio. */}
      <WarmBloomField clock={clock} />
      <View style={styles.progressWrap}>
        <ProgressBar current={2} total={9} />
      </View>

      <View style={styles.stage}>
        <Text style={styles.eyebrow}>Lo que Stelar hace</Text>

        <Text style={styles.title}>
          Sí, cuento calorías.{'\n'}
          <Text style={styles.titleEm}>Y también te veo.</Text>
        </Text>

        <Text style={styles.body}>
          Mido calorías, macros y peso. Pero también te ayudo a entender qué te cuesta sostener.
        </Text>

        <View style={styles.previewBlock}>
          <PreviewRow clock={clock} dust={dust} orbit={orbit} />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryCta
          label="Empezar"
          variant="soft"
          transform="none"
          onPress={() => router.push('/onboarding/tu-intencion')}
        />
      </View>
    </View>
  )
}

/*
 * The unified three-orb scene. One full-width Svg. The bounded scene now
 * holds ONLY edge-safe elements (star strata, arc, the three orbs,
 * flowing particles, labels, vignette) — the big warm washes moved to
 * the full-screen WarmBloomField behind it to kill the rectangular clip.
 * All three clocks are passed in from the screen so the scene and the
 * warm field stay on one compás.
 */
function PreviewRow({
  clock,
  dust,
  orbit,
}: {
  clock: SharedValue<number>
  dust: SharedValue<number>
  orbit: SharedValue<number>
}) {
  // ── Star-strata parallax (cloned from welcome) ──────────────────
  // Each stratum drifts on a tiny Lissajous curve derived from `orbit`
  // (no new clock). Amplitude grows toward the viewer = depth via
  // differential motion. The arc rides the far drift so the deep field
  // + arc breathe together.
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
  // Micro-star group: 9px parallax + group twinkle (scintillates 3× per
  // 40 s cycle via a faster sine on `orbit`).
  const microGroupProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(orbit.value * 2 * Math.PI * 3)
    return { transform: `translate(${Math.sin(u) * 9} ${Math.cos(u) * 9})`, opacity: flicker }
  })

  // Differential BODY parallax — the depth that size/temperature no
  // longer carry lives here. Sides and centre ride the SAME slow
  // `orbit` clock but with DIFFERENT amplitude + counter-phase, so the
  // trio subtly shears in depth (sides float a little more, opposite to
  // the centre). No importance is implied — same motion welcome uses
  // for its star strata.
  const sideDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 3.4} ${Math.cos(u) * 2.2})` }
  })
  const centreDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * -1.8} ${Math.cos(u) * -1.2})` }
  })

  return (
    <View
      style={styles.sceneWrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={SCENE_A11Y_LABEL}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Star halo — tight white falloff so near stars glow. */}
          <RadialGradient id="qh-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Shared WARM body halo — used identically by all three orbs
              so none is warmer than the others. */}
          <RadialGradient id="qh-bodyHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magentaHot} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={colors.magentaHot} stopOpacity={0} />
          </RadialGradient>
          {/* Shared luminous core — white→pink→magenta radial. Used by
              the orbs' breathing ring stroke. */}
          <RadialGradient id="qh-core" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="55%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
        </Defs>

        {/* 1. Cosmic dust rising through the upper dead zone. */}
        {DUST.map((d, i) => (
          <DustMote key={`dust-${i}`} {...d} clock={dust} stage={VB_H} fill="#F8DBCE" />
        ))}

        {/* 2. Far COOL stars + arc — the cold distant stratum (silver-
            blue) on a slow 2px parallax. Background depth only. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * VB_W}
                cy={s.y * VB_H}
                r={s.r * 2.4}
                fill="url(#qh-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * VB_W}
                cy={s.y * VB_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}

          {/* Celestial arc — one faint Q-curve threading the three
              nuclei. */}
          <Path
            d={ARC_PATH}
            fill="none"
            stroke={colors.magenta}
            strokeOpacity={0.16}
            strokeWidth={0.8}
            strokeDasharray="1.5 10"
            strokeLinecap="round"
          />
        </AnimatedG>

        {/* 3. Mid stars — middle depth, intermediate tint, 5px drift. */}
        <AnimatedG animatedProps={midDriftProps}>
          {MID_STARS.map((s, i) => (
            <Circle
              key={`mid-${i}`}
              cx={s.x * VB_W}
              cy={s.y * VB_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* 4. Micro stars — nearest field, warm, halo + 9px parallax +
            group twinkle. Halo first so the point sits on a glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * VB_W}
                cy={s.y * VB_H}
                r={s.r * 2.5}
                fill="url(#qh-starGlow)"
                opacity={0.15}
              />
              <Circle cx={s.x * VB_W} cy={s.y * VB_H} r={s.r} fill="#FBD7E3" opacity={s.opacity} />
            </G>
          ))}
        </AnimatedG>

        {/* 5. The three painted orbs — equal size, equal halo, full
            opacity. Depth comes from the Y offset + differential
            parallax: sides ride `sideDriftProps`, centre rides the
            counter `centreDriftProps`. Drawn sides first so the centre
            overlaps on contact. */}
        <AnimatedG animatedProps={sideDriftProps}>
          <OrbBody
            art={DIA_ART}
            clock={clock}
            orbit={orbit}
            cx={NUC_DIA.x}
            cy={NUC_DIA.y}
            haloOpacity={1.0}
          />
          <OrbBody
            art={MES_ART}
            clock={clock}
            orbit={orbit}
            cx={NUC_MES.x}
            cy={NUC_MES.y}
            haloOpacity={1.15}
          />
        </AnimatedG>
        <AnimatedG animatedProps={centreDriftProps}>
          <OrbBody
            art={SEM_ART}
            clock={clock}
            orbit={orbit}
            cx={NUC_SEM.x}
            cy={NUC_SEM.y}
            haloOpacity={0.85}
          />
        </AnimatedG>

        {/* 6. Flowing particles — navigate the SAME arc curve, halo +
            core (dust vocabulary), dispar phases. */}
        {PARTICLE_PHASES.map((p, i) => (
          <FlowingParticle key={`p-${i}`} clock={clock} offset={p} />
        ))}

        {/* 7. Labels + previews — drawn INSIDE the viewBox so they
            scale with the orbs and never desalign on narrow screens.
            Each label rides the same parallax drift as its orb so text
            and body move together. */}
        <AnimatedG animatedProps={sideDriftProps}>
          {LENSES.filter((l) => l.key !== 'semana').map((l) => (
            <LensLabel key={l.key} lens={l} />
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={centreDriftProps}>
          <LensLabel lens={LENSES.find((l) => l.key === 'semana')!} />
        </AnimatedG>
      </Svg>
    </View>
  )
}

/* ── OrbBody — a painted Órbita orb, crowned with two thin overlays ──
 * The body is the REAL artwork PNG mounted in the Svg via <Image href>.
 * Over it we draw, back→front:
 *   · the shared warm halo (so the orb sits on light),
 *   · the painted PNG (static — no animation on the raster),
 *   · a finísimo breathing ring (clone of the old ringProps logic),
 *   · one OrbitingParticle that circles the orb (dust vocabulary).
 * Mounted three times (Día / Semana / Mes) — same ORB, same halo id,
 * full opacity → strict semantic parity.
 *
 * R2 — OPTICAL halo compensation (NOT hierarchy): the three painted PNGs
 * have different intrinsic brightness — MES (black hole) reads dim, SEMANA
 * (pink nucleus) reads hot. With an identical halo the eye does NOT see
 * them as equal. `haloOpacity` nudges the shared halo so the orbs reach
 * PERCEIVED parity: MES 1.15 (lift the dim one), SEMANA 0.85 (calm the hot
 * one), DÍA 1.0. Because SVG <Circle> opacity caps at 1, MES's >1 request
 * is realised as a slightly LARGER halo radius (ORB*0.42 → up to ORB*0.45)
 * rather than an out-of-range opacity; ≤1 values map straight to opacity. */
function OrbBody({
  art,
  clock,
  orbit,
  cx,
  cy,
  haloOpacity = 1,
}: {
  art: number
  clock: SharedValue<number>
  orbit: SharedValue<number>
  cx: number
  cy: number
  haloOpacity?: number
}) {
  // Finísimo ring that breathes on the 5 s clock (clone of the prior
  // MES ringProps): radius + opacity inhale/exhale gently.
  const ringR = ORB * 0.46
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: ringR + wave * 1.2, opacity: 0.3 + wave * 0.2 }
  })

  // R2 — resolve haloOpacity into concrete circle props. <Circle>
  // opacity can't exceed 1, so any >1 ask is converted into extra halo
  // radius (more light area) instead of clamped-away brightness; ≤1
  // values pass straight through as opacity.
  const haloR = haloOpacity > 1 ? ORB * 0.42 * (1 + (haloOpacity - 1) * 0.2) : ORB * 0.42
  const haloOp = Math.min(1, haloOpacity)

  return (
    <G>
      {/* Shared warm halo — same id for all three; only the optical
          compensation (radius / opacity) differs per R2. */}
      <Circle cx={cx} cy={cy} r={haloR} fill="url(#qh-bodyHalo)" opacity={haloOp} />

      {/* The painted orb — static raster. */}
      <SvgImage
        href={art}
        x={cx - ORB / 2}
        y={cy - ORB / 2}
        width={ORB}
        height={ORB}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Finísimo breathing ring over the orb — white→pink→magenta
          radial stroke (qh-core) so it reads as a luminous rim, not a
          flat magenta line. */}
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill="none"
        stroke="url(#qh-core)"
        strokeWidth={0.8}
        animatedProps={ringProps}
      />

      {/* One particle orbiting the orb — keeps each orb alive. */}
      <OrbitingParticle orbit={orbit} cx={cx} cy={cy} />
    </G>
  )
}

/* One particle orbiting an orb — a halo + core point that traces a
 * circle around the nucleus on the slow 40 s `orbit` clock. The angular
 * position is computed ONCE in a derived value so halo + core read one
 * value. Dust vocabulary: warm halo, white-hot core, gentle opacity
 * fade so it never reads as a hard cursor. Each orb starts its particle
 * at a different angle (derived from cx) so the trio doesn't pulse in
 * lockstep. */
function OrbitingParticle({
  orbit,
  cx,
  cy,
}: {
  orbit: SharedValue<number>
  cx: number
  cy: number
}) {
  const radius = ORB * 0.5
  // Stable per-orb phase offset so the three particles aren't synced.
  const phase = (cx % 360) / 360
  const motion = useDerivedValue(() => {
    'worklet'
    const a = (orbit.value + phase) * 2 * Math.PI
    const x = cx + Math.cos(a) * radius
    const y = cy + Math.sin(a) * radius * 0.78 // slight elliptical tilt
    // Fade as it passes behind (top of the loop) → never a hard cursor.
    const op = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(a))
    return { x, y, op }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.x, cy: motion.value.y, opacity: motion.value.op * 0.35 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.x, cy: motion.value.y, opacity: motion.value.op }
  })
  return (
    <>
      <AnimatedCircle r={2.8} fill="#FFE9D6" animatedProps={haloProps} />
      <AnimatedCircle r={1.2} fill="#FFFFFF" animatedProps={coreProps} />
    </>
  )
}

/* A label + preview pair for one lens, drawn in viewBox space. Two text
 * lines: the uppercase label, and the sentence-case preview under it.
 * Both centred on the orb's x. `bone` solid for legibility and to keep
 * magenta text to ≤2 per screen. */
function LensLabel({
  lens,
}: {
  lens: { label: string; preview: string; nuc: { x: number; y: number } }
}) {
  const { nuc, label, preview } = lens
  const labelY = nuc.y + LABEL_DY
  return (
    <SvgText x={nuc.x} y={labelY} textAnchor="middle" fill={colors.bone}>
      <TSpan
        x={nuc.x}
        fontFamily={typography.uiBold}
        fontSize={LABEL_FONT}
        // letterSpacing in viewBox units; matches the screen 2px spacing.
        letterSpacing={2}
      >
        {label}
      </TSpan>
      <TSpan
        x={nuc.x}
        dy={PREVIEW_DY}
        fontFamily={typography.uiMedium}
        fontSize={PREVIEW_FONT}
        fillOpacity={0.85}
      >
        {preview}
      </TSpan>
    </SvgText>
  )
}

/* A particle travelling along the celestial arc (the SAME quadratic
 * Bézier the visible arc draws). The curve is evaluated as a pure
 * function in the worklet — no path-measurement API — using the
 * module-level control points. Halo + core (dust vocabulary). The
 * travel math is computed ONCE in a derived value so halo + core read
 * one value instead of each recomputing the Bézier per frame. */
function FlowingParticle({ clock, offset }: { clock: SharedValue<number>; offset: number }) {
  const motion = useDerivedValue(() => {
    'worklet'
    const t = (clock.value + offset) % 1
    const mt = 1 - t
    // Quadratic Bézier B(t) = mt²·P0 + 2·mt·t·C + t²·P2.
    const x = mt * mt * ARC_P0.x + 2 * mt * t * ARC_C.x + t * t * ARC_P2.x
    const y = mt * mt * ARC_P0.y + 2 * mt * t * ARC_C.y + t * t * ARC_P2.y
    const edgeFade = Math.min(t, 1 - t) * 6
    // R4 — these arc particles are "polvo", not headlights: core cap
    // lowered 0.85→0.7 so they sit a touch dimmer.
    return { x, y, op: Math.min(0.7, edgeFade) }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.x, cy: motion.value.y, opacity: motion.value.op * 0.3 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.x, cy: motion.value.y, opacity: motion.value.op }
  })
  return (
    <>
      {/* R4 — halo r 3.6→3.2 to match the dimmer "dust" read. */}
      <AnimatedCircle r={3.2} fill="#FFE9D6" animatedProps={haloProps} />
      <AnimatedCircle r={1.6} fill="#FFFFFF" animatedProps={coreProps} />
    </>
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
    // Single reading axis — centred, matching step 1.
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    // CAMBIO 7 — magenta budget: eyebrow dropped magenta→bone so the
    // text-magenta on this screen stays ≤2 (titleEm + CTA). Same weight,
    // uppercase + spacing untouched.
    color: colors.bone,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
    textAlign: 'center',
  },
  title: {
    fontFamily: typography.displayHeavy,
    // CAMBIO 6 — aligned to welcome's quote (38/40/-1.6) so the titular
    // doesn't visibly shrink when crossing from step 1 to step 2.
    fontSize: 38,
    lineHeight: 40,
    color: colors.leche,
    letterSpacing: -1.6,
    textAlign: 'center',
  },
  titleEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    // The emphatic line stays serif italic — this IS the emotional
    // (coach) line, so italic is legitimate here.
    fontSize: 38,
    color: colors.magenta,
    letterSpacing: -1.2,
  },
  body: {
    marginTop: 18,
    // CAMBIO 5 — the body is EXPOSITORY, not coach voice, so it moves to
    // upright Hanken (uiMedium) — matching welcome's `meta`. Words are
    // unchanged; only family/style change. Italic is reserved for the
    // coach line above.
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.leche,
    maxWidth: 320,
    textAlign: 'center',
    alignSelf: 'center',
  },
  previewBlock: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // CAMBIO 3 — full-width scene with bounded height (inherited from
  // welcome's heroWrap discipline): minHeight stops the SE/mini from
  // crushing it / pushing the CTA off-screen; maxHeight stops the Pro
  // Max from leaving indifferent air. Labels live INSIDE the Svg so
  // they scale with the orbs and never desalign — no absolute text.
  sceneWrap: {
    width: '100%',
    flex: 1,
    minHeight: SCENE_MIN_H,
    maxHeight: SCENE_MAX_H,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
})

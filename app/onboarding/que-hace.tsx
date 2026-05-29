import { useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
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
 * The three bodies are the three real surfaces of the "Tu Órbita" tab:
 *   DÍA    — a sunrise from space (the home + daily ritual).
 *   SEMANA — two spiral arms (the weekly patterns lens).
 *   MES    — a dark void + photon ring (the monthly constellation).
 *
 * SEMANTIC PARITY (uxui round 2): the three lenses are EQUIVALENT views
 * of the same data, never hierarchical — and DÍA is the product home,
 * so it must not be demoted. Therefore:
 *   - All three bodies share the SAME apparent size (TILE) and the SAME
 *     WARM temperature (no cold `ciclo` halo on the sides any more).
 *   - All three render at full opacity (no 0.82 dimming of the sides).
 *   - Depth is now carried ONLY by composition + motion, never by
 *     importance: (a) the vertical Y offset (centre sits lower), (b) a
 *     differential parallax drift (centre vs sides ride the slow clock
 *     with different amplitude), (c) the shared field bloom they sit in.
 *   - SEMANA still reads as the natural focal point purely because it is
 *     centred — that is fine; what we removed is it being bigger, warmer
 *     and more opaque than its siblings.
 *
 * Each body now also carries a label + a 2–3 word preview, drawn INSIDE
 * the Svg (viewBox space) so they scale with the bodies and never
 * desalign on a small screen (SE/mini). The preview copy is NEW and must
 * be reviewed by voice-and-copy (see LENSES below).
 *
 * Everything lives in ONE Svg so z-order is implicit and we draw a
 * single canvas, back→front: nebula → field bloom → cosmic dust →
 * far cool stars → arc → the three bodies → flowing particles → labels.
 *
 * Shared clocks — SAME periods as step 1 so both steps breathe on the
 * same compás:
 *   clock  5 s  the three bodies' breath + spin + particle travel
 *   dust  18 s  cosmic-dust drift (same as welcome)
 *   orbit 40 s  far-star + arc + body parallax drift (same as welcome)
 *
 * Dark only — every layer terminates in bg (#0A0608) at opacity 0,
 * never cold black.
 */

// Scene canvas. Taller than before because the labels + previews now
// live INSIDE the viewBox (under each body) so they scale with the
// scene and never desalign on narrow screens.
const VB_W = 320
const VB_H = 196

// All three bodies are the SAME apparent size — equivalent lenses.
const TILE = 94

// Nuclei in viewBox space. Centre sits LOWER than the sides (≈10px) so
// the trio is an asymmetric constellation, not a row. This vertical
// offset (plus the differential parallax below) carries the depth now
// that size/temperature/opacity are equalised.
const NUC_DIA = { x: 52, y: 78 }
const NUC_SEM = { x: 160, y: 88 }
const NUC_MES = { x: 268, y: 78 }

// Lens labels + previews. Data-driven and module-level so the copy is
// trivial to swap. The `preview` strings are NEW copy → flag for
// voice-and-copy review. Sentence case on previews by design.
const LENSES: {
  key: 'dia' | 'semana' | 'mes'
  label: string
  preview: string
  nuc: { x: number; y: number }
}[] = [
  { key: 'dia', label: 'DÍA', preview: 'Tu día', nuc: NUC_DIA },
  { key: 'semana', label: 'SEMANA', preview: 'Tu ritmo', nuc: NUC_SEM },
  { key: 'mes', label: 'MES', preview: 'Tu cielo', nuc: NUC_MES },
]

// Label typography in viewBox units (kept here so the in-Svg text and
// the styles stay in one place). Sizes are viewBox px ≈ screen px at the
// reference width; they scale with the Svg on smaller devices.
const LABEL_FONT = 11
const PREVIEW_FONT = 9
const LABEL_DY = TILE / 2 + 14 // first text baseline below the nucleus
const PREVIEW_DY = 12 // preview baseline below the label

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

// Far COOL stars — the cold distant stratum (mirrors welcome's far
// field). Cold is fine HERE because these are background depth, not the
// three lenses. Module-level so they are never recreated per render.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 28, y: 30, r: 0.6, opacity: 0.1 },
  { x: 300, y: 22, r: 0.7, opacity: 0.12 },
  { x: 110, y: 14, r: 0.5, opacity: 0.08 },
  { x: 230, y: 40, r: 0.6, opacity: 0.1 },
]

// Cosmic dust rising through the upper dead zone (same physics as
// welcome's DustMote; x is a 0→1 fraction of the canvas WIDTH here).
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
]

// Particle phases — deliberately NOT equispaced so the pair never reads
// as a moving train.
const PARTICLE_PHASES = [0, 0.55]

// Scene height bounds (inherited from welcome's heroWrap discipline):
// minHeight stops the SE/mini from crushing the scene & pushing the CTA
// off-screen; maxHeight stops a Pro Max from leaving indifferent air.
const SCENE_MIN_H = 196
const SCENE_MAX_H = 236

// Combined VoiceOver label — the scene is decorative for VO (all the
// visual depth is non-semantic), but the three lenses ARE information,
// so we expose them once, in reading order, on the wrapper.
const SCENE_A11Y_LABEL = 'Tres vistas de tu progreso: Día, Semana y Mes.'

export default function QueHaceScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <WizardBackdrop />
      {/* Shared atmosphere — same sky as step 1, glow lowered to where
          the three bodies live so the warm light pools under them. */}
      <AtmosphericSky glow={{ cx: '50%', cy: '64%', r: '70%' }} />
      <View style={styles.progressWrap}>
        <ProgressBar current={2} total={12} />
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
          <PreviewRow />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryCta
          label="Empezar"
          variant="soft"
          transform="none"
          onPress={() => router.push('/onboarding/atribucion')}
        />
      </View>
    </SafeAreaView>
  )
}

/*
 * The unified three-body scene. One full-width Svg. The three bodies,
 * the arc, the field bloom, the dust, the far stars AND the labels share
 * three clocks (clock / dust / orbit) so the scene reads as one
 * coordinated sky rather than three independent widgets.
 */
function PreviewRow() {
  // 5 s body breath / spin / particle travel.
  const clock = useSharedValue(0)
  // 18 s cosmic-dust drift (same period as welcome).
  const dust = useSharedValue(0)
  // 40 s far-star + arc + body parallax (same period as welcome).
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

  // Far-star + arc parallax — a tiny Lissajous drift derived from
  // `orbit` (no new clock). The whole cold stratum + arc breathe
  // together by a couple of px so the deep field feels alive.
  const fieldDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 2} ${Math.cos(u) * 1.4})` }
  })

  // Differential BODY parallax — the depth that size/temperature no
  // longer carry now lives here. Sides and centre ride the SAME slow
  // `orbit` clock but with DIFFERENT amplitude + counter-phase, so the
  // trio subtly shears in depth (sides float a little more, in the
  // opposite sense to the centre). No importance is implied — it's the
  // same kind of motion welcome uses for its star strata.
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
          {/* Deep nebula — off-centre elliptical mass (clone of
              welcome's #nebula): the deepest atmosphere. */}
          <RadialGradient id="qh-nebula" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaDeep} stopOpacity="0.05" />
            <Stop offset="0.6" stopColor={colors.magentaDeep} stopOpacity="0.025" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
          {/* Shared field bloom — the warm light the three bodies sit
              in. Off-centre, bleeds past the viewBox. */}
          <RadialGradient id="qh-field" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity="0.10" />
            <Stop offset="0.5" stopColor={colors.magentaDeep} stopOpacity="0.03" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
          {/* Star halo — tight white falloff so far stars glow. */}
          <RadialGradient id="qh-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Shared WARM body halo — used identically by all three
              bodies so none is warmer than the others. */}
          <RadialGradient id="qh-bodyHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magentaHot} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={colors.magentaHot} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* 0. Deep nebula — pushed down-right, off-centre. */}
        <Ellipse cx={208} cy={150} rx={260} ry={190} fill="url(#qh-nebula)" />

        {/* 1. Shared field bloom — off-centre under the trio. */}
        <Circle cx={160} cy={110} r={150} fill="url(#qh-field)" />

        {/* Cold stratum (far stars) + arc share the slow parallax. */}
        <AnimatedG animatedProps={fieldDriftProps}>
          {/* 2. Cosmic dust rising through the upper dead zone. */}
          {DUST.map((d, i) => (
            <DustMote key={`dust-${i}`} {...d} clock={dust} stage={VB_H} fill="#F8DBCE" />
          ))}

          {/* 3. Far COOL stars — the cold distant stratum (background
              depth only — NOT one of the three lenses). */}
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x}
                cy={s.y}
                r={s.r * 2.4}
                fill="url(#qh-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle cx={s.x} cy={s.y} r={s.r} fill={colors.dimension.ciclo} opacity={s.opacity} />
            </G>
          ))}

          {/* 4. Celestial arc — one faint Q-curve threading the three
              nuclei. Replaces the straight dashed connector. */}
          <Path
            d={ARC_PATH}
            fill="none"
            stroke={colors.magenta}
            strokeOpacity={0.12}
            strokeWidth={0.8}
            strokeDasharray="1 14"
            strokeLinecap="round"
          />
        </AnimatedG>

        {/* 5. The three bodies — equal size, equal warmth, full opacity.
            Depth comes from the Y offset + differential parallax: sides
            ride `sideDriftProps`, centre rides the counter `centreDrift`.
            Drawn sides first so the centre overlaps on contact. */}
        <AnimatedG animatedProps={sideDriftProps}>
          <DiaBody clock={clock} cx={NUC_DIA.x} cy={NUC_DIA.y} tile={TILE} />
          <MesBody clock={clock} cx={NUC_MES.x} cy={NUC_MES.y} tile={TILE} />
        </AnimatedG>
        <AnimatedG animatedProps={centreDriftProps}>
          <SemanaBody clock={clock} cx={NUC_SEM.x} cy={NUC_SEM.y} tile={TILE} />
        </AnimatedG>

        {/* 6. Flowing particles — navigate the SAME arc curve, halo +
            core (dust vocabulary), dispar phases. */}
        {PARTICLE_PHASES.map((p, i) => (
          <FlowingParticle key={`p-${i}`} clock={clock} offset={p} />
        ))}

        {/* 7. Labels + previews — drawn INSIDE the viewBox (so they scale
            with the bodies and never desalign on narrow screens). Each
            label rides the same parallax drift as its body so text and
            body move together. All bone — see magenta-budget note. */}
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

/* A label + preview pair for one lens, drawn in viewBox space. Two
 * text lines: the uppercase label, and the sentence-case preview under
 * it. Both centred on the body's x. `bone` solid for legibility and to
 * keep magenta text to ≤2 per screen (see budget note in styles). */
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

/* ── DÍA — sunrise from space ─────────────────────────────────────
 * A luminous body just above the planetary horizon, with a vertical
 * beam. The beam's top is diffused upward (a faint wash) so the body
 * ties into the field above it — volumetric light, not a clipped line.
 * Warm halo only — no cold `ciclo` tint (it is an equal lens). */
function DiaBody({
  clock,
  cx,
  cy,
  tile,
}: {
  clock: SharedValue<number>
  cx: number
  cy: number
  tile: number
}) {
  const half = tile / 2
  const HORIZON_Y = cy + tile * 0.14
  const SUN_Y = HORIZON_Y - 2
  const skyTop = cy - half
  const planetCurve = useMemo(() => {
    const left = cx - half - 4
    const right = cx + half + 4
    return `M ${left} ${HORIZON_Y + 4} Q ${cx} ${HORIZON_Y - 2} ${right} ${HORIZON_Y + 4}`
  }, [cx, half, HORIZON_Y])

  const sunProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: 2.6 + wave * 0.7, opacity: 0.9 + wave * 0.1 }
  })
  const sunHaloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: 6 + wave * 2, opacity: 0.26 + wave * 0.14 }
  })
  const beamProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.5 + wave * 0.25 }
  })

  return (
    <G>
      <Defs>
        <RadialGradient id="dia-sun" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="55%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
        {/* Vertical beam — volumetric: brightest at the sun, diffuses
            to nothing above so it bleeds into the field. */}
        <LinearGradient id="dia-beam" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="45%" stopColor="#FBD7E3" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
        </LinearGradient>
        {/* Warm sky haze above the horizon. */}
        <LinearGradient id="dia-sky" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.16} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Warm halo behind the body — shared id, identical to the other
          two lenses (no cold tint). */}
      <Circle cx={cx} cy={SUN_Y} r={tile * 0.4} fill="url(#qh-bodyHalo)" />
      {/* Warm sky haze rising from the horizon up. */}
      <Path
        d={`M ${cx - half} ${HORIZON_Y} L ${cx + half} ${HORIZON_Y} L ${cx + half} ${skyTop} L ${cx - half} ${skyTop} Z`}
        fill="url(#dia-sky)"
        opacity={0.7}
      />
      {/* Volumetric beam — drawn behind the sun so it punches through. */}
      <AnimatedG animatedProps={beamProps}>
        <Path
          d={`M ${cx} ${SUN_Y} L ${cx} ${skyTop - 6}`}
          stroke="url(#dia-beam)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </AnimatedG>
      {/* Planet curvature — dark body + faint highlight rim. */}
      <Path d={planetCurve} fill="none" stroke="#3A0A1F" strokeWidth={6} strokeLinecap="round" />
      <Path
        d={planetCurve}
        fill="none"
        stroke="#F4ABC8"
        strokeOpacity={0.5}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      {/* Sun halo + sun body. */}
      <AnimatedCircle cx={cx} cy={SUN_Y} fill={colors.magenta} animatedProps={sunHaloProps} />
      <AnimatedCircle cx={cx} cy={SUN_Y} fill="url(#dia-sun)" animatedProps={sunProps} />
    </G>
  )
}

/* ── SEMANA — 2 spiral arms + nucleus ─────────────────────────────
 * Equal size + warmth to its siblings now. Its only distinction is
 * being centred. The arms rotate slowly as a group. */
function SemanaBody({
  clock,
  cx,
  cy,
  tile,
}: {
  clock: SharedValue<number>
  cx: number
  cy: number
  tile: number
}) {
  const armPath = useMemo(() => buildSpiralPath(0, cx, cy, tile), [cx, cy, tile])
  const armPath2 = useMemo(() => buildSpiralPath(Math.PI, cx, cy, tile), [cx, cy, tile])
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: 2.6 + wave * 0.5, opacity: 0.92 + wave * 0.08 }
  })
  const spinProps = useAnimatedProps(() => {
    'worklet'
    const deg = clock.value * 360
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
  return (
    <G>
      <Defs>
        <RadialGradient id="sem-core" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magentaHot} />
        </RadialGradient>
      </Defs>
      {/* Shared warm halo — same id/intensity as DÍA + MES. */}
      <Circle cx={cx} cy={cy} r={tile * 0.4} fill="url(#qh-bodyHalo)" />
      <AnimatedG animatedProps={spinProps}>
        <Path d={armPath} fill="none" stroke="#F8C7D8" strokeOpacity={0.62} strokeWidth={1} />
        <Path d={armPath2} fill="none" stroke="#F4ABC8" strokeOpacity={0.45} strokeWidth={0.8} />
      </AnimatedG>
      <Circle cx={cx} cy={cy} r={6} fill={colors.magentaHot} opacity={0.28} />
      <AnimatedCircle cx={cx} cy={cy} fill="url(#sem-core)" animatedProps={coreProps} />
    </G>
  )
}

/* ── MES — dark void + photon ring + satellites ───────────────────
 * Equal size + warmth to its siblings now. The void resolves to bg
 * (#0A0608), never cold pure black (dark-only rule). */
function MesBody({
  clock,
  cx,
  cy,
  tile,
}: {
  clock: SharedValue<number>
  cx: number
  cy: number
  tile: number
}) {
  const voidR = 10
  const photonR = voidR * 1.18
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: photonR + wave * 0.8, opacity: 0.78 + wave * 0.18 }
  })
  return (
    <G>
      <Defs>
        {/* Void — resolves to bg, not pure black. */}
        <RadialGradient id="mes-void" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor={colors.bg} />
          <Stop offset="80%" stopColor={colors.bg} />
          <Stop offset="100%" stopColor="#3A0A1F" />
        </RadialGradient>
        <RadialGradient id="mes-ring" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
      </Defs>
      {/* Shared warm halo — same id/intensity as DÍA + SEMANA. */}
      <Circle cx={cx} cy={cy} r={tile * 0.4} fill="url(#qh-bodyHalo)" />
      <Circle cx={cx} cy={cy} r={tile * 0.3} fill={colors.magenta} opacity={0.08} />
      {/* 4 satellite dots floating around the disc. */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * 2 * Math.PI + Math.PI / 4
        const r = tile * 0.36
        return (
          <Circle
            key={i}
            cx={cx + Math.cos(a) * r}
            cy={cy + Math.sin(a) * r}
            r={1.3}
            fill="#F4ABC8"
            opacity={0.5}
          />
        )
      })}
      <Circle cx={cx} cy={cy} r={voidR} fill="url(#mes-void)" />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill="none"
        stroke="url(#mes-ring)"
        strokeWidth={1.4}
        animatedProps={ringProps}
      />
    </G>
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
    return { x, y, op: Math.min(0.85, edgeFade) }
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
      <AnimatedCircle r={3.6} fill="#FFE9D6" animatedProps={haloProps} />
      <AnimatedCircle r={1.6} fill="#FFFFFF" animatedProps={coreProps} />
    </>
  )
}

/* Build a 2-turn logarithmic spiral arm centred on (cx, cy). `tile`
 * scales the spiral so it stays proportional to the body. */
function buildSpiralPath(angleOffset: number, cx: number, cy: number, tile: number): string {
  const scale = tile / 90
  const a = 3 * scale
  const b = 0.32
  const steps = 28
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 5.5
    const r = a * Math.exp(b * t)
    const ang = t + angleOffset
    const x = cx + r * Math.cos(ang)
    const y = cy + r * Math.sin(ang)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `
  }
  return d
}

const styles = StyleSheet.create({
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
  // Max from leaving indifferent air. Labels now live INSIDE the Svg so
  // they scale with the bodies and never desalign — no absolute text.
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

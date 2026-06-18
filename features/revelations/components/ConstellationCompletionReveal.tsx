import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import { ScreenCosmos } from '@/features/orbit/components/Cosmos'
import { LunarConstellation } from '@/features/tabs/components'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { SOUL_ART } from '@/features/celestial-soul/soulArt'

/*
 * Ceremonia de Constelación Completa → nacimiento del Alma Celeste.
 *
 * Acto I — la constelación que completaste:
 *   1 (2s) zoom lento · 2 (2s) latido · 3 (3s) "Completaste tu Leo."
 *   4 (3s) la figura se disuelve en POLVO DE ESTRELLA · "Tu zodiaco nunca fue
 *          el destino. Fue el comienzo."
 * Acto II — lo que nace:
 *   5 (2s) GATHER · el polvo se junta en UNA estrella central. Casi a oscuras.
 *   6 (4s) la estrella LATE; con cada pulso emerge el Alma Celeste.
 *   7      el Alma Celeste queda al ~10 % (durmiente) · "Un cielo nuevo
 *          despierta." · CTA "Continuar".
 *
 * Restricciones: sin flashes, sin pantallas blancas, sin escalado agresivo, sin
 * efectos de premio. Solo opacidad, partículas, glow, parallax. Emociones:
 * viaje, descubrimiento, renacimiento, despertar.
 *
 * Copy español (revisar voice-and-copy). `onContinue` → Alma Celeste a pleno
 * (pantalla futura). `onClose` → regresar.
 */

type Props = {
  sign: ZodiacSign
  onContinue: () => void
  onClose?: () => void
}

type Phase = 'zoom' | 'illuminate' | 'completed' | 'dissolve' | 'gather' | 'soul' | 'awaken'

const ALL_TRAINED: readonly boolean[] = Array.from({ length: 28 }, () => true)
const TODAY_IDX = ALL_TRAINED.length - 1

const VB = 100
const PAD = 14
// El Alma Celeste queda DURMIENTE pero VISIBLE (etérea). El spec pedía 10 %
// pero a ese nivel no se veía nada; ~58 % se lee como "dormida", no invisible.
const SOUL_MAX_OPACITY = 0.58

function titleCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

function fitStars(stars: readonly { x: number; y: number; mag: number }[]) {
  const xs = stars.map((s) => s.x)
  const ys = stars.map((s) => s.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX || 1
  const h = maxY - minY || 1
  const scale = (VB - 2 * PAD) / Math.max(w, h)
  const offX = (VB - w * scale) / 2 - minX * scale
  const offY = (VB - h * scale) / 2 - minY * scale
  return stars.map((s) => ({ x: s.x * scale + offX, y: s.y * scale + offY }))
}

/** Polvo denso que traza la figura (muestreado a lo largo de cada línea +
 *  cúmulos en cada estrella). Coords 0..100 (% del box). */
function dustField(
  fitted: { x: number; y: number }[],
  lines: readonly (readonly [number, number])[],
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (const [a, b] of lines) {
    const sa = fitted[a]
    const sb = fitted[b]
    if (!sa || !sb) continue
    for (let t = 0; t < 8; t++) {
      const f = t / 7
      pts.push({ x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f })
    }
  }
  for (const s of fitted) for (let k = 0; k < 6; k++) pts.push({ x: s.x, y: s.y })
  return pts
}

export function ConstellationCompletionReveal({ sign, onContinue, onClose }: Props) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion() ?? false
  const def = ZODIAC[sign]
  const name = titleCase(def.label)

  const heroSize = Math.min(width - 24, height * 0.5, 380)
  const soulSize = Math.min(width * 0.96, height * 0.62)
  const starSize = Math.min(width, height) * 0.72
  const dust = useMemo(() => dustField(fitStars(def.stars), def.lines), [def.stars, def.lines])

  const [phase, setPhase] = useState<Phase>('zoom')

  // Acto I
  const scrim = useSharedValue(0)
  const zoom = useSharedValue(0)
  const pulse = useSharedValue(0)
  const dissolve = useSharedValue(0)
  // Acto II
  const gather = useSharedValue(0) // el polvo se junta → estrella central
  const star = useSharedValue(0) // brillo/presencia de la estrella central
  const starPulse = useSharedValue(0) // latido de la estrella (revela el alma)
  const soul = useSharedValue(0) // opacidad del Alma Celeste (0 → SOUL_MAX)
  const breath = useSharedValue(0)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))
    const cleanup = () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      ;[scrim, zoom, pulse, dissolve, gather, star, starPulse, soul, breath].forEach(
        cancelAnimation,
      )
    }

    if (!reduced) {
      breath.value = withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    }

    const T = reduced ? 0.32 : 1 // factor de tiempo (versión sobria más corta)
    scrim.value = withTiming(1, { duration: reduced ? 300 : 900, easing: Easing.out(Easing.cubic) })
    zoom.value = withTiming(1, { duration: 2000 * T, easing: Easing.inOut(Easing.cubic) })
    if (!reduced) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})

    at(2000 * T, () => {
      setPhase('illuminate')
      pulse.value = withSequence(
        withTiming(1, { duration: 560, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 560, easing: Easing.inOut(Easing.sin) }),
      )
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    })

    at(4000 * T, () => setPhase('completed'))

    // Acto I · disolución
    at(7000 * T, () => {
      setPhase('dissolve')
      dissolve.value = withTiming(1, { duration: 3000 * T, easing: Easing.out(Easing.cubic) })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    })

    // Acto II · gather → una estrella
    at(10000 * T, () => {
      setPhase('gather')
      gather.value = withTiming(1, { duration: 2000 * T, easing: Easing.inOut(Easing.cubic) })
      star.value = withTiming(1, { duration: 1600 * T, easing: Easing.out(Easing.cubic) })
    })

    // Acto II · la estrella late y revela el alma
    at(12000 * T, () => {
      setPhase('soul')
      // 5 latidos suaves en 4 s (sin escalado agresivo: opacidad + glow).
      starPulse.value = withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.sin) }),
        8,
        true,
      )
      // 5 pasos sincronizados a los 5 latidos: con cada pulso se revela MÁS del
      // Alma Celeste, de arriba (cabeza) hacia abajo (figura completa). Queda al
      // 10 % durmiente. (Un solo PNG no permite separar cabeza/cabello/halo en
      // capas; este wipe top-down es la mejor aproximación sin arte por capas.)
      const step = 800 * T
      const eo = Easing.out(Easing.cubic)
      soul.value = withSequence(
        withTiming(0.2, { duration: step, easing: eo }),
        withTiming(0.4, { duration: step, easing: eo }),
        withTiming(0.6, { duration: step, easing: eo }),
        withTiming(0.8, { duration: step, easing: eo }),
        withTiming(1.0, { duration: step, easing: eo }),
      )
      if (!reduced) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    })

    // Acto II · despertar — la estrella CEDE (se atenúa) para que el Alma
    // Celeste sea lo que se ve; queda un núcleo tenue, no un sol que la tape.
    at(16000 * T, () => {
      setPhase('awaken')
      cancelAnimation(starPulse)
      starPulse.value = withTiming(0.3, { duration: 800 })
      star.value = withTiming(0.32, { duration: 1000, easing: Easing.out(Easing.cubic) })
    })

    return cleanup
  }, [reduced, scrim, zoom, pulse, dissolve, gather, star, starPulse, soul, breath])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }))

  // La constelación: zoom + latido; al disolverse cede su luz (opacidad → 0).
  const heroStyle = useAnimatedStyle(() => {
    const z = 1.0 + zoom.value * 0.07
    const p = 1 + pulse.value * 0.03
    return { opacity: 1 - dissolve.value, transform: [{ scale: z * p }] }
  })

  const haloBreath = useAnimatedStyle(() => ({
    opacity: (0.2 + 0.32 * breath.value) * (1 - dissolve.value),
  }))

  // Estrella central — aparece con el gather (escala one-shot), LATE por
  // opacidad (sin escalar el SVG por frame: no re-rasteriza). El SVG dibuja una
  // estrella de verdad (destellos en cruz + diagonales + glow).
  const starWrapStyle = useAnimatedStyle(() => ({
    opacity: star.value * (0.55 + 0.45 * starPulse.value),
    transform: [{ scale: 0.7 + gather.value * 0.3 }],
  }))

  // Alma Celeste — emerge top-down (cabeza → figura) por un clip que crece, y
  // queda al 10 % durmiente. La opacidad entra rápido en el primer pulso; un
  // hilo de parallax con la respiración la mantiene "viva".
  const soulOuterStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, soul.value * 4) * SOUL_MAX_OPACITY,
    transform: [{ translateY: -breath.value * 3 }],
  }))
  const soulClipStyle = useAnimatedStyle(() => ({
    height: Math.max(1, soul.value * soulSize),
  }))

  const back = onClose ?? onContinue
  const showConstellation =
    phase === 'zoom' || phase === 'illuminate' || phase === 'completed' || phase === 'dissolve'

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <ScreenCosmos width={width} height={height} />
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      </Animated.View>

      {/* Alma Celeste durmiente — detrás de todo. Se revela TOP-DOWN (clip que
          crece con cada pulso) y queda al 10 %. */}
      <Animated.View style={[styles.soulWrap, soulOuterStyle]} pointerEvents="none">
        <View style={{ width: soulSize, height: soulSize }}>
          <Animated.View style={[styles.soulClip, { width: soulSize }, soulClipStyle]}>
            <Image
              source={SOUL_ART[sign]}
              style={{ width: soulSize, height: soulSize }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </Animated.View>

      <Pressable style={StyleSheet.absoluteFill}>
        <View style={styles.stage} pointerEvents="box-none">
          {/* Estrella central — el corazón de la energía reunida. */}
          <Animated.View style={[styles.centerLayer, starWrapStyle]} pointerEvents="none">
            <CentralStar size={starSize} />
          </Animated.View>

          <View style={[styles.field, { width: heroSize, height: heroSize }]} pointerEvents="none">
            <Animated.View style={[styles.haloDisc, haloBreath]} pointerEvents="none" />

            {showConstellation ? (
              <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
                <LunarConstellation
                  trained={ALL_TRAINED}
                  todayIdx={TODAY_IDX}
                  sign={sign}
                  committed
                  showCount={false}
                  suppressBurst
                  ceremonial
                  transformProgressOverride={100}
                />
              </Animated.View>
            ) : null}

            {/* Polvo de estrella — se dispersa (dissolve) y luego se junta a la
                estrella central (gather). */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {dust.map((d, i) => (
                <DustMote
                  key={i}
                  dissolve={dissolve}
                  gather={gather}
                  seed={i}
                  leftPct={d.x}
                  topPct={d.y}
                  boxSize={heroSize}
                />
              ))}
            </View>
          </View>

          {/* ── Copys por fase ── */}
          {phase === 'completed' ? (
            <Animated.View
              key="c"
              entering={FadeIn.duration(reduced ? 200 : 900)}
              style={styles.copyBlock}
            >
              <Text style={styles.title}>Completaste tu {name}.</Text>
              <Text style={styles.subtitle}>El cielo que te guió ya está completo.</Text>
            </Animated.View>
          ) : null}

          {phase === 'dissolve' ? <DissolveCopy reduced={reduced} /> : null}

          {phase === 'awaken' ? <AwakenCopy onContinue={onContinue} reduced={reduced} /> : null}
        </View>

        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            back()
          }}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
          style={[styles.backBtn, { top: insets.top + 8 }]}
        >
          <Feather name="chevron-left" size={26} color={colors.leche} />
        </Pressable>
      </Pressable>
    </View>
  )
}

/* ── Una mota de polvo ─────────────────────────────────────────────────
 * Nace en su punto de la figura. Primero se DISPERSA (dissolve), luego se
 * JUNTA hacia el centro (gather), donde la estrella central la absorbe. */
function DustMote({
  dissolve,
  gather,
  seed,
  leftPct,
  topPct,
  boxSize,
}: {
  dissolve: SharedValue<number>
  gather: SharedValue<number>
  seed: number
  leftPct: number
  topPct: number
  boxSize: number
}) {
  const jx = Math.sin(seed * 7.13) * 0.03 * boxSize
  const jy = Math.cos(seed * 3.71) * 0.03 * boxSize
  const angle = -Math.PI / 2 + Math.sin(seed * 12.9898) * 1.0
  const dist = (0.14 + ((seed * 0.0173) % 0.26)) * boxSize
  const dx = Math.cos(angle) * dist
  const dy = Math.sin(angle) * dist
  const delay = (seed % 11) / 22
  const dim = 1.0 + (seed % 5) * 0.5
  // Vector hacia el centro del box (para el gather).
  const toCx = boxSize / 2 - (leftPct / 100) * boxSize
  const toCy = boxSize / 2 - (topPct / 100) * boxSize

  const style = useAnimatedStyle(() => {
    const dl = Math.max(0, Math.min(1, (dissolve.value - delay) / (1 - delay)))
    const g = gather.value
    // Dispersión (dl) y luego convergencia al centro (g).
    const tx = jx + dx * dl + toCx * g
    const ty = jy + dy * dl + toCy * g
    const disperseOp = dl < 0.14 ? dl / 0.14 : 1 - (dl - 0.14) / 0.86
    // En gather reaparece y se apaga al llegar al centro.
    const gatherOp = g > 0 ? Math.sin(g * Math.PI) : 0
    const opacity = Math.max(0, Math.max(disperseOp, gatherOp)) * 0.9
    return { opacity, transform: [{ translateX: tx }, { translateY: ty }] }
  })

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: `${leftPct}%`, top: `${topPct}%`, width: dim, height: dim, borderRadius: dim / 2 },
        style,
      ]}
      pointerEvents="none"
    />
  )
}

/* ── Copy de la disolución ─────────────────────────────────────────────── */
function DissolveCopy({ reduced }: { reduced: boolean }) {
  const [line2, setLine2] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLine2(true), reduced ? 500 : 1500)
    return () => clearTimeout(t)
  }, [reduced])
  return (
    <View style={styles.copyBlock} pointerEvents="none">
      <Animated.Text entering={FadeIn.duration(reduced ? 240 : 1000)} style={styles.subtitle}>
        Tu zodiaco nunca fue el destino.
      </Animated.Text>
      {line2 ? (
        <Animated.Text entering={FadeIn.duration(reduced ? 240 : 1000)} style={styles.title}>
          Fue el comienzo.
        </Animated.Text>
      ) : null}
    </View>
  )
}

/* ── Despertar · copy + CTA ────────────────────────────────────────────── */
function AwakenCopy({ onContinue, reduced }: { onContinue: () => void; reduced: boolean }) {
  const [cta, setCta] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setCta(true), reduced ? 900 : 2400)
    return () => clearTimeout(t)
  }, [reduced])
  return (
    <View style={styles.awakenBlock} pointerEvents="box-none">
      <Animated.Text entering={FadeIn.duration(reduced ? 280 : 1400)} style={styles.awakenLine}>
        Un cielo nuevo despierta.
      </Animated.Text>
      {cta ? (
        <Animated.View
          entering={FadeIn.duration(reduced ? 260 : 900)}
          style={styles.ctaWrap}
          pointerEvents="auto"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
              onContinue()
            }}
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
          >
            <Text style={styles.ctaBtnText}>Continuar</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  )
}

/* ── Estrella central ───────────────────────────────────────────────────
 * Un destello (lens-flare) SUAVE, no geométrico: los rayos son ELIPSES con
 * gradiente RADIAL (se apagan en todas direcciones → sin borde duro). Cada
 * rayo va en dos capas: un halo ancho tenue + un núcleo fino brillante, que es
 * lo que da el "flare" difuminado. Glow grande + núcleo blanco-cálido. SVG
 * estático; el padre anima opacidad (latido) y escala (aparición). Diagonales
 * con `rotation`/`originX/Y` props (no transform array → seguro en Android). */
// Polvo fino alrededor (estático) — el campo de estrellitas de la referencia.
const STAR_DUST: { x: number; y: number; r: number; o: number }[] = [
  { x: 22, y: 18, r: 0.5, o: 0.5 },
  { x: 78, y: 24, r: 0.6, o: 0.45 },
  { x: 14, y: 44, r: 0.45, o: 0.4 },
  { x: 88, y: 50, r: 0.5, o: 0.5 },
  { x: 30, y: 70, r: 0.55, o: 0.45 },
  { x: 72, y: 76, r: 0.5, o: 0.4 },
  { x: 50, y: 12, r: 0.5, o: 0.45 },
  { x: 50, y: 88, r: 0.55, o: 0.4 },
  { x: 18, y: 66, r: 0.4, o: 0.35 },
  { x: 84, y: 70, r: 0.45, o: 0.4 },
  { x: 36, y: 30, r: 0.4, o: 0.4 },
  { x: 66, y: 36, r: 0.45, o: 0.35 },
]

function CentralStar({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        {/* glow PEQUEÑO y suave (no una bola enorme) */}
        <RadialGradient id="cs-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.oroLeche} stopOpacity={0.42} />
          <Stop offset="0.35" stopColor={colors.oro} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
        {/* núcleo CHICO e intenso */}
        <RadialGradient id="cs-core" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="0.35" stopColor={colors.oroLeche} stopOpacity={0.9} />
          <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="cs-ray" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.oroLeche} stopOpacity={0.95} />
          <Stop offset="0.5" stopColor={colors.oroLeche} stopOpacity={0.3} />
          <Stop offset="1" stopColor={colors.oroLeche} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* polvo fino */}
      {STAR_DUST.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colors.oro} opacity={d.o} />
      ))}

      {/* glow pequeño */}
      <Circle cx={50} cy={50} r={28} fill="url(#cs-glow)" />

      {/* diagonales — MUY tenues y cortas (apenas se insinúan) */}
      <G rotation={45} originX={50} originY={50} opacity={0.16}>
        <Ellipse cx={50} cy={50} rx={0.8} ry={30} fill="url(#cs-ray)" />
        <Ellipse cx={50} cy={50} rx={30} ry={0.8} fill="url(#cs-ray)" />
      </G>

      {/* cruz — FINA y larga, dominante (halo tenue + núcleo fino) */}
      <Ellipse cx={50} cy={50} rx={3} ry={47} fill="url(#cs-ray)" opacity={0.3} />
      <Ellipse cx={50} cy={50} rx={47} ry={3} fill="url(#cs-ray)" opacity={0.3} />
      <Ellipse cx={50} cy={50} rx={0.9} ry={48} fill="url(#cs-ray)" />
      <Ellipse cx={50} cy={50} rx={48} ry={0.9} fill="url(#cs-ray)" />

      {/* núcleo chico e intenso */}
      <Circle cx={50} cy={50} r={5} fill="url(#cs-core)" />
      <Circle cx={50} cy={50} r={1.4} fill="#FFFFFF" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg },
  scrim: { backgroundColor: colors.bg, opacity: 0.62 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  field: { alignItems: 'center', justifyContent: 'center' },
  haloDisc: {
    position: 'absolute',
    width: '92%',
    height: '92%',
    borderRadius: 999,
    backgroundColor: colors.oroTint,
  },
  particle: {
    position: 'absolute',
    backgroundColor: colors.oroLeche,
    marginLeft: -1.5,
    marginTop: -1.5,
  },
  // Alma Celeste durmiente — centrada, detrás.
  soulWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Clip top-down: anclado arriba, crece hacia abajo (revela cabeza → figura).
  soulClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  // Estrella central — glow suave (Views concéntricas, sin SVG).
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  copyBlock: {
    position: 'absolute',
    bottom: '13%',
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 24,
    color: colors.bone,
    textAlign: 'center',
  },
  awakenBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '18%',
    alignItems: 'center',
    paddingHorizontal: 44,
  },
  awakenLine: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    lineHeight: 34,
    color: colors.leche,
    textAlign: 'center',
  },
  ctaWrap: { marginTop: 40, alignItems: 'center' },
  ctaBtn: {
    borderRadius: 100,
    paddingVertical: 15,
    paddingHorizontal: 48,
    backgroundColor: colors.oro,
    shadowColor: colors.oro,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ctaBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
    color: colors.bg,
  },
  pressed: { opacity: 0.6 },
})

import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { useAddMoodCheckin } from '@/features/moods/hooks'
import { type MoodValue } from '@/features/moods/api'
import { colors, typography } from '@/theme'

/*
 * MoodSky — la experiencia de ánimo de Órbita · Día. NO es un control: el usuario
 * mueve el ESTADO de su cielo. Todo se interpola desde UN solo `mp` (0 Difícil ·
 * 0.5 Neutral · 1 Bien): opacidad/escala en el UI thread (Reanimated), y el COLOR
 * de los glows por SVG radial suave (react-native-svg, NO Skia → los colores
 * Skia animados crashean en device; ver memoria). El glifo (glifo-mood.png) es el
 * protagonista; sólo cambia su energía. Elegante y silencioso (Apple Weather /
 * Nothing OS), nunca caricaturesco. Sólo 3 estados; al soltar, spring al bucket.
 */

const GLYPH = require('@/assets/icons/glifo-mood.png')

type MoodBucket = { value: MoodValue; label: string; a: string; b: string }
const BUCKETS: MoodBucket[] = [
  { value: 'struggle', label: 'Difícil', a: 'Hoy costó más.', b: 'Y está bien.' },
  { value: 'neutral', label: 'Neutral', a: 'Hoy fue un día tranquilo.', b: 'Todo en equilibrio.' },
  { value: 'good', label: 'Bien', a: 'Hoy hubo impulso.', b: 'Sigue así.' },
]
const BUCKET_MP = [0, 0.5, 1]

// Paletas (Difícil · Neutral · Bien).
const BG = ['#160B26', '#0A0608', '#210C17'] // morado profundo · negro · rosa cálido
const NEBULA = ['#5A3A8E', '#241326', '#9E3560'] // color de la nebulosa
const GLOW = ['#C7B6F0', '#F4ECDE', '#FF4886'] // glow del glifo: lavanda · blanco · magenta (Bien, magentaHot)

const STAGE = 320
const GLYPH_SIZE = 156
const ORBIT_R = 128
const THUMB = 26

const PARTICLES: { fx: number; fy: number; r: number }[] = [
  { fx: 0.18, fy: 0.24, r: 1.7 },
  { fx: 0.78, fy: 0.2, r: 1.4 },
  { fx: 0.87, fy: 0.5, r: 1.6 },
  { fx: 0.72, fy: 0.8, r: 1.3 },
  { fx: 0.5, fy: 0.9, r: 1.7 },
  { fx: 0.24, fy: 0.78, r: 1.4 },
  { fx: 0.1, fy: 0.52, r: 1.5 },
  { fx: 0.34, fy: 0.14, r: 1.2 },
  { fx: 0.64, fy: 0.12, r: 1.3 },
  { fx: 0.9, fy: 0.34, r: 1.1 },
  { fx: 0.08, fy: 0.36, r: 1.2 },
  { fx: 0.5, fy: 0.06, r: 1.4 },
]

// Estrellas por TODA la pantalla (fracciones) → atmósfera arriba y abajo, no
// sólo en el centro. [fx, fy, r, opacidad, titila].
const FULL_STARS: [number, number, number, number, boolean][] = [
  [0.12, 0.08, 1.1, 0.5, true],
  [0.32, 0.05, 0.8, 0.35, false],
  [0.6, 0.07, 1.0, 0.45, true],
  [0.84, 0.05, 0.9, 0.4, false],
  [0.9, 0.14, 0.7, 0.3, true],
  [0.06, 0.18, 0.9, 0.4, false],
  [0.5, 0.16, 0.7, 0.3, true],
  [0.2, 0.6, 1.0, 0.4, false],
  [0.82, 0.58, 0.9, 0.4, true],
  [0.1, 0.72, 0.8, 0.35, false],
  [0.92, 0.74, 1.0, 0.4, true],
  [0.5, 0.66, 0.7, 0.28, false],
  [0.3, 0.8, 0.9, 0.38, true],
  [0.7, 0.82, 0.8, 0.34, false],
  [0.16, 0.88, 0.7, 0.3, true],
  [0.86, 0.9, 0.9, 0.36, false],
  [0.5, 0.92, 0.8, 0.3, true],
  [0.4, 0.72, 0.6, 0.26, false],
  [0.64, 0.7, 0.7, 0.3, true],
  [0.08, 0.5, 0.7, 0.3, false],
  [0.94, 0.44, 0.8, 0.32, true],
  [0.24, 0.14, 0.7, 0.3, false],
  [0.74, 0.16, 0.8, 0.34, true],
  [0.5, 0.02, 0.7, 0.28, false],
]

function Star({
  s,
  breath,
}: {
  s: [number, number, number, number, boolean]
  breath: SharedValue<number>
}) {
  const [fx, fy, r, o, tw] = s
  const style = useAnimatedStyle(() => ({ opacity: tw ? o * (0.35 + 0.65 * breath.value) : o }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: `${fx * 100}%`,
          top: `${fy * 100}%`,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          backgroundColor: colors.leche,
        },
        style,
      ]}
    />
  )
}

function FullStars({ breath }: { breath: SharedValue<number> }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FULL_STARS.map((s, i) => (
        <Star key={i} s={s} breath={breath} />
      ))}
    </View>
  )
}

/* ── Interpolación de hex en JS (para el color de los SVG radiales) ────── */
function hx(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
function lerpPal(p: number, pal: string[]): string {
  const a = hx(pal[0]!)
  const b = hx(pal[1]!)
  const c = hx(pal[2]!)
  const pick = (i: number): number =>
    p < 0.5 ? a[i]! + (b[i]! - a[i]!) * (p / 0.5) : b[i]! + (c[i]! - b[i]!) * ((p - 0.5) / 0.5)
  return `rgb(${Math.round(pick(0))}, ${Math.round(pick(1))}, ${Math.round(pick(2))})`
}

export function MoodSky({ date, onClose }: { date: string; onClose: () => void }) {
  const addMood = useAddMoodCheckin()
  const reduced = useReducedMotion() ?? false

  const [bucket, setBucket] = useState(1)
  const [touched, setTouched] = useState(false)
  const [colorPos, setColorPos] = useState(0.5) // color de los glows (JS cuantizado)

  const mp = useSharedValue(0.5) // el ÚNICO valor del que todo depende
  const dragging = useSharedValue(0)
  const breath = useSharedValue(0)
  const orbit = useSharedValue(0)
  const flare = useSharedValue(0)
  const trackW = useSharedValue(0)
  const lastBucket = useSharedValue(1)
  const lastColorPos = useSharedValue(0.5)
  const touchedSV = useSharedValue(false)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(breath)
      breath.value = 0.5
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [reduced, breath])

  const frame = useFrameCallback(() => {
    'worklet'
    const speed = interpolate(mp.value, [0, 0.5, 1], [0.006, 0.011, 0.02])
    // Envolver en 2π: si no, el ángulo crece sin cota y cos/sin pierden precisión
    // tras minutos con el modal abierto (los nodos "tiemblan").
    orbit.value = (orbit.value + speed * (1 + flare.value * 0.8)) % (Math.PI * 2)
  })
  useEffect(() => {
    frame.setActive(!reduced)
    return () => frame.setActive(false)
  }, [frame, reduced])

  const onBucketChange = (b: number): void => {
    setBucket(b)
    setTouched(true)
    if (Platform.OS !== 'web') Haptics.selectionAsync()
  }
  const markTouched = (): void => setTouched(true)
  const pulseFlare = (): void => {
    flare.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }, () => {
      flare.value = withTiming(0, { duration: 620, easing: Easing.inOut(Easing.sin) })
    })
  }

  const bucketOf = (p: number): number => {
    'worklet'
    return p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragging.value = withTiming(1, { duration: 160 })
      if (!touchedSV.value) {
        touchedSV.value = true
        runOnJS(markTouched)()
      }
    })
    .onChange((e) => {
      const w = trackW.value
      if (w <= 0) return
      const next = mp.value + e.changeX / w
      const clamped = next < 0 ? 0 : next > 1 ? 1 : next
      mp.value = clamped
      const q = Math.round(clamped * 30) / 30
      if (q !== lastColorPos.value) {
        lastColorPos.value = q
        runOnJS(setColorPos)(q)
      }
      const b = bucketOf(clamped)
      if (b !== lastBucket.value) {
        lastBucket.value = b
        runOnJS(onBucketChange)(b)
      }
    })
    .onEnd(() => {
      dragging.value = withTiming(0, { duration: 260 })
      const b = lastBucket.value
      const target = BUCKET_MP[b] ?? 0.5
      mp.value = withSpring(target, { damping: 18, stiffness: 130, mass: 0.7 })
      lastColorPos.value = target
      runOnJS(setColorPos)(target)
      if (b === 2) runOnJS(pulseFlare)()
    })

  const jumpTo = (b: number): void => {
    const target = BUCKET_MP[b] ?? 0.5
    lastBucket.value = b
    lastColorPos.value = target
    touchedSV.value = true
    mp.value = withSpring(target, { damping: 18, stiffness: 130, mass: 0.7 })
    setColorPos(target)
    onBucketChange(b)
    if (b === 2) pulseFlare()
  }

  /* ── Estilos animados (opacidad/escala en UI thread, desde mp) ──────── */
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(mp.value, [0, 0.5, 1], BG),
  }))
  // Atmósfera + glow UNIFICADOS en un solo radial (sin discos apilados → sin
  // anillo). Intensidad + escala suben con el estado (tenue Difícil, viva Bien).
  const atmoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mp.value, [0, 0.5, 1], [0.78, 0.58, 1]) * (0.92 + 0.08 * breath.value),
    transform: [{ scale: interpolate(mp.value, [0, 0.5, 1], [0.9, 1, 1.14]) }],
  }))
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(mp.value, [0, 0.5, 1], [0.96, 1, 1.06]) * (0.98 + 0.04 * breath.value) },
    ],
  }))
  const haloStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(mp.value, [0, 0.5, 1], GLOW),
    opacity: interpolate(mp.value, [0.4, 1], [0, 0.5], Extrapolation.CLAMP) + flare.value * 0.4,
    transform: [{ scale: interpolate(mp.value, [0.4, 1], [0.9, 1.12]) + flare.value * 0.06 }],
  }))
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: mp.value * trackW.value }, { scale: 1 + dragging.value * 0.35 }],
  }))
  const thumbGlowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(mp.value, [0, 0.5, 1], GLOW),
    opacity: 0.22 + dragging.value * 0.5,
    transform: [{ translateX: mp.value * trackW.value }, { scale: 1 + dragging.value * 0.6 }],
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: mp.value * trackW.value,
    backgroundColor: interpolateColor(mp.value, [0, 0.5, 1], GLOW),
  }))

  const glowColor = lerpPal(colorPos, GLOW)
  const atmoColor = lerpPal(colorPos, NEBULA)
  const msg = BUCKETS[bucket]!

  return (
    <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
      {/* Atmósfera + GLOW en UN solo radial centrado en el glifo: del glow
          brillante (glowColor) → nebulosa (atmoColor) → transparente. Un solo
          gradiente continuo = sin discos apilados, sin anillo marcado, y todo el
          fondo con profundidad. */}
      <Animated.View style={[StyleSheet.absoluteFill, atmoStyle]} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id="mood-atmo" cx="50%" cy="38%" r="98%">
              <Stop offset="0" stopColor={glowColor} stopOpacity={0.85} />
              <Stop offset="0.11" stopColor={glowColor} stopOpacity={0.55} />
              <Stop offset="0.26" stopColor={atmoColor} stopOpacity={0.34} />
              <Stop offset="0.55" stopColor={atmoColor} stopOpacity={0.12} />
              <Stop offset="0.8" stopColor={atmoColor} stopOpacity={0.03} />
              <Stop offset="1" stopColor={atmoColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#mood-atmo)" />
        </Svg>
      </Animated.View>
      {/* Estrellas por toda la pantalla. */}
      <FullStars breath={breath} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={styles.eyebrow}>ÁNIMO</Text>

        {/* Escenario: halo + órbita + partículas + glifo. El glow/atmósfera vive
            en el radial unificado de arriba (sin discos apilados). */}
        <View style={styles.stage} pointerEvents="none">
          <Animated.View style={[styles.halo, haloStyle]} />
          {[0, 1, 2, 3].map((i) => (
            <OrbitNode key={`n${i}`} i={i} mp={mp} orbit={orbit} flare={flare} />
          ))}
          {PARTICLES.map((p, i) => (
            <Particle key={`p${i}`} i={i} p={p} mp={mp} breath={breath} />
          ))}
          <Animated.Image source={GLYPH} style={[styles.glyph, glyphStyle]} resizeMode="contain" />
        </View>

        {/* Mensaje del estado — transición suave (key = bucket). */}
        <View style={styles.messageWrap}>
          <Animated.View
            key={bucket}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(160)}
          >
            <Text style={styles.messageA}>{touched ? msg.a : 'Desliza tu cielo.'}</Text>
            <Text style={styles.messageB}>{touched ? msg.b : 'Difícil, neutral o bien.'}</Text>
          </Animated.View>
        </View>

        {/* El slider — mueve el estado del cielo. */}
        <View style={styles.sliderWrap}>
          <GestureDetector gesture={pan}>
            <View style={styles.sliderHit}>
              <View
                style={styles.sliderTrack}
                onLayout={(e) => {
                  trackW.value = e.nativeEvent.layout.width
                }}
              >
                <View style={styles.sliderBg} />
                <Animated.View style={[styles.sliderFill, fillStyle]} />
                <Animated.View style={[styles.thumbGlow, thumbGlowStyle]} pointerEvents="none" />
                <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none">
                  <View style={styles.thumbCore} />
                </Animated.View>
              </View>
            </View>
          </GestureDetector>
          <View style={styles.sliderLabels}>
            {BUCKETS.map((m, i) => (
              <Pressable
                key={m.value}
                onPress={() => jumpTo(i)}
                style={[
                  styles.labelCell,
                  { alignItems: i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center' },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: touched && bucket === i }}
                accessibilityLabel={m.label}
              >
                <Text style={[styles.label, touched && bucket === i && styles.labelOn]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={() =>
            touched &&
            addMood.mutate(
              { value: BUCKETS[bucket]!.value, date },
              { onSuccess: onClose, onError: onClose },
            )
          }
          disabled={!touched || addMood.isPending}
          accessibilityRole="button"
          style={[styles.cta, (!touched || addMood.isPending) && styles.ctaDisabled]}
        >
          <Text style={styles.ctaText}>{addMood.isPending ? 'Sumando...' : 'Sumar a mi día'}</Text>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  )
}

function OrbitNode({
  i,
  mp,
  orbit,
  flare,
}: {
  i: number
  mp: SharedValue<number>
  orbit: SharedValue<number>
  flare: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const a = orbit.value + (i * Math.PI * 2) / 4
    const cnt = interpolate(mp.value, [0, 0.5, 1], [2, 3, 4])
    const vis = Math.max(0, Math.min(1, cnt - i))
    return {
      opacity: vis * (0.55 + 0.45 * interpolate(mp.value, [0, 1], [0.6, 1])) + flare.value * 0.2,
      transform: [
        { translateX: Math.cos(a) * ORBIT_R },
        { translateY: Math.sin(a) * ORBIT_R },
        { scale: 0.9 + flare.value * 0.35 },
      ],
    }
  })
  return <Animated.View style={[styles.node, style]} />
}

function Particle({
  i,
  p,
  mp,
  breath,
}: {
  i: number
  p: { fx: number; fy: number; r: number }
  mp: SharedValue<number>
  breath: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const cnt = interpolate(mp.value, [0, 0.5, 1], [3, 6, 12])
    const vis = Math.max(0, Math.min(1, cnt - i))
    return {
      opacity: vis * (0.35 + 0.55 * breath.value),
      transform: [{ scale: 0.7 + 0.4 * breath.value }],
    }
  })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: p.fx * STAGE - p.r,
          top: p.fy * STAGE - p.r,
          width: p.r * 2,
          height: p.r * 2,
          borderRadius: p.r,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingBottom: 8,
  },
  eyebrow: {
    marginTop: 8,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  stage: {
    width: STAGE,
    height: STAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centro absoluto para apilar los glows radiales sobre el glifo.
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  halo: {
    position: 'absolute',
    width: ORBIT_R * 2,
    height: ORBIT_R * 2,
    borderRadius: ORBIT_R,
    borderWidth: 1,
  },
  node: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.leche,
  },
  particle: {
    position: 'absolute',
    backgroundColor: colors.leche,
  },
  messageWrap: {
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mismo registro tipográfico que los demás modales (agua/sueño): Hanken display,
  // no serif italic.
  messageA: {
    fontFamily: typography.displaySemi,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: colors.leche,
    textAlign: 'center',
  },
  messageB: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.niebla,
    textAlign: 'center',
  },
  sliderWrap: {
    alignSelf: 'stretch',
    gap: 12,
  },
  sliderHit: {
    height: THUMB + 10,
    justifyContent: 'center',
    paddingHorizontal: THUMB / 2,
  },
  sliderTrack: {
    height: THUMB,
    justifyContent: 'center',
  },
  sliderBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.bruma,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    left: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.leche,
  },
  thumbGlow: {
    position: 'absolute',
    left: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sliderLabels: {
    flexDirection: 'row',
  },
  labelCell: {
    flex: 1,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  labelOn: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: 6,
    paddingVertical: 17,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: colors.oroTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.oroLeche,
  },
})

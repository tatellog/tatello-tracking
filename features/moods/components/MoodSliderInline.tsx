import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { useBriefContext } from '@/features/brief/hooks'
import { colors, typography } from '@/theme'

import type { MoodValue } from '../api'
import { useAddMoodCheckin } from '../hooks'

/*
 * MoodSliderInline — el registro de ánimo de Hoy, MISMO gesto que Órbita
 * (MoodSky): arrastras Difícil ↔ Bien y sueltas para guardar (mood_checkins,
 * 1 eje). Versión COMPACTA para vivir dentro de una slide del pager de Hoy.
 *
 * - Colores JS estáticos por render (glow por SVG radial), nunca worklet →
 *   crash-safe (ver skia-animated-gradient-colors-crash). Solo la posición del
 *   thumb / glifo se anima en el UI thread.
 * - Como vive en un PAGER horizontal, el arrastre bloquea el scroll del pager
 *   vía `onDragActive` (el padre apaga `scrollEnabled` mientras dura el gesto).
 */

const GLYPH = require('@/assets/icons/glifo-mood.png')

const BUCKETS: { value: MoodValue; label: string }[] = [
  { value: 'struggle', label: 'Difícil' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'good', label: 'Bien' },
]
const BUCKET_MP = [0, 0.5, 1]
// Glow del glifo: lavanda (Difícil) · blanco (Neutral) · magenta (Bien). Mismo
// lenguaje que MoodSky. "Bien" = magentaHot del tema (#FF4886), más magenta que
// el rosa pastel anterior, on-brand con el acento fucsia de la app.
const GLOW = ['#C7B6F0', '#F4ECDE', '#FF4886']

const THUMB = 22

/** rgb interpolado de la paleta GLOW (JS, no worklet). */
function lerpGlow(p: number): string {
  const c = p <= 0 ? 0 : p >= 1 ? 1 : p
  const seg = c >= 0.5 ? 1 : 0
  const t = seg === 0 ? c / 0.5 : (c - 0.5) / 0.5
  const from = GLOW[seg] ?? GLOW[0]!
  const to = GLOW[seg + 1] ?? GLOW[GLOW.length - 1]!
  const fh = from.replace('#', '')
  const th = to.replace('#', '')
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * t)
  const r = mix(parseInt(fh.slice(0, 2), 16), parseInt(th.slice(0, 2), 16))
  const g = mix(parseInt(fh.slice(2, 4), 16), parseInt(th.slice(2, 4), 16))
  const b = mix(parseInt(fh.slice(4, 6), 16), parseInt(th.slice(4, 6), 16))
  return `rgb(${r}, ${g}, ${b})`
}

function bucketOf(p: number): number {
  'worklet'
  return p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2
}

export function MoodSliderInline({
  date,
  onDragActive,
  pagerGesture,
  scrollX,
  slideIndex,
  slideW,
}: {
  date: string
  /** Bloquea el pager horizontal mientras dura el arrastre. */
  onDragActive?: (active: boolean) => void
  /** Gesto nativo del scroll del pager: el Pan lo bloquea al activarse
   *  (`blocksExternalGesture`) → el carrusel no roba el arrastre horizontal. */
  pagerGesture?: NativeGesture
  /** Offset de scroll del pager (UI thread) + índice/ancho de ESTA slide. Con
   *  ellos el gesto solo escucha cuando la slide está CENTRADA; si no, su track
   *  asoma en el peek de la slide vecina y roba el swipe (guardaba el ánimo en
   *  vez de paginar). Se decide desde scrollX en el UI thread → robusto ante la
   *  memoización de props o el lag del índice activo. Sin estos datos → siempre
   *  activo (back-compat / tests). */
  scrollX?: SharedValue<number>
  slideIndex?: number
  slideW?: number
}) {
  const brief = useBriefContext(date)
  const saved = brief.data?.latest_mood?.value ?? null
  const add = useAddMoodCheckin()

  // mp (0..1) = posición del slider en el UI thread. colorPos (JS, cuantizado)
  // = color del glow. bucket = palabra mostrada.
  const mp = useSharedValue(0.5)
  const dragging = useSharedValue(0)
  const trackW = useSharedValue(0)
  const lastBucket = useSharedValue(1)
  const lastColorPos = useSharedValue(0.5)
  const flare = useSharedValue(0) // destello de confirmación al guardar

  const [bucket, setBucket] = useState(1)
  const [colorPos, setColorPos] = useState(0.5)
  // Fecha ya sembrada (no un booleano): si cambia `date`, re-siembra el valor
  // guardado de ESE día (Hoy en modo día pasado).
  const [seededDate, setSeededDate] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // ¿Esta slide está CENTRADA en el pager? Solo entonces el gesto escucha (si no,
  // el track asoma en el peek de la vecina y roba el swipe). Se deriva de scrollX
  // en el UI thread — no depende de que un prop/estado se propague a tiempo.
  const [centered, setCentered] = useState(slideIndex == null)
  useAnimatedReaction(
    () => {
      if (scrollX == null || slideW == null || slideW <= 0 || slideIndex == null) return true
      return Math.abs(scrollX.value - slideIndex * slideW) < slideW * 0.5
    },
    (isCentered, prev) => {
      if (isCentered !== prev) runOnJS(setCentered)(isCentered)
    },
    [slideW, slideIndex],
  )

  useEffect(() => {
    if (brief.isLoading || seededDate === date) return
    const idx = saved ? BUCKETS.findIndex((b) => b.value === saved) : 1
    const b = idx < 0 ? 1 : idx
    const target = BUCKET_MP[b] ?? 0.5
    mp.value = target
    lastBucket.value = b
    lastColorPos.value = target
    setBucket(b)
    setColorPos(target)
    setJustSaved(!!saved)
    setSeededDate(date)
  }, [seededDate, date, brief.isLoading, saved, mp, lastBucket, lastColorPos])

  const commit = (b: number): void => {
    setBucket(b)
    setJustSaved(false)
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {})
  }
  const persist = (b: number): void => {
    const value = BUCKETS[b]?.value
    if (!value) return
    add.mutate({ value, date }, { onSuccess: () => setJustSaved(true) })
  }
  const setDrag = (active: boolean): void => onDragActive?.(active)

  // Callbacks JS estables (ref al latest) → `pan` se memoiza de por vida y
  // GestureDetector NO re-registra el gesto en cada re-render del drag (que son
  // ~17 por la cuantización de color); si no, la re-serialización a JSI compite
  // con las animaciones de fondo de Hoy y produce stutter en gama media.
  const commitRef = useRef(commit)
  commitRef.current = commit
  const persistRef = useRef(persist)
  persistRef.current = persist
  const setDragRef = useRef(setDrag)
  setDragRef.current = setDrag
  const stableCommit = useCallback((b: number) => commitRef.current(b), [])
  const stablePersist = useCallback((b: number) => persistRef.current(b), [])
  const stableSetDrag = useCallback((v: boolean) => setDragRef.current(v), [])

  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .enabled(centered)
      .activeOffsetX([-6, 6])
      .onBegin(() => {
        dragging.value = withTiming(1, { duration: 140 })
        runOnJS(stableSetDrag)(true)
      })
      .onChange((e) => {
        const w = trackW.value
        if (w <= 0) return
        const next = mp.value + e.changeX / (w - THUMB)
        const clamped = next < 0 ? 0 : next > 1 ? 1 : next
        mp.value = clamped
        const q = Math.round(clamped * 16) / 16
        if (q !== lastColorPos.value) {
          lastColorPos.value = q
          runOnJS(setColorPos)(q)
        }
        const b = bucketOf(clamped)
        if (b !== lastBucket.value) {
          lastBucket.value = b
          runOnJS(stableCommit)(b)
        }
      })
      .onEnd(() => {
        dragging.value = withTiming(0, { duration: 240 })
        const b = lastBucket.value
        const target = BUCKET_MP[b] ?? 0.5
        mp.value = withSpring(target, { damping: 18, stiffness: 130, mass: 0.7 })
        lastColorPos.value = target
        runOnJS(setColorPos)(target)
        // Destello de confirmación: el glow y el glifo pulsan al guardar.
        flare.value = withSequence(
          withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 640, easing: Easing.inOut(Easing.sin) }),
        )
        runOnJS(stablePersist)(b)
      })
      .onFinalize(() => {
        runOnJS(stableSetDrag)(false)
      })
    // Bloqueo NATIVO del scroll del pager: al activarse el arrastre horizontal,
    // el carrusel no puede robar el gesto (sin el race del toggle scrollEnabled).
    return pagerGesture ? g.blocksExternalGesture(pagerGesture) : g
  }, [
    dragging,
    mp,
    trackW,
    lastBucket,
    lastColorPos,
    flare,
    stableCommit,
    stablePersist,
    stableSetDrag,
    pagerGesture,
    centered,
  ])

  // Tap: tocar la barra fija ESA posición y guarda (incluido NEUTRAL). Sin esto,
  // dejar el thumb en neutral sin arrastrar nunca disparaba el guardado ni el
  // brillo (el Pan exige 6px de movimiento). Ahora un toque basta.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(centered)
        .maxDuration(260)
        .maxDistance(12)
        .onEnd((e) => {
          const w = trackW.value
          if (w <= 0) return
          const p = (e.x - THUMB / 2) / (w - THUMB)
          const clamped = p < 0 ? 0 : p > 1 ? 1 : p
          const b = bucketOf(clamped)
          const target = BUCKET_MP[b] ?? 0.5
          mp.value = withSpring(target, { damping: 18, stiffness: 130, mass: 0.7 })
          lastBucket.value = b
          lastColorPos.value = target
          runOnJS(setColorPos)(target)
          runOnJS(stableCommit)(b)
          // Mismo destello de confirmación que al soltar un arrastre.
          flare.value = withSequence(
            withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 640, easing: Easing.inOut(Easing.sin) }),
          )
          runOnJS(stablePersist)(b)
        }),
    [mp, trackW, lastBucket, lastColorPos, flare, stableCommit, stablePersist, centered],
  )

  // Pan tiene prioridad (arrastre); si el toque no se convierte en arrastre,
  // gana el Tap → neutral también se guarda con un toque.
  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap])

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: mp.value * (trackW.value - THUMB) },
      { scale: 1 + dragging.value * 0.18 },
    ],
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: mp.value * trackW.value,
  }))
  // Destello: el glow crece + sube opacidad, el glifo pulsa al guardar.
  const flareGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + flare.value * 0.6,
    transform: [{ scale: 1 + flare.value * 0.18 }],
  }))
  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + dragging.value * 0.06 + flare.value * 0.08 }],
  }))

  const glow = lerpGlow(colorPos)
  const onTrackLayout = (e: LayoutChangeEvent): void => {
    trackW.value = e.nativeEvent.layout.width
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.glyphRow}>
        <View style={styles.glyphWrap}>
          {/* Glow difuso detrás del glifo (SVG radial, color JS → crash-safe).
              Su opacidad/escala pulsan con el flare al guardar. */}
          <Animated.View style={[StyleSheet.absoluteFill, flareGlowStyle]} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="mood-inline-glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={glow} stopOpacity={0.55} />
                  <Stop offset="0.5" stopColor={glow} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={glow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#mood-inline-glow)" />
            </Svg>
          </Animated.View>
          <Animated.Image source={GLYPH} style={[styles.glyph, glyphStyle]} resizeMode="contain" />
        </View>
        <View style={styles.readout}>
          <Text style={styles.label}>{BUCKETS[bucket]?.label}</Text>
          <Text style={styles.hint}>
            {justSaved ? 'Ánimo guardado' : 'Desliza para marcar cómo estás'}
          </Text>
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        {/* hitSlop vertical para que el thumb sea fácil de agarrar. */}
        <View style={styles.trackHit} hitSlop={{ top: 14, bottom: 14 }}>
          <View style={styles.track} onLayout={onTrackLayout}>
            <Animated.View style={[styles.fill, fillStyle, { backgroundColor: glow }]} />
            <Animated.View style={[styles.thumb, thumbStyle, { backgroundColor: glow }]} />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.scale}>
        <Text style={styles.scaleEnd}>Difícil</Text>
        <Text style={styles.scaleEnd}>Bien</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  glyphWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: 52,
    height: 52,
  },
  readout: {
    flex: 1,
  },
  label: {
    fontFamily: typography.displaySemi,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.leche,
  },
  hint: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.niebla,
  },
  trackHit: {
    paddingVertical: 6,
  },
  track: {
    height: THUMB,
    borderRadius: 999,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: THUMB,
    borderRadius: 999,
    opacity: 0.28,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 999,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleEnd: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.bruma,
  },
})

import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  Path as SkiaPath,
  Skia,
} from '@shopify/react-native-skia'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Path as SvgPath, Defs, RadialGradient, Stop } from 'react-native-svg'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors, typography } from '@/theme'

import type { PresenceSummary } from '../month-built'

/*
 * "Tu presencia" — el cierre de Órbita Mes. NO es una barra de progreso: es un
 * HILO que se TEJE. Una estrella (tu presencia) nace a la izquierda y avanza; el
 * hilo NACE detrás de ella (Skia trim del path, no un fade), como dejando una
 * hebra luminosa. Los días aparecen como memoria SOLO cuando la estrella ya pasó.
 * El hilo tiene una micro-curva viva y una respiración < 2px. Al llegar, la
 * estrella pulsa y el hilo hace un rebote elástico ("la cuerda quedó tensa").
 *
 * Filosofía: la presencia nunca empieza de cero, siempre continúa. Las ausencias
 * NO cortan el hilo — solo dejan puntos apagados. La estrella nunca retrocede.
 *
 * Tipografía: eyebrow + leyenda en Hanken; headline/afirmación/cierre en serif
 * italic (voz de coach). Contemplativo, sin gamificación, sin confetti.
 */

const TRAIL_MIN_DAYS = 4
const STAR_BOX = 168

// Coreografía (ms), contemplativa (~3 s hasta los mensajes).
const LEDE_DELAY = 340
const STAR_BIRTH = 850 // la estrella nace (fade + glow)
const WEAVE_DELAY = 1240 // y empieza a tejer
const WEAVE_MS = 1850
const ARRIVE = WEAVE_DELAY + WEAVE_MS
const MSG_BASE = ARRIVE + 220

/** La afirmación cálida que reemplaza al número (un mensaje, no una métrica). */
function affirmation(presence: PresenceSummary): string {
  if (presence.presentDays < TRAIL_MIN_DAYS)
    return 'Apenas empieza. Lo que vuelvas a hacer, se queda.'
  if (presence.returns === 0) return 'Apareciste sin interrupciones.'
  const maxGap = presence.trail.reduce((m, s) => (!s.present ? Math.max(m, s.length) : m), 0)
  if (maxGap >= 3) return 'Volviste. Eso también es presencia.'
  return 'Volver también cuenta.'
}

export function PresenceFinale({
  presence,
  phrase,
}: {
  presence: PresenceSummary
  phrase: string | null
}) {
  const enoughForTrail = presence.presentDays >= TRAIL_MIN_DAYS && presence.trail.length > 0
  const closing =
    enoughForTrail && presence.returns === 0 ? 'El hilo no se cortó este mes.' : phrase

  // Los mensajes entran DESPUÉS de que el hilo terminó de tejerse (cascada).
  const legendDelay = enoughForTrail ? MSG_BASE : 620
  const affirmDelay = legendDelay + 260
  const closeDelay = affirmDelay + 260

  return (
    <Animated.View entering={FadeIn.duration(560)} style={styles.card}>
      <BgStars />

      <Animated.Text entering={FadeIn.duration(440).delay(140)} style={styles.eyebrow}>
        Tu presencia
      </Animated.Text>
      <Animated.Text entering={FadeInDown.duration(560).delay(LEDE_DELAY)} style={styles.lede}>
        Volver también es parte de esto.
      </Animated.Text>

      {enoughForTrail ? <PresenceThread trail={presence.trail} /> : <SoloStar />}

      {enoughForTrail ? (
        <Animated.Text entering={FadeInDown.duration(520).delay(legendDelay)} style={styles.legend}>
          Cada punto, un día que apareciste.
        </Animated.Text>
      ) : null}

      <Animated.Text
        entering={FadeInDown.duration(560).delay(affirmDelay)}
        style={styles.affirmation}
      >
        {affirmation(presence)}
      </Animated.Text>

      {closing ? (
        <Animated.Text entering={FadeInDown.duration(560).delay(closeDelay)} style={styles.phrase}>
          {closing}
        </Animated.Text>
      ) : null}
    </Animated.View>
  )
}

/* ── Estrellas de fondo que flotan muy lento ──────────────────────────── */

const BG_STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 0.12, y: 0.14, r: 1.1, o: 0.5 },
  { x: 0.82, y: 0.1, r: 1.4, o: 0.6 },
  { x: 0.5, y: 0.06, r: 0.9, o: 0.4 },
  { x: 0.9, y: 0.44, r: 1.0, o: 0.45 },
  { x: 0.08, y: 0.5, r: 1.3, o: 0.5 },
  { x: 0.7, y: 0.86, r: 1.0, o: 0.4 },
  { x: 0.2, y: 0.9, r: 1.2, o: 0.5 },
]

function BgStars() {
  const active = useScreenActive()
  const reduce = useReducedMotion() ?? false
  const drift = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(drift)
    if (!active || reduce) {
      drift.value = 0.5
      return
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(drift)
  }, [active, reduce, drift])

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 + drift.value * 0.5,
    transform: [{ translateY: -2 + drift.value * 4 }],
  }))

  return (
    <Animated.View style={[styles.bgStars, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        {BG_STARS.map((s, i) => (
          <Circle
            key={i}
            cx={`${s.x * 100}%`}
            cy={`${s.y * 100}%`}
            r={s.r}
            fill={colors.leche}
            opacity={s.o}
          />
        ))}
      </Svg>
    </Animated.View>
  )
}

/* ── El hilo que se teje (Skia) ───────────────────────────────────────── */

const TRAIL_H = 108
const PAD_X = 24
const CURVE = 6 // micro-curva, casi imperceptible (cuerda viva)
const STAR_SAMPLES = 120 // muestras del path para la posición de la estrella
const CLAMP = Extrapolation.CLAMP

type TrailDay = { idx: number; present: boolean; isReturn: boolean }

/** Aplana el RLE a días con flag de regreso. */
function buildDays(trail: PresenceSummary['trail']): TrailDay[] {
  const days: TrailDay[] = []
  let idx = 0
  let presentBlocks = 0
  for (const seg of trail) {
    if (seg.present) {
      presentBlocks += 1
      const returnBlock = presentBlocks >= 2
      for (let j = 0; j < seg.length; j++) {
        days.push({ idx, present: true, isReturn: returnBlock && j === 0 })
        idx += 1
      }
    } else {
      for (let j = 0; j < seg.length; j++) {
        days.push({ idx, present: false, isReturn: false })
        idx += 1
      }
    }
  }
  return days
}

function PresenceThread({ trail }: { trail: PresenceSummary['trail'] }) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const days = useMemo(() => buildDays(trail), [trail])
  const span = days.length

  const active = useScreenActive()
  const reduce = useReducedMotion() ?? false

  // El path (micro-curva S), su path Skia, longitud y muestras.
  const cy = TRAIL_H / 2
  const linePath = useMemo(() => {
    if (w <= 0) return null
    const d = `M${PAD_X},${cy} C${w * 0.3},${cy - CURVE} ${w * 0.7},${cy + CURVE} ${w - PAD_X},${cy}`
    return Skia.Path.MakeFromSVGString(d)
  }, [w, cy])
  const starPath = useMemo(() => Skia.Path.MakeFromSVGString(fourPointStarPath(0, 0, 7)), [])

  // Muestras por FRACCIÓN DE LONGITUD (mismo espacio que el trim `end`): la
  // estrella recorre exactamente el hilo trazado.
  const starPts = useMemo<{ x: number; y: number }[]>(() => {
    if (!linePath) return []
    const it = Skia.ContourMeasureIter(linePath, false, 1)
    const c = it.next()
    if (!c) return []
    const len = c.length()
    const out: { x: number; y: number }[] = []
    for (let i = 0; i <= STAR_SAMPLES; i++) {
      const [pos] = c.getPosTan((len * i) / STAR_SAMPLES)
      out.push({ x: pos.x, y: pos.y })
    }
    return out
  }, [linePath])

  // Posición de cada día a su fracción de longitud.
  const dayPts = useMemo<{ x: number; y: number }[]>(() => {
    if (!linePath || span === 0) return []
    const it = Skia.ContourMeasureIter(linePath, false, 1)
    const c = it.next()
    if (!c) return []
    const len = c.length()
    return days.map((d) => {
      const frac = span > 1 ? d.idx / (span - 1) : 0.5
      const [pos] = c.getPosTan(len * frac)
      return { x: pos.x, y: pos.y }
    })
  }, [linePath, days, span])

  // Coreografía. `weave` teje el hilo (trim end) y mueve la estrella; guarda por
  // VALOR (si se canceló antes de terminar, al volver redibuja). Reduced → final.
  const starIn = useSharedValue(0) // nacimiento de la estrella (fade)
  const weave = useSharedValue(0) // el tejido (0→1)
  const pulse = useSharedValue(0) // pulse de llegada
  const bounce = useSharedValue(0) // rebote elástico de la cuerda
  const breath = useSharedValue(0) // respiración < 2px

  useEffect(() => {
    if (reduce) {
      starIn.value = 1
      weave.value = 1
      return
    }
    if (!active || weave.value >= 1) return
    starIn.value = withDelay(STAR_BIRTH, withTiming(1, { duration: 480 }))
    weave.value = withDelay(
      WEAVE_DELAY,
      withTiming(1, { duration: WEAVE_MS, easing: Easing.inOut(Easing.ease) }),
    )
    pulse.value = withDelay(
      ARRIVE - 40,
      withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 520, easing: Easing.inOut(Easing.sin) }),
      ),
    )
    // Rebote elástico: la cuerda se tensa al quedar completa (< 2px).
    bounce.value = withDelay(
      ARRIVE - 20,
      withSequence(
        withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 620, easing: Easing.elastic(1.4) }),
      ),
    )
    return () => {
      cancelAnimation(starIn)
      cancelAnimation(weave)
      cancelAnimation(pulse)
      cancelAnimation(bounce)
    }
  }, [active, reduce, starIn, weave, pulse, bounce])

  // Respiración continua del hilo (< 2px), gateada.
  useEffect(() => {
    cancelAnimation(breath)
    if (!active || reduce) {
      breath.value = 0.5
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [active, reduce, breath])

  // Wobble compartido (respiración + rebote), en px, aplicado como translateY.
  const wobble = useDerivedValue(() => (breath.value - 0.5) * 1.6 - bounce.value * 1.9)
  const threadTransform = useDerivedValue(() => [{ translateY: wobble.value }])

  // La estrella recorre las muestras según `weave`; hereda el wobble + pulse.
  const starTransform = useDerivedValue(() => {
    if (starPts.length === 0) return [{ translateX: -100 }, { translateY: -100 }, { scale: 1 }]
    const t = Math.min(1, Math.max(0, weave.value))
    const f = t * STAR_SAMPLES
    const i0 = Math.floor(f)
    const i1 = Math.min(i0 + 1, STAR_SAMPLES)
    const k = f - i0
    const sx = starPts[i0]!.x + (starPts[i1]!.x - starPts[i0]!.x) * k
    const sy = starPts[i0]!.y + (starPts[i1]!.y - starPts[i0]!.y) * k
    const scale = 1 + pulse.value * 0.45 + breath.value * 0.05
    return [{ translateX: sx }, { translateY: sy + wobble.value }, { scale }]
  })
  const weaveEnd = useDerivedValue(() => Math.max(0.001, weave.value))
  const starOpacity = useDerivedValue(() => starIn.value)
  const haloOpacity = useDerivedValue(() => starIn.value * (0.4 + pulse.value * 0.5))

  return (
    <View style={styles.trailBlock}>
      <View style={styles.trailWrap} onLayout={onLayout}>
        {w > 0 && linePath ? (
          <Canvas style={{ width: w, height: TRAIL_H }}>
            <SkiaGroup transform={threadTransform}>
              {/* El hilo: NACE detrás de la estrella (trim start→end). Continuo:
                  las ausencias se leen en los puntos, nunca en la línea. */}
              <SkiaPath
                path={linePath}
                style="stroke"
                strokeWidth={1.7}
                strokeCap="round"
                color={colors.oroSoft}
                opacity={0.72}
                start={0}
                end={weaveEnd}
              >
                <BlurMask blur={1.4} style="solid" />
              </SkiaPath>

              {/* Los días: memoria que aparece cuando la estrella ya pasó. */}
              {days.map((d, i) =>
                d.isReturn ? (
                  <ReturnDot
                    key={`r-${d.idx}`}
                    p={dayPts[i]!}
                    frac={frac(d.idx, span)}
                    weave={weave}
                  />
                ) : (
                  <DayDot
                    key={`d-${d.idx}`}
                    p={dayPts[i]!}
                    frac={frac(d.idx, span)}
                    present={d.present}
                    weave={weave}
                  />
                ),
              )}
            </SkiaGroup>

            {/* La estrella (presencia): halo + núcleo, recorre el hilo. */}
            <SkiaGroup transform={starTransform}>
              <SkiaCircle cx={0} cy={0} r={13} color={colors.magenta} opacity={haloOpacity}>
                <BlurMask blur={12} style="normal" />
              </SkiaCircle>
              {starPath ? (
                <SkiaPath path={starPath} color={colors.leche} opacity={starOpacity}>
                  <BlurMask blur={1} style="solid" />
                </SkiaPath>
              ) : null}
              <SkiaCircle cx={0} cy={0} r={1.8} color="#FFFFFF" opacity={starOpacity} />
            </SkiaGroup>
          </Canvas>
        ) : null}
      </View>
    </View>
  )
}

function frac(idx: number, span: number): number {
  return span > 1 ? idx / (span - 1) : 0.5
}

/** Un día: aparece (opacity 0→1, scale 0.6→1) cuando la estrella ya pasó. */
function DayDot({
  p,
  frac: f,
  present,
  weave,
}: {
  p: { x: number; y: number }
  frac: number
  present: boolean
  weave: SharedValue<number>
}) {
  const r = useDerivedValue(() => {
    const appear = interpolate(weave.value, [f, f + 0.06], [0, 1], CLAMP)
    return (present ? 2.1 : 1.7) * (0.6 + appear * 0.4)
  })
  const op = useDerivedValue(() => {
    const appear = interpolate(weave.value, [f, f + 0.06], [0, 1], CLAMP)
    return (present ? 0.78 : 0.28) * appear
  })
  return (
    <SkiaCircle
      cx={p.x}
      cy={p.y}
      r={r}
      color={present ? colors.oroSoft : colors.niebla}
      opacity={op}
    />
  )
}

/** Un regreso: estrella magenta que aparece (con más brillo) cuando la guía pasa. */
function ReturnDot({
  p,
  frac: f,
  weave,
}: {
  p: { x: number; y: number }
  frac: number
  weave: SharedValue<number>
}) {
  const haloR = useDerivedValue(() => interpolate(weave.value, [f, f + 0.06], [0, 9], CLAMP))
  const op = useDerivedValue(() => interpolate(weave.value, [f, f + 0.06], [0, 1], CLAMP))
  const path = useMemo(
    () => Skia.Path.MakeFromSVGString(fourPointStarPath(p.x, p.y, 5)),
    [p.x, p.y],
  )
  return (
    <>
      <SkiaCircle cx={p.x} cy={p.y} r={haloR} color={colors.magenta} opacity={op}>
        <BlurMask blur={6} style="normal" />
      </SkiaCircle>
      {path ? <SkiaPath path={path} color="#FFFFFF" opacity={op} /> : null}
    </>
  )
}

/* ── Cierre de un solo astro (poca data) ─────────────────────────────── */
function SoloStar() {
  const c = STAR_BOX / 2
  const active = useScreenActive()
  const reduce = useReducedMotion() ?? false
  const breath = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(breath)
    if (!active || reduce) {
      breath.value = withTiming(0, { duration: 500 })
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [active, reduce, breath])
  const style = useAnimatedStyle(() => ({
    opacity: 0.82 + breath.value * 0.18,
    transform: [{ scale: 0.97 + breath.value * 0.06 }],
  }))

  return (
    <Animated.View style={[styles.starWrap, style]} pointerEvents="none">
      <Svg width={STAR_BOX} height={STAR_BOX}>
        <Defs>
          <RadialGradient id="presence-solo-halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity={0.24} />
            <Stop offset="42%" stopColor={colors.magenta} stopOpacity={0.09} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="presence-solo-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.oroLight} stopOpacity={0.5} />
            <Stop offset="60%" stopColor={colors.oro} stopOpacity={0.1} />
            <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#presence-solo-halo)" />
        <Circle cx={c} cy={c} r={c * 0.42} fill="url(#presence-solo-bloom)" />
        <SvgPath d={fourPointStarPath(c, c, 34)} fill={colors.oroLight} opacity={0.62} />
        <Circle cx={c} cy={c} r={2.2} fill={colors.leche} opacity={0.9} />
      </Svg>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 40,
    borderRadius: 26,
    paddingVertical: 40,
    paddingHorizontal: 26,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  bgStars: {
    ...StyleSheet.absoluteFillObject,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  lede: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 23,
    lineHeight: 31,
    color: colors.leche,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  trailBlock: {
    marginTop: 26,
    width: '100%',
  },
  trailWrap: {
    width: '100%',
    height: TRAIL_H,
  },
  legend: {
    marginTop: 14,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textAlign: 'center',
  },
  affirmation: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 25,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  starWrap: {
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phrase: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 26,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
})

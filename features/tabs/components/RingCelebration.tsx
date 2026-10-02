import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Rect,
  usePathValue,
  vec,
  type SkPath,
} from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { CelebratePayload } from '../celebrate-bus'

/*
 * RingCelebration · la celebración de "Entrené" (dueña 30 sep 2026: "algo más
 * integrado, como el de Apple al cerrar el anillo").
 *
 * Toma la pantalla: todo se oscurece MENOS el emblema, que sigue viéndose
 * dentro de su anillo. El anillo se vuelve una corona (núcleo blanco, halo
 * magenta) y suelta cientos de chispas finas, tangentes al giro, que luego
 * caen con gravedad como lluvia. Nuestro toque: al final, unas chispas de oro
 * regresan al corazón del emblema y destellan (el entreno se vuelve luz). El
 * texto de abajo dice el hecho y, en la voz del coach, qué significa.
 *
 * Física analítica por chispa (sin estado por frame): nace en un punto del
 * anillo en su instante, sale con velocidad tangente + radial y cae con g. Las
 * estelas son el segmento entre la posición y la posición un instante antes
 * (motion blur natural). Se agrupan por color y edad en pocos caminos que se
 * rehacen por frame (usePathValue). Colores ESTÁTICOS; se anima solo
 * geometría y opacidad (animar colores de Skia crashea en device). Todo
 * helper del hilo de UI lleva 'worklet' (sin él revienta el APK de release).
 */

const DURATION_MS = 3400
// Android pinta las estelas con blur más pesadas que iOS (dueña 1 oct 2026:
// "arregla el estilo solo en Android"): menos chispas y halos más finos ahí.
const ANDROID = Platform.OS === 'android'
const N = ANDROID ? 1100 : 1800
/** Fracción de la duración en la que el anillo sigue soltando chispas. */
const EMIT_UNTIL = 0.72
const GRAVITY = 520 // px/s²
const TAIL_S = 0.04
const HOMING = ANDROID ? 150 : 220

const CORE = colors.oroLeche

type Sparks = {
  theta: number[]
  born: number[] // s desde el inicio
  life: number[] // s
  vt: number[] // px/s tangente
  vr: number[] // px/s radial
  tone: number[] // 0 blanco · 1 magenta · 2 oro
}

function rng(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildSparks(seed: number): Sparks {
  const r = rng(seed)
  const out: Sparks = { theta: [], born: [], life: [], vt: [], vr: [], tone: [] }
  const emitS = (DURATION_MS / 1000) * EMIT_UNTIL
  for (let i = 0; i < N; i++) {
    out.theta.push(r() * Math.PI * 2)
    // Más densidad al principio (el estallido), luego un goteo.
    out.born.push(emitS * Math.pow(r(), 1.5))
    // Casi la mitad es CORONA: chispas cortas y lentas pegadas al anillo que
    // lo hacen ver espeso y vivo (lo que da el look de Apple). El resto es
    // la lluvia que sale disparada y cae.
    const corona = r() < 0.55
    out.life.push(corona ? 0.14 + r() * 0.26 : 0.6 + r() * 0.9)
    out.vt.push(corona ? 50 + r() * 120 : 130 + r() * 300)
    out.vr.push(corona ? 8 + r() * 60 : 60 + r() * 260)
    const c = r()
    // Magenta manda (la marca); blanco solo como núcleo caliente; oro, pizca.
    out.tone.push(corona ? (c < 0.22 ? 0 : c < 0.85 ? 1 : 2) : c < 0.1 ? 0 : c < 0.76 ? 1 : 2)
  }
  return out
}

type Geo = { cx: number; cy: number; r: number; tx: number; ty: number }

/** Estelas del grupo (tono, edad) en el segundo T. edad: 0 joven · 1 vieja. */
function drawSparks(path: SkPath, T: number, tone: number, old: number, s: Sparks, g: Geo): void {
  'worklet'
  for (let i = 0; i < N; i++) {
    if (s.tone[i] !== tone) continue
    const tau = T - s.born[i]!
    const life = s.life[i]!
    if (tau <= 0 || tau >= life) continue
    const isOld = tau / life > 0.55 ? 1 : 0
    if (isOld !== old) continue
    const th = s.theta[i]!
    const ct = Math.cos(th)
    const st = Math.sin(th)
    // Punto del anillo + velocidad tangente (giro horario) + radial.
    const vx = -st * s.vt[i]! + ct * s.vr[i]!
    const vy = ct * s.vt[i]! + st * s.vr[i]!
    const x0 = g.cx + ct * g.r
    const y0 = g.cy + st * g.r
    const x = x0 + vx * tau
    const y = y0 + vy * tau + 0.5 * GRAVITY * tau * tau
    const tp = tau - TAIL_S < 0 ? 0 : tau - TAIL_S
    const xt = x0 + vx * tp
    const yt = y0 + vy * tp + 0.5 * GRAVITY * tp * tp
    path.moveTo(xt, yt)
    path.lineTo(x, y)
  }
}

type Homing = {
  theta: number[]
  from: number[] // múltiplo del radio del anillo donde nace
  lag: number[] // retraso (fracción de la fase)
  tail: number[] // largo de la estela (fracción de su vida)
  bend: number[] // cuánto se curva (con el giro)
  tone: number[] // 0 magenta · 1 oro · 2 crema
}

function buildHoming(seed: number): Homing {
  const r = rng(seed)
  const h: Homing = { theta: [], from: [], lag: [], tail: [], bend: [], tone: [] }
  for (let i = 0; i < HOMING; i++) {
    h.theta.push(r() * Math.PI * 2)
    h.from.push(0.95 + r() * 0.75)
    h.lag.push(Math.pow(r(), 1.4) * 0.45)
    h.tail.push(0.025 + r() * 0.05)
    h.bend.push(0.12 + r() * 0.35)
    const c = r()
    h.tone.push(c < 0.55 ? 0 : c < 0.88 ? 1 : 2)
  }
  return h
}

/** El regreso: un enjambre de chispas que sale del anillo (y de más allá),
 *  se curva con el giro y cae en la estrella del corazón en goteo (u 0..1). */
function drawHoming(path: SkPath, u: number, tone: number, h: Homing, g: Geo): void {
  'worklet'
  if (u <= 0 || u >= 1.2) return
  for (let i = 0; i < HOMING; i++) {
    if (h.tone[i] !== tone) continue
    const span = 1 - h.lag[i]!
    const v = (u - h.lag[i]!) / (span * 0.8)
    if (v <= 0 || v >= 1) continue
    const th = h.theta[i]!
    const sx = g.cx + Math.cos(th) * g.r * h.from[i]!
    const sy = g.cy + Math.sin(th) * g.r * h.from[i]!
    const nx = -Math.sin(th)
    const ny = Math.cos(th)
    const bend = h.bend[i]! * g.r
    const at = (w: number): [number, number] => {
      'worklet'
      const e = w < 0 ? 0 : w > 1 ? 1 : w
      const ease = e * e * (3 - 2 * e)
      const b = Math.sin(ease * Math.PI) * bend
      return [sx + (g.tx - sx) * ease + nx * b, sy + (g.ty - sy) * ease + ny * b]
    }
    const [x1, y1] = at(v)
    const [x0, y0] = at(v - h.tail[i]!)
    path.moveTo(x0, y0)
    path.lineTo(x1, y1)
  }
}

/* ── Las estrellas (lo nuestro): destellos de cuatro puntas ─────────── */

const STARS = ANDROID ? 48 : 72

type Stars = { ang: number[]; dist: number[]; born: number[]; life: number[]; size: number[] }

function buildStars(seed: number): Stars {
  const r = rng(seed)
  const st: Stars = { ang: [], dist: [], born: [], life: [], size: [] }
  for (let i = 0; i < STARS; i++) {
    st.ang.push(r() * Math.PI * 2)
    // Casi todas cerca del anillo (dentro y fuera); algunas lejos, en la lluvia.
    st.dist.push(r() < 0.75 ? 0.82 + r() * 0.45 : 1.3 + r() * 0.7)
    st.born.push(0.06 + r() * 0.62)
    st.life.push(0.14 + r() * 0.2)
    st.size.push(6 + r() * 11)
  }
  return st
}

/** Cada estrella nace, crece (seno) y se apaga en su ventana de t. */
function drawStars(path: SkPath, T: number, st: Stars, g: Geo): void {
  'worklet'
  for (let i = 0; i < STARS; i++) {
    const u = (T - st.born[i]!) / st.life[i]!
    if (u <= 0 || u >= 1) continue
    const R = st.size[i]! * Math.sin(u * Math.PI)
    if (R < 0.6) continue
    const x = g.cx + Math.cos(st.ang[i]!) * g.r * st.dist[i]!
    const y = g.cy + Math.sin(st.ang[i]!) * g.r * st.dist[i]!
    const k = R * 0.2
    // Estrella de cuatro puntas (la misma silueta de la app): 8 vértices.
    path.moveTo(x, y - R)
    path.lineTo(x + k, y - k)
    path.lineTo(x + R, y)
    path.lineTo(x + k, y + k)
    path.lineTo(x, y + R)
    path.lineTo(x - k, y + k)
    path.lineTo(x - R, y)
    path.lineTo(x - k, y - k)
    path.close()
  }
}

export const RingCelebration = memo(function RingCelebration({
  payload,
  playKey,
  onDone,
}: {
  payload: CelebratePayload
  playKey: number
  onDone: () => void
}) {
  const { width, height } = useWindowDimensions()
  const t = useSharedValue(0)
  const sparks = useMemo(() => buildSparks(playKey * 7919 + 31), [playKey])
  // El emblema se midió en coordenadas de VENTANA; esta capa puede no empezar
  // en (0,0) (Android de borde a borde corre la barra de estado). Se mide el
  // propio origen y se resta: la corona cae justo sobre el anillo en ambas.
  const rootRef = useRef<View>(null)
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null)
  const ox = origin?.x ?? 0
  const oy = origin?.y ?? 0
  const g: Geo = {
    cx: payload.cx - ox,
    cy: payload.cy - oy,
    r: payload.r,
    tx: payload.tx - ox,
    ty: payload.ty - oy,
  }

  useEffect(() => {
    if (!origin) return
    t.value = 0
    t.value = withTiming(1, { duration: DURATION_MS, easing: Easing.linear }, (done) => {
      if (done) runOnJS(onDone)()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey, origin != null])

  // El segundo golpe: cuando el oro llega a la estrella del corazón (el primero
  // ya sonó al tocar "Entrené"), como Apple al cerrar el anillo.
  const finaleHaptic = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  }
  useAnimatedReaction(
    () => t.value >= 0.84,
    (now, prev) => {
      if (now && prev === false) runOnJS(finaleHaptic)()
    },
  )

  const secs = DURATION_MS / 1000
  const white0 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 0, 0, sparks, g)
  })
  const white1 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 0, 1, sparks, g)
  })
  const pink0 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 1, 0, sparks, g)
  })
  const pink1 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 1, 1, sparks, g)
  })
  const gold0 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 2, 0, sparks, g)
  })
  const gold1 = usePathValue((p) => {
    'worklet'
    drawSparks(p, t.value * secs, 2, 1, sparks, g)
  })
  const homingSparks = useMemo(() => buildHoming(playKey * 104729 + 7), [playKey])
  const stars = useMemo(() => buildStars(playKey * 15485863 + 3), [playKey])
  const starPath = usePathValue((p) => {
    'worklet'
    drawStars(p, t.value, stars, g)
  })
  const homingPink = usePathValue((p) => {
    'worklet'
    drawHoming(p, (t.value - 0.5) / 0.4, 0, homingSparks, g)
  })
  const homingGold = usePathValue((p) => {
    'worklet'
    drawHoming(p, (t.value - 0.5) / 0.4, 1, homingSparks, g)
  })
  const homingCream = usePathValue((p) => {
    'worklet'
    drawHoming(p, (t.value - 0.5) / 0.4, 2, homingSparks, g)
  })

  // El telón: entra rápido, se va al final.
  const scrim = useDerivedValue(() => {
    const v = t.value
    if (v < 0.07) return v / 0.07
    if (v > 0.86) return Math.max(0, (1 - v) / 0.14)
    return 1
  })
  // La corona: enciende fuerte al estallar y queda encendida suave.
  const crown = useDerivedValue(() => {
    const v = t.value
    if (v < 0.08) return v / 0.08
    if (v < 0.3) return 1 - 0.35 * ((v - 0.08) / 0.22)
    if (v > 0.8) return 0.65 * Math.max(0, (1 - v) / 0.2)
    return 0.65
  })
  const sparkOp = useDerivedValue(() => (t.value > 0.9 ? Math.max(0, (1 - t.value) / 0.1) : 1))
  const heart = useDerivedValue(() => {
    const v = t.value
    if (v < 0.84 || v > 0.99) return 0
    return Math.sin(((v - 0.84) / 0.15) * Math.PI)
  })
  const heartR = useDerivedValue(() => 8 + 40 * Math.max(0, (t.value - 0.84) / 0.15))
  const textStyle = useAnimatedStyle(() => {
    const v = t.value
    const o = v < 0.22 ? 0 : v < 0.34 ? (v - 0.22) / 0.12 : v > 0.86 ? (1 - v) / 0.14 : 1
    return { opacity: Math.max(0, o), transform: [{ translateY: (1 - Math.min(1, o)) * 8 }] }
  })

  const hole = g.r * 0.92
  const edge = g.r * 1.22
  const far = Math.hypot(Math.max(g.cx, width - g.cx), Math.max(g.cy, height - g.cy))

  return (
    <View
      ref={rootRef}
      style={StyleSheet.absoluteFill}
      collapsable={false}
      onLayout={() => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={`${payload.title}. ${payload.subtitle ?? ''} Toca para cerrar.`}
      >
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Telón con hueco: el emblema sigue visible dentro de su anillo. */}
          <Group opacity={scrim}>
            <Rect x={0} y={0} width={width} height={height}>
              <RadialGradient
                c={vec(g.cx, g.cy)}
                r={far}
                colors={['rgba(5,2,4,0)', 'rgba(5,2,4,0)', 'rgba(5,2,4,0.9)', 'rgba(5,2,4,0.94)']}
                positions={[0, hole / far, edge / far, 1]}
              />
            </Rect>
          </Group>

          {/* La corona del anillo: una BANDA de luz de dos tonos (dueña: "más
            grueso, dorados y magenta"). Halo magenta ancho afuera, banda
            magenta hacia fuera y banda de oro hacia dentro que se funden en el
            borde, y un núcleo crema que la hace arder. Colores estáticos. */}
          <Group opacity={crown}>
            <Circle
              cx={g.cx}
              cy={g.cy}
              r={g.r + 6}
              color={colors.magenta}
              style="stroke"
              strokeWidth={ANDROID ? 26 : 46}
              opacity={ANDROID ? 0.28 : 0.4}
            >
              <BlurMask blur={ANDROID ? 22 : 34} style="normal" />
            </Circle>
            <Circle
              cx={g.cx}
              cy={g.cy}
              r={g.r + 4}
              color={colors.magenta}
              style="stroke"
              strokeWidth={14}
              opacity={0.85}
            >
              <BlurMask blur={11} style="normal" />
            </Circle>
            <Circle
              cx={g.cx}
              cy={g.cy}
              r={g.r - 4}
              color={colors.oroSoft}
              style="stroke"
              strokeWidth={11}
              opacity={0.7}
            >
              <BlurMask blur={9} style="normal" />
            </Circle>
            <Circle
              cx={g.cx}
              cy={g.cy}
              r={g.r}
              color={CORE}
              style="stroke"
              strokeWidth={3}
              opacity={0.75}
            >
              <BlurMask blur={3.5} style="normal" />
            </Circle>
          </Group>

          {/* Las chispas: finas, con estela; las viejas más tenues. Las
            magenta se dibujan dos veces sobre el MISMO camino: un halo
            difuso detrás de una línea nítida, así destellan sin costo extra. */}
          <Group opacity={sparkOp} blendMode="plus">
            <Path
              path={pink0}
              style="stroke"
              strokeWidth={ANDROID ? 2.4 : 4}
              strokeCap="round"
              color={colors.magenta}
              opacity={ANDROID ? 0.4 : 0.55}
            >
              <BlurMask blur={5} style="normal" />
            </Path>
            <Path
              path={pink0}
              style="stroke"
              strokeWidth={1.4}
              strokeCap="round"
              color={colors.magenta}
            />
            <Path
              path={pink1}
              style="stroke"
              strokeWidth={3}
              strokeCap="round"
              color={colors.magenta}
              opacity={0.3}
            >
              <BlurMask blur={4} style="normal" />
            </Path>
            <Path
              path={pink1}
              style="stroke"
              strokeWidth={1.1}
              strokeCap="round"
              color={colors.magenta}
              opacity={0.6}
            />
            <Path path={white0} style="stroke" strokeWidth={1.1} strokeCap="round" color={CORE} />
            <Path
              path={white1}
              style="stroke"
              strokeWidth={0.9}
              strokeCap="round"
              color={CORE}
              opacity={0.4}
            />
            <Path
              path={gold0}
              style="stroke"
              strokeWidth={1.1}
              strokeCap="round"
              color={colors.oroLight}
            />
            <Path
              path={gold1}
              style="stroke"
              strokeWidth={0.9}
              strokeCap="round"
              color={colors.oroLight}
              opacity={0.4}
            />
          </Group>

          {/* Nuestro toque: el enjambre regresa a la estrella del corazón (magenta
            con oro, pizca de crema) y ahí destella. */}
          <Group blendMode="plus">
            <Path
              path={homingPink}
              style="stroke"
              strokeWidth={ANDROID ? 2.4 : 4}
              strokeCap="round"
              color={colors.magenta}
              opacity={ANDROID ? 0.38 : 0.5}
            >
              <BlurMask blur={5} style="normal" />
            </Path>
            <Path
              path={homingPink}
              style="stroke"
              strokeWidth={1.3}
              strokeCap="round"
              color={colors.magenta}
            />
            <Path
              path={homingGold}
              style="stroke"
              strokeWidth={1.1}
              strokeCap="round"
              color={colors.oroLight}
            >
              <BlurMask blur={1.5} style="solid" />
            </Path>
            <Path
              path={homingCream}
              style="stroke"
              strokeWidth={0.9}
              strokeCap="round"
              color={CORE}
            />
          </Group>
          {/* Destellos de estrella entre las chispas: halo magenta + centro crema. */}
          <Group blendMode="plus">
            <Path path={starPath} color={colors.magenta} opacity={0.8}>
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path path={starPath} color={CORE} />
          </Group>
          <Group opacity={heart}>
            <Circle cx={g.tx} cy={g.ty} r={heartR} color={colors.oroLight} opacity={0.35}>
              <BlurMask blur={16} style="normal" />
            </Circle>
            <Circle cx={g.tx} cy={g.ty} r={4} color={CORE} />
          </Group>
        </Canvas>

        <Animated.View style={[styles.caption, textStyle]} pointerEvents="none">
          <Text style={styles.title}>{payload.title}</Text>
          {payload.subtitle ? <Text style={styles.subtitle}>{payload.subtitle}</Text> : null}
        </Animated.View>
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  caption: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 64,
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.heading,
    color: colors.bone,
    textAlign: 'center',
  },
})

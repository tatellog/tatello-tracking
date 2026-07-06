import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  Path as SkiaPath,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors, typography } from '@/theme'

/*
 * PatternDiscovery — "Tus patrones" reconcebido como un DESCUBRIMIENTO, no un
 * stepper. Los comportamientos son estrellas dispersas (un pequeño cielo, no una
 * línea). Una estrella guía (Stelar) entra, INSPECCIONA el cielo (desacelera y se
 * detiene en cada nodo) y al viajar DIBUJA la conexión detrás de sí (Skia trim):
 * la relación no estaba a la vista, Stelar la encontró. Al cerrarse, un glow sutil
 * ("patrón encontrado"). La EVIDENCIA (frase + fechas) NO va aquí: vive en el modal
 * que se abre al tocar la card. Esto es solo el momento de descubrimiento.
 *
 * Emoción: CURIOSIDAD / descubrimiento. Nunca progreso, timeline, checklist ni
 * celebración.
 */

type NodeInfo = { label: string; color: string }
type Pt = { x: number; y: number }

const SCENE_H = 196
// Layouts normalizados [0,1] — dispersos, orgánicos (nunca alineados). Índice por
// cantidad de nodos. El último nodo es el Déficit (el "norte", destino de la guía).
const LAYOUTS: Record<number, Pt[]> = {
  2: [
    { x: 0.32, y: 0.4 },
    { x: 0.72, y: 0.64 },
  ],
  3: [
    { x: 0.26, y: 0.6 },
    { x: 0.56, y: 0.28 },
    { x: 0.82, y: 0.66 },
  ],
  4: [
    { x: 0.22, y: 0.4 },
    { x: 0.48, y: 0.68 },
    { x: 0.72, y: 0.3 },
    { x: 0.88, y: 0.62 },
  ],
  5: [
    { x: 0.18, y: 0.52 },
    { x: 0.4, y: 0.26 },
    { x: 0.58, y: 0.66 },
    { x: 0.78, y: 0.32 },
    { x: 0.9, y: 0.62 },
  ],
}

// Coreografía (ms), contemplativa.
const REVEAL_START = 260
const REVEAL_PER = 230
const JOURNEY_GAP = 240
const TRAVEL_W = 1 // peso relativo de cada tramo de viaje
const DWELL_W = 0.55 // peso de la pausa (~inspección) en cada nodo
const STAR_SAMPLES = 130
const CLAMP = Extrapolation.CLAMP

// Helpers PUROS (solo JS, en el precómputo — nunca dentro de un worklet).
const smooth = (t: number): number => t * t * (3 - 2 * t)
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)
const bez = (a: number, c: number, b: number, t: number): number => {
  const mt = 1 - t
  return mt * mt * a + 2 * mt * t * c + t * t * b
}

export function PatternDiscovery({ nodes }: { nodes: NodeInfo[] }) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const active = useScreenActive()
  const reduce = useReducedMotion() ?? false
  const n = nodes.length

  const starPath = useMemo(() => Skia.Path.MakeFromSVGString(fourPointStarPath(0, 0, 8)), [])

  // Geometría: posiciones, muestras de la estrella (con desaceleración + pausas) y
  // las líneas entre nodos con su ventana de trazado.
  const geom = useMemo(() => {
    if (w <= 0) return null
    const layout = LAYOUTS[n] ?? LAYOUTS[3]!
    const pos: Pt[] = nodes.map((_, i) => ({
      x: (layout[i]?.x ?? 0.5) * w,
      y: (layout[i]?.y ?? 0.5) * SCENE_H,
    }))
    const entry: Pt = { x: -0.08 * w, y: 0.46 * SCENE_H }
    const waypoints: Pt[] = [entry, ...pos]

    const travelStart: number[] = []
    const arrival: number[] = []
    const depart: number[] = []
    let cum = 0
    for (let k = 0; k < n; k++) {
      travelStart[k] = cum
      arrival[k] = cum + TRAVEL_W
      depart[k] = arrival[k]! + DWELL_W
      cum = depart[k]!
    }
    const total = cum || 1
    for (let k = 0; k < n; k++) {
      travelStart[k] = travelStart[k]! / total
      arrival[k] = arrival[k]! / total
      depart[k] = depart[k]! / total
    }

    const ctrl: Pt[] = []
    for (let k = 0; k < n; k++) {
      const a = waypoints[k]!
      const b = waypoints[k + 1]!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const off = (k % 2 === 0 ? 1 : -1) * 16
      ctrl[k] = { x: (a.x + b.x) / 2 + (-dy / len) * off, y: (a.y + b.y) / 2 + (dx / len) * off }
    }

    const samples: Pt[] = []
    for (let s = 0; s <= STAR_SAMPLES; s++) {
      const j = s / STAR_SAMPLES
      let p: Pt = waypoints[n]!
      for (let k = 0; k < n; k++) {
        if (j <= arrival[k]!) {
          const t = smooth(clamp01((j - travelStart[k]!) / (arrival[k]! - travelStart[k]! || 1)))
          const a = waypoints[k]!
          const c = ctrl[k]!
          const b = waypoints[k + 1]!
          p = { x: bez(a.x, c.x, b.x, t), y: bez(a.y, c.y, b.y, t) }
          break
        }
        if (j <= depart[k]!) {
          p = waypoints[k + 1]!
          break
        }
      }
      samples[s] = p
    }

    const lines: { path: SkPath; start: number; end: number }[] = []
    for (let k = 1; k < n; k++) {
      const a = waypoints[k]!
      const c = ctrl[k]!
      const b = waypoints[k + 1]!
      const path = Skia.Path.MakeFromSVGString(`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`)
      if (path) lines.push({ path, start: travelStart[k]!, end: arrival[k]! })
    }

    return { pos, samples, lines, arrival }
  }, [w, nodes, n])

  const revealMs = n * REVEAL_PER
  const journeyStart = REVEAL_START + revealMs + JOURNEY_GAP
  const journeyMs = n * 720
  const arriveAt = journeyStart + journeyMs

  const reveal = useSharedValue(0)
  const journey = useSharedValue(0)
  const glow = useSharedValue(0)
  const starIn = useSharedValue(0)
  const breath = useSharedValue(0)
  const geomReady = geom != null

  // Coreografía one-shot (guarda por VALOR: si se cancela antes de terminar, al
  // volver redibuja). Reduced motion → estado final directo.
  useEffect(() => {
    if (!geomReady) return
    if (reduce) {
      reveal.value = 1
      journey.value = 1
      starIn.value = 1
      return
    }
    if (journey.value >= 1) return
    reveal.value = withDelay(REVEAL_START, withTiming(1, { duration: journeyStart - REVEAL_START }))
    starIn.value = withDelay(journeyStart - 160, withTiming(1, { duration: 420 }))
    journey.value = withDelay(
      journeyStart,
      withTiming(1, { duration: journeyMs, easing: Easing.linear }),
    )
    glow.value = withDelay(
      arriveAt - 40,
      withSequence(
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.sin) }),
      ),
    )
    return () => {
      cancelAnimation(reveal)
      cancelAnimation(journey)
      cancelAnimation(glow)
      cancelAnimation(starIn)
    }
    // OJO: `active` NO va en deps — es un one-shot. `active` se apaga en cada
    // scroll (useScreenActive = focused && !scrollPaused), así que incluirlo
    // reiniciaba el descubrimiento en cada gesto. Se reproduce una vez al montar.
  }, [reduce, geomReady, reveal, journey, glow, starIn, journeyStart, journeyMs, arriveAt])

  // Respiración continua del glow de la estrella guía (gateada).
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

  // El worklet captura SOLO las muestras (array plano {x,y}), NO `geom` (que
  // contiene SkPath en `lines`; serializar host-objects de Skia al UI thread es
  // deuda latente que puede fallar en release).
  const samples = useMemo(() => geom?.samples ?? [], [geom])
  const starTransform = useDerivedValue(() => {
    if (samples.length === 0) {
      return [{ translateX: -100 }, { translateY: -100 }, { scale: 1 }]
    }
    const t = journey.value < 0 ? 0 : journey.value > 1 ? 1 : journey.value
    const f = t * STAR_SAMPLES
    const i0 = Math.floor(f)
    const i1 = Math.min(i0 + 1, STAR_SAMPLES)
    const k = f - i0
    const a = samples[i0]!
    const b = samples[i1]!
    const sc = 1 + breath.value * 0.06 + glow.value * 0.1
    return [
      { translateX: a.x + (b.x - a.x) * k },
      { translateY: a.y + (b.y - a.y) * k },
      { scale: sc },
    ]
  })
  const starOpacity = useDerivedValue(() => starIn.value)
  const starHalo = useDerivedValue(() => starIn.value * (0.42 + breath.value * 0.18))

  return (
    // Decorativo: no captura toques → el tap llega al Pressable de la card y abre
    // el modal full-screen (la metáfora "línea de vida").
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.scene} onLayout={onLayout}>
        {w > 0 && geom ? (
          <>
            <Canvas style={{ width: w, height: SCENE_H }}>
              {geom.lines.map((ln, i) => (
                <ConnLine key={i} path={ln.path} start={ln.start} end={ln.end} journey={journey} />
              ))}

              {geom.pos.map((p, i) => (
                <DiscoveryNode
                  key={i}
                  p={p}
                  color={nodes[i]!.color}
                  reveal={reveal}
                  journey={journey}
                  glow={glow}
                  appearFrom={n > 1 ? (i / n) * 0.82 : 0}
                  arrival={geom.arrival[i]!}
                  starPath={starPath}
                />
              ))}

              <SkiaGroup transform={starTransform}>
                <SkiaCircle cx={0} cy={0} r={13} color={colors.magenta} opacity={starHalo}>
                  <BlurMask blur={11} style="normal" />
                </SkiaCircle>
                {starPath ? (
                  <SkiaPath path={starPath} color={colors.leche} opacity={starOpacity}>
                    <BlurMask blur={1} style="solid" />
                  </SkiaPath>
                ) : null}
                <SkiaCircle cx={0} cy={0} r={1.8} color="#FFFFFF" opacity={starOpacity} />
              </SkiaGroup>
            </Canvas>

            {geom.pos.map((p, i) => (
              <Animated.Text
                key={`l-${i}`}
                entering={FadeIn.duration(300).delay(REVEAL_START + i * REVEAL_PER)}
                style={[styles.nodeLabel, { left: p.x - 44, top: p.y + 12 }]}
                numberOfLines={1}
              >
                {nodes[i]!.label}
              </Animated.Text>
            ))}
          </>
        ) : null}
      </View>
    </View>
  )
}

/** Un nodo: estrella dispersa. Aparece tenue (reveal, una por una), se ILUMINA con
 *  pulse cuando la estrella guía la visita, y sube con el glow final. */
function DiscoveryNode({
  p,
  color,
  reveal,
  journey,
  glow,
  appearFrom,
  arrival,
  starPath,
}: {
  p: Pt
  color: string
  reveal: SharedValue<number>
  journey: SharedValue<number>
  glow: SharedValue<number>
  appearFrom: number
  arrival: number
  starPath: SkPath | null
}) {
  const transform = useDerivedValue(() => {
    const appear = interpolate(reveal.value, [appearFrom, appearFrom + 0.18], [0, 1], CLAMP)
    const flash = 1 - Math.min(1, Math.abs(journey.value - arrival) / 0.05)
    const lit = interpolate(journey.value, [arrival, arrival + 0.03], [0, 1], CLAMP)
    const scale = 0.7 + appear * 0.3 + lit * 0.12 + flash * 0.22
    return [{ translateX: p.x }, { translateY: p.y }, { scale }]
  })
  const coreOpacity = useDerivedValue(() => {
    const appear = interpolate(reveal.value, [appearFrom, appearFrom + 0.18], [0, 1], CLAMP)
    const lit = interpolate(journey.value, [arrival, arrival + 0.03], [0, 1], CLAMP)
    return appear * (0.34 + lit * 0.66)
  })
  const haloOpacity = useDerivedValue(() => {
    const lit = interpolate(journey.value, [arrival, arrival + 0.03], [0, 1], CLAMP)
    const flash = 1 - Math.min(1, Math.abs(journey.value - arrival) / 0.05)
    return lit * 0.32 + flash * 0.4 + glow.value * 0.2
  })
  return (
    <SkiaGroup transform={transform}>
      <SkiaCircle cx={0} cy={0} r={12} color={color} opacity={haloOpacity}>
        <BlurMask blur={9} style="normal" />
      </SkiaCircle>
      {starPath ? (
        <SkiaPath path={starPath} color={color} opacity={coreOpacity}>
          <BlurMask blur={0.6} style="solid" />
        </SkiaPath>
      ) : null}
    </SkiaGroup>
  )
}

/** Una conexión que NACE detrás de la estrella (trim start→end sincronizado con el
 *  tramo de viaje). */
function ConnLine({
  path,
  start,
  end,
  journey,
}: {
  path: SkPath
  start: number
  end: number
  journey: SharedValue<number>
}) {
  const trimEnd = useDerivedValue(() => {
    const e = (journey.value - start) / (end - start || 1)
    return e < 0.001 ? 0.001 : e > 1 ? 1 : e
  })
  return (
    <SkiaPath
      path={path}
      style="stroke"
      strokeWidth={1.1}
      strokeCap="round"
      color={colors.oroSoft}
      opacity={0.55}
      start={0}
      end={trimEnd}
    >
      <BlurMask blur={1} style="solid" />
    </SkiaPath>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
    width: '100%',
  },
  scene: {
    width: '100%',
    height: SCENE_H,
    position: 'relative',
  },
  nodeLabel: {
    position: 'absolute',
    width: 88,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
})

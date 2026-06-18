import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Región 3 — Constelaciones Ocultas. El cielo de FONDO alrededor de la figura.
 * Estado inicial: oculto. Despierta: aparecen nuevas estrellas (puntos), se
 * conectan con líneas y titilan. Intensidad → cuántas estrellas aparecen.
 * Significado: descubrir conexiones.
 *
 * Geometría: estrellas en la PERIFERIA (no sobre la figura). Estrellas = Views
 * planas agrupadas en 3 fases que titilan en unísono (3 worklets en lugar de
 * 16, sin sombras iOS por dot); líneas = un SVG en PRIMER plano (transparente
 * salvo las líneas finas → no tapa el arte, como el Núcleo).
 */

const GROUPS = 3

// Estrellas en CLÚSTERES pequeños y simétricos en la periferia (lejos de la
// figura), 3 por esquina/lado. Cada clúster es una constelación mínima con
// líneas SOLO locales (cortas) → se lee intencional, no un zigzag por el lienzo.
// El orden llena clúster por clúster (par arriba → lados → par abajo), así un
// despertar parcial crece equilibrado.
const STARS: { x: number; y: number }[] = [
  // arriba-izquierda
  { x: 0.11, y: 0.17 }, // 0
  { x: 0.19, y: 0.1 }, // 1
  { x: 0.25, y: 0.21 }, // 2
  // arriba-derecha (espejo)
  { x: 0.89, y: 0.17 }, // 3
  { x: 0.81, y: 0.1 }, // 4
  { x: 0.75, y: 0.21 }, // 5
  // izquierda-medio
  { x: 0.07, y: 0.45 }, // 6
  { x: 0.13, y: 0.55 }, // 7
  { x: 0.06, y: 0.65 }, // 8
  // derecha-medio (espejo)
  { x: 0.93, y: 0.45 }, // 9
  { x: 0.87, y: 0.55 }, // 10
  { x: 0.94, y: 0.65 }, // 11
  // abajo-izquierda
  { x: 0.12, y: 0.84 }, // 12
  { x: 0.2, y: 0.9 }, // 13
  { x: 0.27, y: 0.83 }, // 14
  // abajo-derecha (espejo)
  { x: 0.88, y: 0.84 }, // 15
  { x: 0.8, y: 0.9 }, // 16
  { x: 0.73, y: 0.83 }, // 17
]

// Líneas (pares de índices) — SOLO dentro de cada clúster (trazos cortos).
// Encienden cuando ambas estrellas ya aparecieron.
const LINES: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [6, 7],
  [7, 8],
  [9, 10],
  [10, 11],
  [12, 13],
  [13, 14],
  [15, 16],
  [16, 17],
]

export function ConstelacionesOcultas({ artSize, pct }: { artSize: number; pct: number }) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  // Cuántas estrellas ya "aparecieron".
  const visible = Math.round(intensity * STARS.length)
  const tw = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    tw.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(tw)
  }, [reduced, tw])

  const isOn = (i: number) => i < visible

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* líneas — SVG en primer plano, transparente salvo los trazos finos */}
      <Svg width={artSize} height={artSize} style={StyleSheet.absoluteFill} pointerEvents="none">
        {LINES.map(([a, b], i) => {
          if (!isOn(a) || !isOn(b)) return null
          const pa = STARS[a]!
          const pb = STARS[b]!
          return (
            <Line
              key={i}
              x1={pa.x * artSize}
              y1={pa.y * artSize}
              x2={pb.x * artSize}
              y2={pb.y * artSize}
              stroke={colors.oro}
              strokeWidth={0.5}
              strokeOpacity={0.28}
              strokeLinecap="round"
            />
          )
        })}
      </Svg>

      {/* estrellas que titilan — 3 grupos de fase en unísono */}
      {Array.from({ length: GROUPS }, (_, g) => (
        <TwinkleGroup
          key={g}
          tw={tw}
          group={g}
          stars={STARS.map((s, i) => ({ ...s, i })).filter((s) => isOn(s.i) && s.i % GROUPS === g)}
          artSize={artSize}
          reduced={reduced}
        />
      ))}
    </View>
  )
}

function TwinkleGroup({
  tw,
  group,
  stars,
  artSize,
  reduced,
}: {
  tw: SharedValue<number>
  group: number
  stars: { x: number; y: number; i: number }[]
  artSize: number
  reduced: boolean
}) {
  const phase = group / GROUPS
  const style = useAnimatedStyle(() => {
    const w = reduced ? 0.6 : 0.5 + 0.5 * Math.sin((tw.value + phase) * Math.PI * 2)
    return { opacity: 0.35 + 0.5 * w }
  })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {stars.map((s) => {
        const size = 2 + (s.i % 3) * 0.6
        return (
          <View
            key={s.i}
            style={{
              position: 'absolute',
              left: s.x * artSize - size / 2,
              top: s.y * artSize - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.oroSoft,
            }}
          />
        )
      })}
    </Animated.View>
  )
}

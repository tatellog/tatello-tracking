import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group,
  LinearGradient as SkiaLinearGradient,
  Oval,
  Path as SkiaPath,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  Skia,
  vec,
} from '@shopify/react-native-skia'
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors } from '@/theme'

/*
 * WaterDropSkia — la gota con VOLUMEN y agua VIVA (Skia). Profundidad por capas
 * (halo exterior, piso profundo, refracción, sombra de cristal, specular) y una
 * REACCIÓN de llenado: cada vez que sube el nivel, el agua ondula rápido +
 * destella la superficie + brotan burbujas (`surge`). El nivel sube con inercia
 * al cambiar `ratio`. Gateada en useScreenActive + reduced-motion: fuera de foco
 * / reduce-motion queda en un frame quieto pero con toda la profundidad.
 */

const WATER = colors.signal.agua // #8FBEDB
const DEEP = '#2C6486' // fondo del volumen (agua honda, no plana)
const FLOOR = '#06121A' // piso profundo de la gota
const SHEEN = '#EAF4FB' // menisco / caustics / destello

// Teardrop en espacio 100×120 (mismo viewBox que la versión SVG).
const DROP_D = 'M50 8 C 50 8 86 54 86 80 A 36 36 0 1 1 14 80 C 14 54 50 8 50 8 Z'
const DROP = Skia.Path.MakeFromSVGString(DROP_D)!

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`
}

// Burbuja que asciende del fondo a la superficie (loop), clipada al agua. Su
// brillo sube durante el `surge` (brotan al llenar).
function Bubble({
  rise,
  lvl,
  surge,
  x,
  phase,
  r,
}: {
  rise: SharedValue<number>
  lvl: SharedValue<number>
  surge: SharedValue<number>
  x: number
  phase: number
  r: number
}) {
  const cy = useDerivedValue(() => {
    const p = (rise.value + phase) % 1
    return 112 - p * (112 - (lvl.value + 5))
  })
  const op = useDerivedValue(() => {
    const p = (rise.value + phase) % 1
    return (0.2 + 0.4 * surge.value) * Math.sin(p * Math.PI)
  })
  return <SkiaCircle cx={x} cy={cy} r={r} color={SHEEN} opacity={op} />
}

export function WaterDropSkia({ size = 168, ratio }: { size?: number; ratio: number }) {
  const H = size * 1.2
  const s = size / 100
  const clamped = Math.max(0, Math.min(1, ratio))

  const active = useScreenActive()
  const reduced = useReducedMotion() ?? false

  // Nivel del agua (y en 100×120) + reacción de llenado (`surge`, one-shot).
  const lvl = useSharedValue(120 * (1 - clamped))
  const surge = useSharedValue(0)
  const prev = useRef(clamped)
  useEffect(() => {
    const target = 120 * (1 - clamped)
    const rose = clamped > prev.current
    prev.current = clamped
    if (reduced) {
      lvl.value = target
      return () => cancelAnimation(lvl)
    }
    lvl.value = withTiming(target, { duration: 850, easing: Easing.inOut(Easing.cubic) })
    // Al SUBIR: el agua reacciona (ondula rápido + destella + burbujea) y baja.
    if (rose) {
      surge.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) }),
      )
    }
    return () => cancelAnimation(lvl)
  }, [clamped, reduced, lvl, surge])

  // Onda de superficie + ascenso de burbujas (dos relojes lentos, gateados).
  const wave = useSharedValue(0.5)
  const rise = useSharedValue(0)
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(wave)
      cancelAnimation(rise)
      wave.value = 0.5
      rise.value = 0
      return
    }
    wave.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    rise.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(wave)
      cancelAnimation(rise)
    }
  }, [active, reduced, wave, rise])

  const waterH = useDerivedValue(() => 120 - lvl.value)
  // Superficie: onda lenta + ondulación RÁPIDA que brota con el surge.
  const surfY1 = useDerivedValue(
    () =>
      lvl.value -
      3 +
      Math.sin(wave.value * Math.PI * 2) * 1.4 +
      Math.sin(wave.value * Math.PI * 8) * surge.value * 3,
  )
  const surfY2 = useDerivedValue(
    () =>
      lvl.value -
      2 +
      Math.sin(wave.value * Math.PI * 2 + 2.1) * 1.1 +
      Math.sin(wave.value * Math.PI * 8 + 1.3) * surge.value * 2.4,
  )
  // Destello de la superficie al llenar.
  const flashY = useDerivedValue(() => lvl.value - 2)
  const flashOp = useDerivedValue(() => 0.6 * surge.value)
  // Refracción: veta de luz vertical dentro del agua (izquierda).
  const streakY = useDerivedValue(() => lvl.value + 10)
  const streakH = useDerivedValue(() => Math.max(0, 120 - lvl.value - 22))
  const showBubbles = clamped > 0.06
  // IDLE — vida aunque el vaso esté vacío: una veta de luz que recorre el vidrio
  // + el brillo especular que respira.
  const sheenY = useDerivedValue(() => 24 + rise.value * 74)
  const sheenOp = useDerivedValue(() => 0.16 * Math.sin(rise.value * Math.PI))
  const specOp = useDerivedValue(() => 0.55 + 0.45 * Math.sin(rise.value * Math.PI * 2))

  return (
    <View style={{ width: size, height: H }} pointerEvents="none">
      <Canvas style={{ width: size, height: H }}>
        <Group transform={[{ scale: s }]}>
          {/* Sin halo exterior: su glow difuminado se cortaba en el borde
              cuadrado del canvas (se veía un rectángulo). La profundidad del
              fondo la dan el glow ambiental del modal + el campo de estrellas. */}

          {/* Vidrio vacío: cuerpo tenue de la gota (se ve aun sin agua). */}
          <SkiaPath path={DROP} color={rgba(WATER, 0.08)} />

          {/* AGUA — clipada a la gota. */}
          <Group clip={DROP}>
            {/* Idle: una veta de luz que recorre el vidrio (vive aun con 0 vasos). */}
            <Oval x={18} y={sheenY} width={64} height={13} color={rgba(SHEEN, 1)} opacity={sheenOp}>
              <BlurMask blur={9} style="normal" />
            </Oval>
            {/* Volumen: gradiente vertical claro↑ / profundo↓. */}
            <SkiaRect x={0} y={lvl} width={100} height={waterH}>
              <SkiaLinearGradient
                start={vec(0, 8)}
                end={vec(0, 118)}
                colors={[rgba(WATER, 0.95), rgba(WATER, 0.62), rgba(DEEP, 0.85)]}
                positions={[0, 0.5, 1]}
              />
            </SkiaRect>

            {/* Piso profundo: oscurece el fondo de la gota → hondura real. */}
            <SkiaCircle cx={50} cy={118} r={48}>
              <SkiaRadialGradient
                c={vec(50, 118)}
                r={48}
                colors={[rgba(FLOOR, 0.65), rgba(FLOOR, 0.15), rgba(FLOOR, 0)]}
                positions={[0, 0.6, 1]}
              />
            </SkiaCircle>

            {/* Refracción: veta de luz vertical (izquierda del agua). */}
            <SkiaRect x={31} y={streakY} width={4} height={streakH} color={rgba(SHEEN, 0.12)}>
              <BlurMask blur={4} style="normal" />
            </SkiaRect>

            {/* Caustics: dos bandas de luz desfasadas bajo la superficie. */}
            <Oval x={10} y={surfY1} width={80} height={7} color={rgba(SHEEN, 0.5)}>
              <BlurMask blur={3} style="normal" />
            </Oval>
            <Oval x={16} y={surfY2} width={68} height={5} color={rgba(WATER, 0.55)}>
              <BlurMask blur={2} style="normal" />
            </Oval>

            {/* Destello de superficie — brota al subir el nivel. */}
            <Oval
              x={12}
              y={flashY}
              width={76}
              height={6}
              color={rgba(SHEEN, 0.9)}
              opacity={flashOp}
            >
              <BlurMask blur={4} style="normal" />
            </Oval>

            {/* Burbujas ascendentes (brotan con el surge). */}
            {showBubbles ? (
              <>
                <Bubble rise={rise} lvl={lvl} surge={surge} x={40} phase={0} r={1.6} />
                <Bubble rise={rise} lvl={lvl} surge={surge} x={58} phase={0.4} r={1.1} />
                <Bubble rise={rise} lvl={lvl} surge={surge} x={49} phase={0.75} r={0.9} />
                <Bubble rise={rise} lvl={lvl} surge={surge} x={64} phase={0.2} r={0.8} />
              </>
            ) : null}
          </Group>

          {/* Sombra interior del borde (grosor de cristal). */}
          <Group clip={DROP}>
            <SkiaPath path={DROP} style="stroke" strokeWidth={6} color={rgba(FLOOR, 0.5)}>
              <BlurMask blur={5} style="normal" />
            </SkiaPath>
          </Group>

          {/* Highlight especular (brillo del vidrio) — RESPIRA aunque no haya agua. */}
          <Group opacity={specOp}>
            <SkiaCircle cx={38} cy={44} r={11} color={rgba(SHEEN, 0.55)}>
              <BlurMask blur={7} style="normal" />
            </SkiaCircle>
            <SkiaCircle cx={35} cy={38} r={3.2} color="rgba(255, 255, 255, 0.8)">
              <BlurMask blur={1.5} style="normal" />
            </SkiaCircle>
          </Group>

          {/* Borde / menisco exterior. */}
          <SkiaPath path={DROP} style="stroke" strokeWidth={1.4} color={rgba(WATER, 0.6)} />
        </Group>
      </Canvas>
    </View>
  )
}

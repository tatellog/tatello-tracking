import { useEffect } from 'react'
import { View } from 'react-native'
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group,
  Path as SkiaPath,
  RadialGradient as SkiaRadialGradient,
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
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/*
 * SleepMoonSkia — la NOCHE dreamy del modal de sueño: nebulosa índigo + campo de
 * estrellas que titila + LUNA CRECIENTE con glow + nubes suaves que derivan. La
 * profundidad NO depende de ruido Skia (que en algunos devices no renderiza): es
 * apilado de radiales + una creciente por path SVG (determinista). Vive en un
 * modal efímero → la animación se gatea sólo en reduced-motion.
 */

const SLEEP = colors.dimension.sueno // #7C8FFF
const STAR = '#F4ECDE'
const MOON = '#EFEDFF'
const CLOUD = '244, 240, 255'

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`
}

/** Path SVG de una luna creciente (resta de dos círculos de radio R, el cortador
 *  desplazado a la derecha). Determinista → siempre renderiza. */
function crescentPath(cx: number, cy: number, R: number): string {
  const dx = R * 0.58 // menor corte → creciente más gruesa (más presencia)
  const half = dx / 2
  const h = Math.sqrt(Math.max(0, R * R - half * half))
  const tx = cx + half
  return `M ${tx} ${cy - h} A ${R} ${R} 0 1 0 ${tx} ${cy + h} A ${R} ${R} 0 0 1 ${tx} ${cy - h} Z`
}

// Campo de estrellas — [fx, fy, r, op, tw]. tw: 0 fija · 1 titila · 2 contrafase.
const STARS: [number, number, number, number, number][] = [
  [0.12, 0.16, 0.9, 0.5, 1],
  [0.26, 0.1, 0.6, 0.35, 0],
  [0.7, 0.13, 0.8, 0.5, 2],
  [0.86, 0.24, 0.6, 0.35, 1],
  [0.9, 0.44, 0.7, 0.4, 0],
  [0.08, 0.4, 0.6, 0.3, 2],
  [0.5, 0.08, 0.7, 0.4, 1],
  [0.34, 0.28, 0.5, 0.3, 0],
  [0.64, 0.3, 0.5, 0.28, 2],
  [0.18, 0.7, 0.7, 0.35, 1],
  [0.82, 0.72, 0.6, 0.3, 0],
  [0.46, 0.86, 0.6, 0.3, 2],
]

// Nubes — [fx, fy, escala, opacidad, fase].
const CLOUDS: [number, number, number, number, number][] = [
  [0.68, 0.5, 1.0, 0.9, 0],
  [0.28, 0.66, 0.78, 0.82, 0.5],
  [0.58, 0.74, 0.6, 0.72, 0.25],
]

export function SleepMoonSkia({ size = 220 }: { size?: number }) {
  const mx = size * 0.46
  const my = size * 0.44
  const Rm = size * 0.3 // luna grande / larga, con presencia

  const reduced = useReducedMotion() ?? false

  const t = useSharedValue(0.5) // respiración
  const drift = useSharedValue(0) // deriva de nubes
  const shoot = useSharedValue(0) // estrella fugaz (idle)
  useEffect(() => {
    if (reduced) {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(shoot)
      t.value = 0.5
      drift.value = 0
      shoot.value = 0
      return
    }
    t.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    drift.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false)
    shoot.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(shoot)
    }
  }, [reduced, t, drift, shoot])

  const twA = useDerivedValue(() => 0.5 + 0.5 * t.value)
  const twB = useDerivedValue(() => 0.5 + 0.5 * (1 - t.value))
  // Halo acotado (Rm*1.3) para que el radial se apague DENTRO del canvas → sin el
  // rectángulo. La nebulosa a todo el canvas se quitó (era el cuadrado detrás).
  const haloR = useDerivedValue(() => Rm * 1.3 * (0.9 + 0.15 * t.value))
  // La luna FLOTA: un vaivén vertical suave.
  const moonBob = useDerivedValue(() => [{ translateY: (t.value - 0.5) * 12 }])
  // Estrella fugaz: cruza arriba-derecha → abajo-izquierda ~1s, con pausa larga.
  const shootXf = useDerivedValue(() => {
    const p = shoot.value
    const k = p < 0.14 ? p / 0.14 : 0
    return [{ translateX: -k * size * 0.55 }, { translateY: k * size * 0.28 }]
  })
  const shootOp = useDerivedValue(() =>
    shoot.value < 0.14 ? Math.sin((shoot.value / 0.14) * Math.PI) * 0.95 : 0,
  )

  const moon = Skia.Path.MakeFromSVGString(crescentPath(mx, my, Rm))!

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Canvas style={{ width: size, height: size }}>
        {/* Campo de estrellas — algunas titilan. */}
        {STARS.map(([fx, fy, r, op, tw], i) => (
          <SkiaCircle
            key={`s${i}`}
            cx={fx * size}
            cy={fy * size}
            r={r}
            color={STAR}
            opacity={tw === 1 ? twA : tw === 2 ? twB : op}
          />
        ))}

        {/* La luna FLOTA (halo + creciente juntos) — vaivén vertical suave. */}
        <Group transform={moonBob}>
          {/* Halo lunar — glow amplio que respira detrás de la creciente. */}
          <SkiaCircle cx={mx} cy={my} r={haloR}>
            <SkiaRadialGradient
              c={vec(mx, my)}
              r={haloR}
              colors={[rgba('#CED6FF', 0.42), rgba(SLEEP, 0.14), rgba(SLEEP, 0)]}
              positions={[0, 0.5, 1]}
            />
          </SkiaCircle>
          {/* Resplandor suave de la creciente + la luna nítida. */}
          <SkiaPath path={moon} color={rgba('#DADEFF', 0.6)}>
            <BlurMask blur={13} style="normal" />
          </SkiaPath>
          <SkiaPath path={moon} color={MOON} />
        </Group>

        {/* Estrella fugaz (idle) — un glint que cruza el cielo de vez en cuando. */}
        <Group transform={shootXf} opacity={shootOp}>
          <SkiaCircle cx={size * 0.82} cy={size * 0.12} r={5} color={rgba('#EAECFF', 0.35)}>
            <BlurMask blur={6} style="normal" />
          </SkiaCircle>
          <SkiaCircle cx={size * 0.82} cy={size * 0.12} r={1.8} color={STAR} />
        </Group>

        {/* Nubes suaves que derivan — profundidad delante de la noche. */}
        {CLOUDS.map(([fx, fy, s, op, phase], i) => (
          <Cloud
            key={`c${i}`}
            drift={drift}
            phase={phase}
            baseX={fx * size}
            y={fy * size}
            s={s}
            op={op}
          />
        ))}
      </Canvas>
    </View>
  )
}

/** Una nube: circulitos suaves solapados, semitranslúcidos, que derivan en X. */
function Cloud({
  drift,
  phase,
  baseX,
  y,
  s,
  op,
}: {
  drift: SharedValue<number>
  phase: number
  baseX: number
  y: number
  s: number
  op: number
}) {
  const dx = useDerivedValue(() => Math.sin(((drift.value + phase) % 1) * Math.PI * 2) * 6)
  const cx0 = useDerivedValue(() => baseX + dx.value)
  const cxL = useDerivedValue(() => baseX - 15 * s + dx.value)
  const cxR = useDerivedValue(() => baseX + 15 * s + dx.value)
  return (
    <Group opacity={op}>
      <SkiaCircle cx={cxL} cy={y + 3 * s} r={10 * s} color={`rgba(${CLOUD}, 0.85)`}>
        <BlurMask blur={4} style="normal" />
      </SkiaCircle>
      <SkiaCircle cx={cxR} cy={y + 3 * s} r={11 * s} color={`rgba(${CLOUD}, 0.85)`}>
        <BlurMask blur={4} style="normal" />
      </SkiaCircle>
      <SkiaCircle cx={cx0} cy={y} r={15 * s} color={`rgba(${CLOUD}, 0.92)`}>
        <BlurMask blur={4} style="normal" />
      </SkiaCircle>
      <SkiaCircle cx={cx0} cy={y + 6 * s} r={12 * s} color={`rgba(${CLOUD}, 0.9)`}>
        <BlurMask blur={4} style="normal" />
      </SkiaCircle>
    </Group>
  )
}

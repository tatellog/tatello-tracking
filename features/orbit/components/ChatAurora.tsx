import { useEffect } from 'react'
import { View } from 'react-native'
import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient as SkiaLinearGradient,
  Path as SkiaPath,
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
 * ChatAurora — CINTAS DE LUZ mientras Stelar "lee tu mes".
 *
 * Metáfora: la onda de Siri desenrollada a lo ancho, o una aurora boreal.
 * Varios listones de luz sedosos ondulan y se cruzan sobre el negro cálido del
 * sheet mientras la IA lee tus datos, antes de responder. Oro es la voz de
 * Stelar (protagonista); el magenta es una veta puntual que ecoa la
 * constelación del chat — nunca domina.
 *
 * DECISIONES DE ARTE / PERFORMANCE:
 * - Solo se anima GEOMETRÍA y opacidad. Cada cinta reconstruye su Path en un
 *   `useDerivedValue` (worklet, UI thread) a partir de un único reloj `t` en
 *   loop. Aritmética inline dentro del worklet (helpers dentro de worklets
 *   necesitan directiva y arriesgan crash en release APK).
 * - Los STOPS de color del gradiente son ESTÁTICOS. Animar `colors` de un
 *   gradiente Skia crashea en device (regla del proyecto). La luz "respira"
 *   moviendo la forma y la opacidad del Group, no el color.
 * - Blend `plus` (aditivo): la luz de las cintas se SUMA sin quemar, como
 *   auroras que se cruzan. Fondo transparente → se monta sobre el sheet.
 * - Blur es el costo real: capas de fondo usan blur mayor + baja opacidad para
 *   profundidad difusa; las de frente, blur chico. 4 cintas, ~26 segmentos.
 * - Sin gating de navegación (puede vivir en un portal/sheet fuera del
 *   navigator): es efímera y corta. Honra Reduce Motion (frame quieto) y
 *   SIEMPRE cancela el loop en cleanup (nada de animaciones huérfanas).
 */

const TWO_PI = Math.PI * 2

// rgba a partir de un hex del theme (fuera del worklet · solo para JSX estático).
function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(
    h.slice(4, 6),
    16,
  )}, ${a})`
}

// Transparente del mismo tono (para el fade a los bordes sin corte duro).
function fade(hex: string): string {
  return rgba(hex, 0)
}

type RibbonSpec = {
  /** Centro vertical (0..1 sobre la altura). */
  yc: number
  /** Amplitud del ondular, en px. */
  amp: number
  /** Ciclos completos a lo ancho. */
  waves: number
  /** Vueltas por segundo del reloj (velocidad de deriva). */
  speed: number
  /** Desfase de fase para que no vayan sincronizadas. */
  phase: number
  /** Grosor del listón (da volumen al glow). */
  stroke: number
  /** Radio del blur (profundidad · fondo más difuso). */
  blur: number
  /** Stops de gradiente horizontal, estáticos (transparente en los bordes). */
  gradient: string[]
  gradientPos: number[]
  opacity: number
}

// Una cinta: Path sinusoidal reconstruido en worklet + gradiente estático +
// blur para el glow sedoso. Blend aditivo para sumar luz.
function Ribbon({
  t,
  width,
  height,
  spec,
}: {
  t: SharedValue<number>
  width: number
  height: number
  spec: RibbonSpec
}) {
  const cy = spec.yc * height

  const path = useDerivedValue(() => {
    const p = Skia.Path.Make()
    const steps = 26
    // La amplitud "respira": modula lento en el tiempo para que el listón se
    // hinche y adelgace como una tela de luz.
    const breathe = 0.72 + 0.28 * Math.sin(t.value * TWO_PI * 0.5 + spec.phase)
    const amp = spec.amp * breathe
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      const x = u * width
      const y =
        cy + Math.sin(u * TWO_PI * spec.waves + t.value * TWO_PI * spec.speed + spec.phase) * amp
      if (i === 0) p.moveTo(x, y)
      else p.lineTo(x, y)
    }
    return p
  })

  // La cinta tenue-late: la opacidad del Group oscila un poco desfasada.
  const groupOpacity = useDerivedValue(
    () => spec.opacity * (0.82 + 0.18 * Math.sin(t.value * TWO_PI * 0.5 + spec.phase * 1.7)),
  )

  return (
    <Group opacity={groupOpacity} blendMode="plus">
      <SkiaPath
        path={path}
        style="stroke"
        strokeWidth={spec.stroke}
        strokeCap="round"
        strokeJoin="round"
      >
        <SkiaLinearGradient
          start={vec(0, 0)}
          end={vec(width, 0)}
          colors={spec.gradient}
          positions={spec.gradientPos}
        />
        <BlurMask blur={spec.blur} style="normal" />
      </SkiaPath>
    </Group>
  )
}

export function ChatAurora({ width, height = 90 }: { width: number; height?: number }) {
  const reduced = useReducedMotion() ?? false
  const t = useSharedValue(0)

  useEffect(() => {
    if (reduced) {
      // Reduce Motion: un frame quieto pero pintado (la aurora existe, no se mueve).
      t.value = 0.12
      return () => cancelAnimation(t)
    }
    // Reloj único en loop (0→1). 9s por vuelta · lento, orgánico, premium.
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [reduced, t])

  // Composición de cintas (fondo→frente). El oro es protagonista; una sola cinta
  // lleva la veta magenta y va tenue para no dominar.
  const ribbons: RibbonSpec[] = [
    // Fondo difuso, ancho y lento — la bruma dorada.
    {
      yc: 0.5,
      amp: height * 0.2,
      waves: 1.15,
      speed: 0.5,
      phase: 0,
      stroke: 14,
      blur: 16,
      opacity: 0.35,
      gradient: [
        fade(colors.oro),
        rgba(colors.oro, 0.5),
        rgba(colors.oroSoft, 0.5),
        fade(colors.oroSoft),
      ],
      gradientPos: [0, 0.3, 0.7, 1],
    },
    // Cinta media — oro cálido, cruza en contrafase.
    {
      yc: 0.46,
      amp: height * 0.26,
      waves: 1.6,
      speed: -0.72,
      phase: 2.1,
      stroke: 8,
      blur: 9,
      opacity: 0.6,
      gradient: [
        fade(colors.oroSoft),
        rgba(colors.oroSoft, 0.75),
        rgba(colors.oroLight, 0.85),
        fade(colors.oroLight),
      ],
      gradientPos: [0, 0.28, 0.72, 1],
    },
    // Cinta con VETA MAGENTA — sutil, oro que se enciende a magenta en el centro.
    {
      yc: 0.54,
      amp: height * 0.18,
      waves: 1.9,
      speed: 0.9,
      phase: 4.0,
      stroke: 6,
      blur: 8,
      opacity: 0.5,
      gradient: [
        fade(colors.oroVect),
        rgba(colors.oroVect, 0.6),
        rgba(colors.magentaHot, 0.55),
        rgba(colors.oroVect, 0.6),
        fade(colors.oroVect),
      ],
      gradientPos: [0, 0.28, 0.5, 0.72, 1],
    },
    // Filamento de frente — nítido, el hilo de luz más brillante (oroLeche).
    {
      yc: 0.5,
      amp: height * 0.3,
      waves: 2.4,
      speed: -1.05,
      phase: 5.6,
      stroke: 2.4,
      blur: 3,
      opacity: 0.85,
      gradient: [
        fade(colors.oroLeche),
        rgba(colors.oroLeche, 0.9),
        rgba(colors.oroLight, 0.9),
        fade(colors.oroLight),
      ],
      gradientPos: [0, 0.32, 0.68, 1],
    },
  ]

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {ribbons.map((spec, i) => (
          <Ribbon key={i} t={t} width={width} height={height} spec={spec} />
        ))}
      </Canvas>
    </View>
  )
}

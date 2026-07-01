import { useEffect } from 'react'
import { View } from 'react-native'
import {
  Canvas,
  Circle as SkiaCircle,
  RadialGradient as SkiaRadialGradient,
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
} from 'react-native-reanimated'

/*
 * MoodOrbSkia — el ORBE de ánimo, REACTIVO al slider. `pos` (0..1) morfea el
 * color: 0 = Difícil (magenta cálido) · 0.5 = Neutral (azul) · 1 = Bien (verde).
 *
 * IMPORTANTE: los colores se calculan en JS y se pasan ESTÁTICOS al gradiente.
 * Animar los colores del gradiente por worklet (useDerivedValue) CRASHEA Skia en
 * device — sólo el radio/opacidad se anima (respiración), que sí es seguro. El
 * slider actualiza `pos` (estado, cuantizado) → re-render acotado del orbe.
 * Estructura simple (aura + esfera, sin clip/blur/specular). Respiración gateada
 * en reduced-motion (modal efímero, siempre en foco).
 */

/** rgb interpolado del ánimo (JS): struggle → neutral → good. */
function moodRgb(p: number): [number, number, number] {
  if (p < 0.5) {
    const t = p / 0.5
    return [
      Math.round(255 + (124 - 255) * t),
      Math.round(72 + (143 - 72) * t),
      Math.round(134 + (255 - 134) * t),
    ]
  }
  const t = (p - 0.5) / 0.5
  return [
    Math.round(124 + (159 - 124) * t),
    Math.round(143 + (226 - 143) * t),
    Math.round(255 + (168 - 255) * t),
  ]
}

export function MoodOrbSkia({ size = 260, pos }: { size?: number; pos: number }) {
  const C = size / 2
  const R = size * 0.3

  const reduced = useReducedMotion() ?? false
  const breath = useSharedValue(0.5)
  useEffect(() => {
    if (reduced) {
      cancelAnimation(breath)
      breath.value = 0.5
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [reduced, breath])

  // Colores ESTÁTICOS por render (cambian cuando cambia `pos`, no en worklet).
  const [r, g, b] = moodRgb(Math.max(0, Math.min(1, pos)))
  const lit = (c: number): number => Math.round(c + (255 - c) * 0.42)
  const deep = (c: number): number => Math.round(c * 0.5)
  const sphereColors = [
    `rgba(${lit(r)}, ${lit(g)}, ${lit(b)}, 1)`,
    `rgba(${r}, ${g}, ${b}, 1)`,
    `rgba(${deep(r)}, ${deep(g)}, ${deep(b)}, 0.9)`,
    `rgba(${deep(r)}, ${deep(g)}, ${deep(b)}, 0)`,
  ]
  const bloomColors = [
    `rgba(${r}, ${g}, ${b}, 0.5)`,
    `rgba(${r}, ${g}, ${b}, 0.12)`,
    `rgba(${r}, ${g}, ${b}, 0)`,
  ]

  // Sólo el radio/opacidad se animan (seguro). Los colores NO.
  const bloomR = useDerivedValue(() => R * (1.5 + 0.22 * breath.value))
  const bloomOpacity = useDerivedValue(() => 0.72 + 0.28 * breath.value)
  const sphereR = useDerivedValue(() => R * (0.99 + 0.03 * breath.value))
  const focus = vec(C - R * 0.08, C - R * 0.2)

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Canvas style={{ width: size, height: size }}>
        {/* Aura / bloom — el gran resplandor que respira. */}
        <SkiaCircle cx={C} cy={C} r={bloomR} opacity={bloomOpacity}>
          <SkiaRadialGradient
            c={vec(C, C)}
            r={bloomR}
            colors={bloomColors}
            positions={[0, 0.5, 1]}
          />
        </SkiaCircle>

        {/* Cuerpo de la esfera — foco de luz suave + borde que se funde. */}
        <SkiaCircle cx={C} cy={C} r={sphereR}>
          <SkiaRadialGradient
            c={focus}
            r={R * 1.2}
            colors={sphereColors}
            positions={[0, 0.55, 0.9, 1]}
          />
        </SkiaCircle>
      </Canvas>
    </View>
  )
}

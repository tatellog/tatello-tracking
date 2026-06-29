import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import {
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
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
  type SharedValue,
} from 'react-native-reanimated'

import { useScreenActive } from '../useScreenActive'

/*
 * StateHeroSky — el CIELO Skia detrás del astro del estado en Órbita Día. Da
 * PROFUNDIDAD y vida calmada, todo tintado al color del estado:
 *   · deep field de micro-estrellas crema, algunas TITILAN (parallax de fondo);
 *   · DOS auras radiales concéntricas que respiran desfasadas (≈5.5 s) — la lejana
 *     da el halo profundo, la cercana el corazón tintado;
 *   · 3 DESTELLOS orbitando el centro en elipse (la metáfora "órbita", viva);
 *   · un glow de borde tras el glifo que respira en contrafase (lo funde al cielo).
 * El glifo PNG va ENCIMA del Canvas (patrón seguro, no dentro de Skia).
 * Gateado en useScreenActive (se congela fuera de pantalla) y reduce-motion.
 */

const SIZE = 300
const C = SIZE / 2

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Deep field — posiciones fijas (determinístico), crema tenue. [x, y, r, op, twinkle]
// twinkle: 0 = estático · 1 = titila en fase con t · 2 = titila en contrafase.
const STARS: [number, number, number, number, number][] = [
  [42, 60, 0.8, 0.3, 0],
  [80, 30, 0.5, 0.22, 1],
  [250, 50, 0.7, 0.34, 0],
  [275, 110, 0.5, 0.2, 2],
  [30, 150, 0.6, 0.26, 0],
  [270, 220, 0.8, 0.3, 1],
  [60, 250, 0.6, 0.24, 0],
  [210, 268, 0.7, 0.32, 2],
  [150, 24, 0.5, 0.2, 1],
  [24, 210, 0.5, 0.22, 0],
  [288, 168, 0.6, 0.24, 2],
  [120, 282, 0.5, 0.2, 1],
]

// Destellos orbitando — [radio, velocidad (vueltas/ciclo), fase, tamaño]
const GLINTS: [number, number, number, number][] = [
  [96, 1, 0.0, 1.4],
  [122, -0.7, 0.36, 1.0],
  [108, 0.85, 0.7, 0.8],
]

function Glint({
  drift,
  cfg,
  color,
}: {
  drift: SharedValue<number>
  cfg: [number, number, number, number]
  color: string
}) {
  const [radius, speed, phase, size] = cfg
  const transform = useDerivedValue(() => {
    const ang = (drift.value * speed + phase) * 2 * Math.PI
    return [{ translateX: Math.cos(ang) * radius }, { translateY: Math.sin(ang) * radius * 0.8 }]
  })
  // Titila al recorrer la órbita (más brillante al pasar por delante).
  const opacity = useDerivedValue(() => {
    const ang = (drift.value * speed + phase) * 2 * Math.PI
    return 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(ang))
  })
  return (
    <SkiaGroup transform={transform} origin={vec(C, C)}>
      <SkiaCircle cx={C} cy={C} r={size} color={color} opacity={opacity} />
    </SkiaGroup>
  )
}

export function StateHeroSky({ color }: { color: string }) {
  const reduced = useReducedMotion() ?? false
  const active = useScreenActive()
  const t = useSharedValue(0.5)
  const drift = useSharedValue(0)

  useEffect(() => {
    if (active && !reduced) {
      t.value = withRepeat(
        withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
      drift.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(t)
      cancelAnimation(drift)
      t.value = 0.5
      // drift se RESETEA a 0: withRepeat(...false) captura el valor inicial al
      // arrancar; si quedara en mitad de órbita los destellos saltarían el arco.
      drift.value = 0
    }
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
    }
  }, [active, reduced, t, drift])

  // Aura lejana (halo profundo) — respira lento y amplio, muy tenue.
  const farR = useDerivedValue(() => C * 1.04 * (0.9 + 0.12 * t.value))
  // Aura cercana (el corazón tintado) — respira en CONTRAFASE para dar parallax.
  const auraR = useDerivedValue(() => C * 0.9 * (0.96 - 0.08 * t.value))
  // El glow de borde tras el glifo respira en fase con el aura lejana.
  const glowR = useDerivedValue(() => 92 * (1.02 + 0.08 * t.value))
  // Dos fases de titileo para las estrellas (variedad sin más hooks por estrella).
  const twA = useDerivedValue(() => 0.55 + 0.45 * t.value)
  const twB = useDerivedValue(() => 0.55 + 0.45 * (1 - t.value))

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* aura lejana — profundidad */}
      <SkiaCircle cx={C} cy={C} r={farR}>
        <SkiaRadialGradient
          c={vec(C, C)}
          r={farR}
          colors={[rgba(color, 0.16), rgba(color, 0.06), rgba(color, 0)]}
          positions={[0, 0.55, 1]}
        />
      </SkiaCircle>

      {/* deep field — algunas titilan */}
      {STARS.map(([x, y, r, op, tw], i) => (
        <SkiaCircle
          key={`f${i}`}
          cx={x}
          cy={y}
          r={r}
          color="#F4ECDE"
          opacity={tw === 1 ? twA : tw === 2 ? twB : op}
        />
      ))}

      {/* aura cercana — el corazón tintado, respirando en contrafase */}
      <SkiaCircle cx={C} cy={C} r={auraR}>
        <SkiaRadialGradient
          c={vec(C, C)}
          r={auraR}
          colors={[rgba(color, 0.36), rgba(color, 0.13), rgba(color, 0)]}
          positions={[0, 0.5, 1]}
        />
      </SkiaCircle>

      {/* destellos orbitando */}
      {GLINTS.map((cfg, i) => (
        <Glint key={`g${i}`} drift={drift} cfg={cfg} color={i === 1 ? '#FFF6E5' : color} />
      ))}

      {/* glow de borde tras el glifo (funde el PNG con el cielo) */}
      <SkiaCircle cx={C} cy={C} r={glowR}>
        <SkiaRadialGradient
          c={vec(C, C)}
          r={glowR}
          colors={[rgba(color, 0.3), rgba(color, 0)]}
          positions={[0, 1]}
        />
      </SkiaCircle>
    </Canvas>
  )
}

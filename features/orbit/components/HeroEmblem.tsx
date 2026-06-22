import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia'
import { type ReactNode, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { useScreenActive } from '@/features/orbit/useScreenActive'

/*
 * El emblema del héroe de Órbita Día — el glyph dorado sobre un pozo de luz con
 * PROFUNDIDAD y vida, dibujado en Skia:
 *
 *   · halo ambiental — un resplandor amplio que sangra fuera del aro (capa de
 *     fondo, da aire y dimensión)
 *   · pozo de luz — núcleo radial que respira (opacidad + radio) detrás del
 *     glyph, como si la dimensión emitiera luz
 *   · aro biselado — stroke con gradiente lineal (claro arriba-izq → oscuro
 *     abajo-der) que lee como un anillo con volumen, no una línea plana
 *   · motas en órbita — 3 chispas que giran lento alrededor del aro (parallax)
 *
 * Self-contained (sin imágenes dentro del Canvas — patrón de NutritionMoon: las
 * imágenes en un Canvas animado se rompen al re-montar). El glyph PNG va como
 * <Image> de RN encima. Las animaciones se PAUSAN fuera de pantalla / en scroll
 * vía useScreenActive (libera el hilo de UI, ver useScreenActive).
 */

const RING = 120 // diámetro del aro
const PAD = 46 // sangrado del resplandor fuera del aro
const SIZE = RING + PAD * 2 // lado del canvas
const C = SIZE / 2 // centro
const R = RING / 2 // radio del aro

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/** Aclara (amt > 0) u oscurece (amt < 0) un hex mezclando hacia blanco/negro. */
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '')
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  const mix = (c: number) => clampByte(c + (t - c) * p)
  const r = mix(parseInt(h.slice(0, 2), 16))
  const g = mix(parseInt(h.slice(2, 4), 16))
  const b = mix(parseInt(h.slice(4, 6), 16))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

export function HeroEmblem({ color, children }: { color: string; children: ReactNode }) {
  const active = useScreenActive()
  const breath = useSharedValue(0)
  const drift = useSharedValue(0)

  useEffect(() => {
    if (!active) return
    breath.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    drift.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(breath)
      cancelAnimation(drift)
    }
  }, [active, breath, drift])

  // El pozo de luz respira en opacidad + radio. Base subida (0.34→0.42) para
  // que el glyph plano (p.ej. el runner tintado a magenta) se asiente en luz y
  // gane volumen, en vez de flotar como un recorte liso.
  const glowOpacity = useDerivedValue(() => 0.42 + breath.value * 0.24)
  const glowR = useDerivedValue(() => R * 0.86 + breath.value * R * 0.12)
  // Las motas giran como un grupo rígido alrededor del centro.
  const orbit = useDerivedValue(() => [{ rotate: drift.value * Math.PI * 2 }])

  const ringTop = shade(color, 0.45)
  const ringBottom = shade(color, -0.35)
  const moteHot = shade(color, 0.5)

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: SIZE, height: SIZE }}>
        {/* Halo ambiental — sangra fuera del aro, da profundidad de fondo. */}
        <Circle cx={C} cy={C} r={R * 1.55}>
          <RadialGradient c={vec(C, C)} r={R * 1.55} colors={[rgba(color, 0.22), rgba(color, 0)]} />
        </Circle>

        {/* Pozo de luz — núcleo radial que respira detrás del glyph. */}
        <Group opacity={glowOpacity}>
          <Circle cx={C} cy={C} r={glowR}>
            <RadialGradient
              c={vec(C, C)}
              r={glowR}
              colors={[rgba(color, 0.85), rgba(color, 0.12), rgba(color, 0)]}
              positions={[0, 0.6, 1]}
            />
          </Circle>
        </Group>

        {/* Aro biselado — gradiente lineal claro→oscuro = volumen, no línea plana. */}
        <Circle cx={C} cy={C} r={R} style="stroke" strokeWidth={2.5}>
          <LinearGradient
            start={vec(C - R, C - R)}
            end={vec(C + R, C + R)}
            colors={[ringTop, color, ringBottom]}
          />
        </Circle>
        {/* Aro exterior tenue — segunda capa, refuerza la profundidad. */}
        <Circle cx={C} cy={C} r={R + 5} style="stroke" strokeWidth={1} color={rgba(color, 0.18)} />

        {/* Motas en órbita — 3 chispas que giran lento alrededor del aro. */}
        <Group origin={vec(C, C)} transform={orbit}>
          <Circle cx={C} cy={C - R} r={3.5} color={moteHot} />
          <Circle cx={C + R} cy={C} r={2.4} color={rgba(color, 0.9)} />
          <Circle cx={C} cy={C + R} r={2} color={rgba(moteHot, 0.8)} />
        </Group>
      </Canvas>

      {/* El glyph PNG dorado, encima del Canvas (fuera de él, patrón seguro). */}
      <View style={styles.glyph} pointerEvents="none">
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

import { Circle, Group } from '@shopify/react-native-skia'
import { useMemo } from 'react'
import { useDerivedValue } from 'react-native-reanimated'

import { heroReactionSpec, type HeroReaction } from '@/features/tabs/hero-reaction'

import { H, W } from '../../constants'
import { buildAmbientField } from '../../data/scatter'

/*
 * Hero vivo (V-13) — la capa Skia de la reacción.
 *
 * Se monta SOLO mientras una reacción corre (≈1 s) y se desmonta sola; en
 * reposo no hay ni un nodo extra en el canvas. Todo lo animado es `transform`
 * y `opacity` de un <Group> (seguro en Skia); los colores son ESTÁTICOS
 * (animar `colors` de un gradiente crashea nativo — regla del proyecto), y
 * el "suave" se logra apilando círculos con alfa bajo, como el glow ambiente.
 *
 * Los worklets capturan solo primitivos del spec (x, y, escalas, pico, shape
 * como string) y el SharedValue `t` del disparador.
 */

const CREAM_HOT = '#FFF6E5'

// Lista plana (y estable) de las estrellas ambiente — la reacción elige
// algunas por semilla y las hace vibrar en su sitio.
const AMBIENT_FLAT = buildAmbientField().flat()

// Radios (viewBox) de los círculos apilados del bloom y del anillo de la onda.
const BLOOM_RADII = [26, 42, 60, 80, 100] as const
const BLOOM_LAYER_ALPHA = 0.12
const RIPPLE_R = 40

export function SkiaHeroReaction({
  reaction,
  ax,
  ay,
}: {
  reaction: HeroReaction
  /** Estrella alfa (viewBox). */
  ax: number
  ay: number
}) {
  const spec = useMemo(
    () =>
      heroReactionSpec(
        reaction.kind,
        { cx: W / 2, cy: H / 2, ax, ay },
        reaction.seed,
        AMBIENT_FLAT.length,
      ),
    [reaction.kind, reaction.seed, ax, ay],
  )
  const t = reaction.t
  // Primitivos para los worklets (nunca el objeto spec).
  const { x, y, scaleFrom, scaleTo, peak, shape, tint } = spec
  const isRipple = shape === 'ripple'

  const transform = useDerivedValue(() => {
    const s = scaleFrom + (scaleTo - scaleFrom) * t.value
    return [{ translateX: x }, { translateY: y }, { scale: s }]
  })
  // Envolvente: la onda sube rápido y se disuelve; el bloom respira (seno).
  const opacity = useDerivedValue(() => {
    const v = t.value
    const env = isRipple ? (v < 0.15 ? v / 0.15 : 1 - (v - 0.15) / 0.85) : Math.sin(v * Math.PI)
    return peak * (env > 0 ? env : 0)
  })
  const starOpacity = useDerivedValue(() => 0.9 * Math.sin(t.value * Math.PI))

  return (
    <>
      <Group transform={transform} opacity={opacity}>
        {isRipple ? (
          <>
            <Circle cx={0} cy={0} r={RIPPLE_R} color={tint} style="stroke" strokeWidth={1.4} />
            <Circle
              cx={0}
              cy={0}
              r={RIPPLE_R + 6}
              color={tint}
              style="stroke"
              strokeWidth={0.6}
              opacity={0.5}
            />
          </>
        ) : (
          BLOOM_RADII.map((r) => (
            <Circle key={r} cx={0} cy={0} r={r} color={tint} opacity={BLOOM_LAYER_ALPHA} />
          ))
        )}
      </Group>
      {/* Las estrellas que vibran: un punto caliente sobre su posición base,
          más grande que la estrella (1.8×), que sube y baja con la reacción. */}
      <Group opacity={starOpacity}>
        {spec.stars.map((idx) => {
          const s = AMBIENT_FLAT[idx]
          if (!s) return null
          return <Circle key={idx} cx={s.x} cy={s.y} r={s.r * 1.8} color={CREAM_HOT} />
        })}
      </Group>
    </>
  )
}

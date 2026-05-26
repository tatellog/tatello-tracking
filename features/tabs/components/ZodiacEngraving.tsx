import type { FC } from 'react'
import type { ImageSourcePropType } from 'react-native'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G, Image as SvgImage, type SvgProps } from 'react-native-svg'

/*
 * Generic zodiac engraving backdrop — renders a sign's
 * illustrative `art` (and, optionally, a `constellation` overlay)
 * inside LunarConstellation's 290 x 290 canvas.
 *
 * Designed to scale to all 12 signs: the parent supplies the
 * imported SVG component or bitmap source, this component just
 * lays it out and applies the shared breath + progress animation.
 *
 * Each layer has its own opacity ramp:
 *   • ART       0.28 (day 0) → 0.60 (day 28) — atmospheric
 *     backdrop only; the animated star system rendered on top
 *     of this component is the focal progress meter
 *   • SIGN      0.65 (day 0) → 1.00 (day 28) — when supplied
 *
 * BREATH is ±2 % scale-about-canvas-centre on the shared 16 s
 * breathT clock so the layers inhale together.
 */

const CANVAS = 290
const CENTRE = CANVAS / 2

const AnimatedG = Animated.createAnimatedComponent(G)

/** A layer asset can be either a transformer-generated SVG
 *  component or a bitmap source (PNG/JPG). The render path is
 *  picked at runtime via a `typeof === 'function'` check. */
export type ZodiacAsset = FC<SvgProps> | ImageSourcePropType

export type ZodiacEngravingProps = {
  /** Bottom layer — the sign's illustrative art (e.g. lion, ram). */
  art: ZodiacAsset
  /** Optional foreground constellation overlay. When omitted the
   *  animated star system rendered on top by LunarConstellation
   *  is the only foreground. */
  constellation?: ZodiacAsset
  /** 0..1 progress through the constellation — drives opacity ramps. */
  progress?: number
  /** Shared 16 s breath clock from LunarConstellation. */
  breathT?: SharedValue<number>
  /** Per-layer size multiplier (1 = fills the canvas). Use to
   *  balance the relative weight of art vs. constellation per
   *  sign — e.g. a big lion behind a smaller star pattern. */
  artScale?: number
  constellationScale?: number
}

// Scale a child about the canvas centre. We use a transform group
// instead of nested SVG `x`/`y`/`width`/`height` because react-
// native-svg-transformer's generated component renders a root
// <Svg> whose `x`/`y` props are unreliably honoured when nested
// inside another <Svg> — the child ends up in the upper-left
// corner. `translate(...) scale(...)` is the robust path.
function centeredScale(scale: number): string {
  const t = CENTRE * (1 - scale)
  return `translate(${t} ${t}) scale(${scale})`
}

function renderAsset(asset: ZodiacAsset) {
  if (typeof asset === 'function') {
    const Component = asset
    return <Component width={CANVAS} height={CANVAS} />
  }
  return (
    <SvgImage href={asset} width={CANVAS} height={CANVAS} preserveAspectRatio="xMidYMid meet" />
  )
}

export function ZodiacEngraving({
  art,
  constellation,
  progress = 0,
  breathT,
  artScale = 1,
  constellationScale = 1,
}: ZodiacEngravingProps) {
  const artTransform = centeredScale(artScale)
  const constTransform = centeredScale(constellationScale)
  const artProps = useAnimatedProps(() => {
    'worklet'
    const p = Math.max(0, Math.min(1, progress))
    const opacity = 0.28 + 0.32 * p
    const wave = breathT ? 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI) : 0
    const breath = 1 + wave * 0.02
    return {
      opacity,
      transform: [
        { translateX: CENTRE },
        { translateY: CENTRE },
        { scale: breath },
        { translateX: -CENTRE },
        { translateY: -CENTRE },
      ],
    }
  })

  const constellationProps = useAnimatedProps(() => {
    'worklet'
    const p = Math.max(0, Math.min(1, progress))
    const opacity = 0.65 + 0.35 * p
    const wave = breathT ? 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI) : 0
    const breath = 1 + wave * 0.02
    return {
      opacity,
      transform: [
        { translateX: CENTRE },
        { translateY: CENTRE },
        { scale: breath },
        { translateX: -CENTRE },
        { translateY: -CENTRE },
      ],
    }
  })

  return (
    <>
      <AnimatedG animatedProps={artProps}>
        <G transform={artTransform}>{renderAsset(art)}</G>
      </AnimatedG>
      {constellation ? (
        <AnimatedG animatedProps={constellationProps}>
          <G transform={constTransform}>{renderAsset(constellation)}</G>
        </AnimatedG>
      ) : null}
    </>
  )
}

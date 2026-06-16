import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia'
import { memo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

import { HERO_MAG } from '../../constants'
import { fourPointStarPath, recencyHaloMultiplier, starRadius } from '../../geometry'
import type { Resolved, SequenceEl } from '../../types'

/*
 * SkiaFigure — the constellation FIGURE (lines + star bodies + halos) drawn
 * in a single Skia <Canvas> instead of react-native-svg.
 *
 * WHY: on Android RNSVG redraws the entire <Svg> tree on every animated
 * child, so the figure's many nodes re-rasterise 60×/s. Skia is GPU and
 * draws each node cheaply — same visuals, far lighter. The art (a PNG) and
 * the lit-star magenta bloom (SkiaLitFlareLayer) live elsewhere; this layer
 * carries the lines, the star bodies and their layered cream/gold halos.
 *
 * SLICE 2: lines + bodies (placeholder / lit / next) + the layered lit-star
 * halos (outer gold, main cream, core, white-hot) with recency fade + cascade
 * breath, + the hero glow on alpha stars. Still pending: ignition animation,
 * rising particles, today ring, lit-cluster aura, the commit litPulse ripple.
 *
 * Coordinates: caller passes `toScreen` (viewBox → canvas px, folding
 * SIGN_CONSTELLATION_TRANSFORM) and `sScale` (= sx·k) so radii / strokes /
 * halo offsets scale exactly like the SVG <G transform> did.
 */

const CREAM = colors.leche // #F4ECDE
const CREAM_HOT = colors.oroLeche // #FFF6E5
// GOLD (#D9AE6F) ahora vive como rgba(217,174,111,..) dentro de los gradientes
// del glow — sin const dedicada.
const MAGENTA = colors.magenta
const WHITE_HOT = '#FFF1D6'

type Px = { x: number; y: number; r: number; mag: number }

/** Scale-about-(cx,cy) transform array for a Skia <Group>. Marked `worklet`
 *  because it's called from useDerivedValue worklets — in a release build the
 *  worklet runs on the UI thread and a plain JS function isn't available there
 *  ("Object is not a function"); dev/Expo Go tolerated it, release crashes. */
function scaleAbout(cx: number, cy: number, scale: number) {
  'worklet'
  return [
    { translateX: cx },
    { translateY: cy },
    { scale },
    { translateX: -cx },
    { translateY: -cy },
  ]
}

export const SkiaFigure = memo(function SkiaFigure({
  stars,
  lines,
  litKeys,
  nextEl,
  starRecency,
  starDepth,
  toScreen,
  sScale,
  t,
  breathT,
  reveal,
  reduce,
}: {
  stars: Resolved[]
  lines: readonly (readonly [number, number])[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  starRecency: Map<number, number>
  starDepth: Map<number, number>
  toScreen: (xVb: number, yVb: number) => { x: number; y: number }
  sScale: number
  t: SharedValue<number>
  breathT: SharedValue<number>
  /** Reveal 0→1 de aparición — las líneas encendidas se DIBUJAN sobre él. */
  reveal: SharedValue<number>
  reduce: boolean
}) {
  const px: Px[] = stars.map((s) => {
    const p = toScreen(s.x, s.y)
    return { x: p.x, y: p.y, r: starRadius(s.mag) * sScale, mag: s.mag }
  })

  // Pre-computa el índice de encendido por línea (stagger del trazo) fuera del
  // JSX, sin efectos en render.
  let litSeen = 0
  const lineDefs = lines.map(([a, b], idx) => {
    const A = px[a]
    const B = px[b]
    const ok = !!A && !!B
    const lit = ok && litKeys.has(`line-${idx}`)
    const litIndex = lit ? litSeen++ : 0
    return { idx, A, B, ok, lit, litIndex }
  })
  const litLineCount = litSeen

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {lineDefs.map((l) =>
        l.ok ? (
          <SkiaConstellationLine
            key={`l-${l.idx}`}
            A={l.A!}
            B={l.B!}
            lit={l.lit}
            litIndex={l.litIndex}
            litCount={litLineCount}
            reveal={reveal}
            t={t}
            sScale={sScale}
            reduce={reduce}
          />
        ) : null,
      )}
      {px.map((p, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (isNext)
          return <SkiaNextStar key={`s-${i}`} p={p} sScale={sScale} t={t} reduce={reduce} />
        if (isLit)
          return (
            <SkiaLitStar
              key={`s-${i}`}
              p={p}
              i={i}
              recency={starRecency.get(i) ?? 0}
              depth={starDepth.get(i) ?? 0}
              sScale={sScale}
              t={t}
              breathT={breathT}
              reduce={reduce}
            />
          )
        return <SkiaPlaceholderStar key={`s-${i}`} p={p} i={i} t={t} reduce={reduce} />
      })}
    </Canvas>
  )
})

/* Una línea de la constelación. Las ENCENDIDAS se dibujan solas: el path-trim
 * de Skia (`end` 0→1) traza el stroke desde la estrella A hacia la B sobre el
 * `reveal`, con stagger por orden de encendido + una chispa que viaja en la
 * punta (la "pluma"). Las apagadas quedan como guía tenue, completas. Cero
 * reconstrucción de path por frame — solo escalares en worklets (GPU). */
const LINE_WINDOW = 0.62 // ventana de trazado por línea (más ancha = más lento)
// Pulso de energía CONTINUO que recorre cada línea encendida (sobre `t`, el
// reloj de 8 s). Traversales por ciclo: < 1 = lento, lee como "energía
// fluyendo" en vez de un dibujo rápido. La fase por línea las desincroniza.
const ENERGY_TRAVERSALS = 0.85

function SkiaConstellationLine({
  A,
  B,
  lit,
  litIndex,
  litCount,
  reveal,
  t,
  sScale,
  reduce,
}: {
  A: Px
  B: Px
  lit: boolean
  litIndex: number
  litCount: number
  reveal: SharedValue<number>
  t: SharedValue<number>
  sScale: number
  reduce: boolean
}) {
  const path = `M${A.x.toFixed(1)},${A.y.toFixed(1)}L${B.x.toFixed(1)},${B.y.toFixed(1)}`
  // Stagger normalizado: la última línea encendida arranca en (1 - WINDOW) y
  // TODAS terminan exactamente en reveal=1 (antes el stagger fijo se pasaba de
  // 1 con muchas líneas → las últimas quedaban a medio dibujar, con la chispa
  // clavada → "estrella rara").
  const start = litCount > 1 ? (litIndex / (litCount - 1)) * (1 - LINE_WINDOW) : 0
  const phase = (litIndex * 0.37) % 1
  const dx = B.x - A.x
  const dy = B.y - A.y
  const end = useDerivedValue(() => {
    if (!lit || reduce) return 1
    const p = (reveal.value - start) / LINE_WINDOW
    return p < 0 ? 0 : p > 1 ? 1 : p
  })
  // La chispa que DIBUJA — en el extremo del trazo mientras 0<end<1.
  const tipTransform = useDerivedValue(() => {
    const e = end.value
    return [{ translateX: A.x + dx * e }, { translateY: A.y + dy * e }]
  })
  const tipOpacity = useDerivedValue(() => (end.value > 0.02 && end.value < 0.98 ? 1 : 0))
  // El pulso de ENERGÍA continuo — recorre la línea en loop lento una vez que
  // ya está dibujada. Posición = lerp(A,B,u); brilla al medio y se apaga en
  // los extremos (Math.sin), así "entra y sale" sin pop.
  const energyTransform = useDerivedValue(() => {
    const u = (t.value * ENERGY_TRAVERSALS + phase) % 1
    return [{ translateX: A.x + dx * u }, { translateY: A.y + dy * u }]
  })
  const energyOpacity = useDerivedValue(() => {
    if (!lit || reduce || end.value < 0.85) return 0
    const u = (t.value * ENERGY_TRAVERSALS + phase) % 1
    return 0.5 * Math.sin(u * Math.PI)
  })
  return (
    <>
      {lit ? (
        // Línea ENCENDIDA con gradiente longitudinal: cream brillante en las
        // dos estrellas, oro tenue al medio → "dos estrellas unidas por su
        // propia luz" (Genshin), no una raya pareja. El trim `end` la dibuja.
        <Path path={path} style="stroke" strokeWidth={1.3 * sScale} strokeCap="round" end={end}>
          <LinearGradient
            start={vec(A.x, A.y)}
            end={vec(B.x, B.y)}
            colors={[
              'rgba(255,246,229,0.9)',
              'rgba(217,174,111,0.78)',
              'rgba(217,174,111,0.34)',
              'rgba(217,174,111,0.78)',
              'rgba(255,246,229,0.9)',
            ]}
            positions={[0, 0.16, 0.5, 0.84, 1]}
          />
        </Path>
      ) : (
        // Línea APAGADA — guía muy tenue del contorno futuro (recede para que
        // no lea como wireframe geométrico).
        <Path
          path={path}
          color={CREAM}
          style="stroke"
          strokeWidth={2 * sScale}
          strokeCap="round"
          opacity={0.13}
        />
      )}
      {lit ? (
        <>
          {/* Chispa que dibuja (one-shot del reveal). Glow fakeado con dos
              círculos apilados, sin BlurMask (cheap, igual que las estrellas). */}
          <Group transform={tipTransform} opacity={tipOpacity}>
            <Circle cx={0} cy={0} r={3.4 * sScale} color={CREAM_HOT} opacity={0.28} />
            <Circle cx={0} cy={0} r={1.5 * sScale} color={CREAM_HOT} />
          </Group>
          {/* Energía viajando (continuo) — mismo glow apilado, un poco mayor. */}
          <Group transform={energyTransform} opacity={energyOpacity}>
            <Circle cx={0} cy={0} r={4.2 * sScale} color={CREAM_HOT} opacity={0.26} />
            <Circle cx={0} cy={0} r={1.7 * sScale} color={CREAM_HOT} />
          </Group>
        </>
      ) : null}
    </>
  )
}

/* Soft multi-layer bloom for the alpha (hero) stars — 4 stacked discs that
 * breathe scale + opacity. Matches figure-base/HeroGlow. */
function HeroGlow({
  p,
  phase,
  t,
  reduce,
}: {
  p: Px
  phase: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const groupOpacity = useDerivedValue(() => {
    if (reduce) return 0.6
    const wave = 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    return 0.45 + wave * 0.3
  })
  const transform = useDerivedValue(() => {
    const wave = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.12
    return [
      { translateX: p.x },
      { translateY: p.y },
      { scale },
      { translateX: -p.x },
      { translateY: -p.y },
    ]
  })
  // Glow con RadialGradient (NO círculos planos apilados): se desvanece suave
  // a transparente, sin el borde duro del círculo que se veía "sin difuminar".
  return (
    <Group opacity={groupOpacity} transform={transform}>
      <Circle cx={p.x} cy={p.y} r={p.r * 3.6}>
        <RadialGradient
          c={vec(p.x, p.y)}
          r={p.r * 3.6}
          colors={[
            'rgba(255,246,229,0.32)',
            'rgba(244,236,222,0.14)',
            'rgba(217,174,111,0.05)',
            'rgba(217,174,111,0)',
          ]}
          positions={[0, 0.4, 0.72, 1]}
        />
      </Circle>
    </Group>
  )
}

function SkiaPlaceholderStar({
  p,
  i,
  t,
  reduce,
}: {
  p: Px
  i: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const isHero = p.mag <= HERO_MAG
  const phase = (i * 0.137) % 1
  const opacity = useDerivedValue(() => {
    if (reduce) return 0.4
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const cycle = (t.value * 2.4 + i * 0.31) % 1
    let tk = 1
    if (cycle < 0.04) tk = 1 - (cycle / 0.04) * 0.58
    else if (cycle < 0.08) tk = 0.42 + ((cycle - 0.04) / 0.04) * 0.58
    const o = (0.32 + 0.1 * wave) * tk
    return o > 1 ? 1 : o
  })
  // Body breath — softer ±7 % size pulse than lit stars.
  const bodyTransform = useDerivedValue(() => {
    const w = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const scale = 1 + w * 0.07
    return scaleAbout(p.x, p.y, scale)
  })
  return (
    <>
      {isHero ? <HeroGlow p={p} phase={phase} t={t} reduce={reduce} /> : null}
      <Group opacity={opacity} transform={bodyTransform}>
        <Path path={fourPointStarPath(p.x, p.y, p.r)} color={CREAM} />
      </Group>
    </>
  )
}

function SkiaLitStar({
  p,
  i,
  recency,
  depth,
  sScale,
  t,
  breathT,
  reduce,
}: {
  p: Px
  i: number
  recency: number
  depth: number
  sScale: number
  t: SharedValue<number>
  breathT: SharedValue<number>
  reduce: boolean
}) {
  const isHero = p.mag <= HERO_MAG
  const phase = (i * 0.137) % 1
  const haloMult = recencyHaloMultiplier(recency)
  const breathStart = 0.85 + depth * 0.02

  // Cascade breath pulse shared by the halos — alpha first, each shell ~320 ms
  // later, radiating outward (matches lit-star.tsx).
  const cascade = useDerivedValue(() => {
    if (reduce) return 0
    const bc = (breathT.value - breathStart + 1) % 1
    return bc < 0.1 ? Math.sin((bc / 0.1) * Math.PI) : 0
  })
  const wave = useDerivedValue(() =>
    reduce ? 1 : 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI),
  )

  // Glow suave ÚNICO (RadialGradient, sin borde). Respira por SCALE de grupo +
  // opacidad — el radio del gradiente queda ESTÁTICO (no se reconstruye por
  // frame = performante). Reemplaza los 3 halos planos que leían "dos círculos".
  const glowBaseR = p.r + 8 * haloMult * sScale
  const glowOpacity = useDerivedValue(
    () => (0.2 + 0.12 * wave.value) * haloMult + cascade.value * 0.12 * haloMult,
  )
  const glowScale = useDerivedValue(() =>
    scaleAbout(p.x, p.y, 1 + wave.value * 0.08 + cascade.value * 0.3),
  )

  // Body twinkle (cream sparkle) + ±10 % breath scale.
  const bodyOpacity = useDerivedValue(() => {
    if (reduce) return 0.95
    const w = wave.value
    const cycle = (t.value * 2.4 + i * 0.31) % 1
    let tk = 1
    if (cycle < 0.04) tk = 1 - (cycle / 0.04) * 0.35
    else if (cycle < 0.08) tk = 0.65 + ((cycle - 0.04) / 0.04) * 0.35
    const o = (0.85 + 0.15 * w) * tk
    return o > 1 ? 1 : o
  })
  const bodyTransform = useDerivedValue(() => scaleAbout(p.x, p.y, 1 + wave.value * 0.1))

  return (
    <>
      {isHero ? <HeroGlow p={p} phase={phase} t={t} reduce={reduce} /> : null}
      {/* Glow suave (RadialGradient → se desvanece a transparente, sin el borde
          duro de los círculos planos). El flare encima añade el bloom magenta. */}
      <Group opacity={glowOpacity} transform={glowScale}>
        <Circle cx={p.x} cy={p.y} r={glowBaseR}>
          <RadialGradient
            c={vec(p.x, p.y)}
            r={glowBaseR}
            colors={['rgba(255,246,229,0.85)', 'rgba(217,174,111,0.4)', 'rgba(217,174,111,0)']}
            positions={[0, 0.45, 1]}
          />
        </Circle>
      </Group>
      {/* Body sparkle */}
      <Group opacity={bodyOpacity} transform={bodyTransform}>
        <Path path={fourPointStarPath(p.x, p.y, p.r)} color={CREAM_HOT} />
      </Group>
      {/* White-hot pinpoint */}
      <Circle cx={p.x} cy={p.y} r={Math.max(0.5, p.r * 0.16)} color={WHITE_HOT} opacity={0.75} />
      {/* El anillo PUNTEADO de "estrella de hoy" se retiró: leía como clip-art
          (no celestial) y su borde competía con el flare. La estrella de hoy ya
          es la más fresca (mayor halo por recency 0) + su flare la distingue. */}
    </>
  )
}

function SkiaNextStar({
  p,
  sScale,
  t,
  reduce,
}: {
  p: Px
  sScale: number
  t: SharedValue<number>
  reduce: boolean
}) {
  // Breathing magenta halo — the "next to ignite" affordance. Swells ~every 3s.
  const haloOpacity = useDerivedValue(() => {
    if (reduce) return 0.5
    const w = 0.5 + 0.5 * Math.sin(t.value * (8 / 3) * 2 * Math.PI)
    return 0.32 + w * 0.28
  })
  const haloR = useDerivedValue(() => {
    const w = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t.value * (8 / 3) * 2 * Math.PI)
    return p.r + (4 + w * 4) * sScale
  })
  return (
    <>
      <Circle cx={p.x} cy={p.y} r={haloR} color={MAGENTA} opacity={haloOpacity}>
        <BlurMask blur={p.r * 0.7} style="normal" />
      </Circle>
      <Path path={fourPointStarPath(p.x, p.y, p.r)} color={MAGENTA} />
    </>
  )
}

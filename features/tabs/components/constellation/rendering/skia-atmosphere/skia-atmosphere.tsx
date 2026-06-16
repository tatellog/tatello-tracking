import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia'
import { memo, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

import {
  AMBIENT_ASPECT,
  AMBIENT_BUCKET_COUNT,
  AMBIENT_LAYERS,
  AMBIENT_PER_LAYER_ALPHA,
  AMBIENT_RX_MAX,
  AMBIENT_RX_MIN,
  H,
  NEBULA_LAYERS,
  PAD,
  W,
} from '../../constants'
import { BUCKET_DRIFT, buildAmbientField, DEEP_STARS, DUST } from '../../data/scatter'
import type { AmbientStar } from '../../types'

/*
 * SkiaAtmosphere — el "cielo vivo" (campo de estrellas + nebulosa + polvo +
 * estrellas fugaces + glow + field stars) dibujado en UN solo <Canvas> Skia
 * en vez de react-native-svg.
 *
 * WHY: RNSVG re-rasteriza el árbol <Svg> ENTERO en cada frame que cambia un
 * hijo animado. Estas capas titilan/derivan sobre `t`/`drift`, así que
 * mantenían el SVG repintándose 60×/s — el costo #1 del hero. En Skia cada
 * nodo se compone en GPU, barato, y al sacarlas del SVG ese árbol queda SOLO
 * con hijos estáticos (defs + viñeta) → se rasteriza UNA vez y deja de
 * repintar por frame. La figura ya migró (SkiaFigure); esto es la atmósfera.
 *
 * Coordenadas: todo se dibuja en el viewBox original (0..W, 0..H) dentro de un
 * <Group transform={[{scale:k}]}> con k = canvasPx/W — idéntico a cómo el <Svg>
 * escalaba su viewBox a píxeles. Así la matemática de cada capa se copia tal
 * cual de los componentes SVG originales.
 *
 * Z-order dentro del canvas (de atrás hacia adelante, igual que el SVG):
 *   deep → ambient → shooting → glow → nebula → dust → field.
 * La viñeta sigue siendo un <Rect> estático del SVG montado ENCIMA de este
 * canvas: oscurece todo el backdrop por composición alfa (incluidas las field
 * stars — antes quedaban sobre la viñeta; el cambio es mínimo y las field
 * viven en el dónut medio, lejos de las esquinas oscuras).
 *
 * reduce-motion: shooting + dust se suprimen (como en el SVG); el resto se
 * dibuja igual pero con los relojes parados (static), así queda quieto pero
 * visible.
 */

const CREAM = '#F4ECDE'
const CREAM_HOT = '#FFF6E5'
const WHITE = '#FFFFFF'
const NEBULA_WARM = '#5A1438'
const NEBULA_COOL = '#2A1838'
const NEBULA_DEEP = '#A6164A'
const NEBULA_BRONZE = '#7A5A38'

export const SkiaAtmosphere = memo(function SkiaAtmosphere({
  t,
  drift,
  k,
  ax,
  ay,
  fieldStars,
  litKeys,
  reduce,
}: {
  t: SharedValue<number>
  drift: SharedValue<number>
  /** canvasPx / W — escala viewBox → píxeles. */
  k: number
  /** Posición de la estrella alfa (viewBox) — sesga la nebulosa cálida. */
  ax: number
  ay: number
  fieldStars: readonly { x: number; y: number }[]
  litKeys: Set<string>
  reduce: boolean
}) {
  const scale = useMemo(() => [{ scale: k }], [k])
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group transform={scale}>
        <SkiaDeepField drift={drift} />
        <SkiaAmbientField t={t} drift={drift} />
        {reduce ? null : (
          <>
            <SkiaShootingStar t={t} cycleDiv={1.6} phase={0} startY={40} endY={H * 0.55} />
            <SkiaShootingStar t={t} cycleDiv={1.6} phase={0.42} startY={H * 0.15} endY={H * 0.85} />
            <SkiaShootingStar t={t} cycleDiv={1.6} phase={0.74} startY={H * 0.7} endY={H * 0.3} />
          </>
        )}
        <SkiaAmbientGlow cx={W / 2} cy={H / 2} />
        <SkiaNebula ax={ax} ay={ay} drift={drift} />
        {reduce ? null : <SkiaCosmicDust t={t} />}
        {/* Viñeta — antes era un <Rect> del SVG montado encima de toda la
            atmósfera; ahora vive aquí, DESPUÉS del backdrop pero ANTES de las
            field stars (su z-order original). Oscurece el backdrop + el
            emblema de abajo por composición alfa; las field stars quedan
            encima, sin atenuar. Mover la viñeta acá deja al <Svg> sin trabajo
            visible → se desmonta en el caso común. */}
        <SkiaVignette />
        <SkiaFieldStars fieldStars={fieldStars} litKeys={litKeys} t={t} />
      </Group>
    </Canvas>
  )
})

/* ── Viñeta — radial (esquinas) + edge-fade vertical (bordes sup/inf) ── */
const BG = '10,6,8' // colors.bg #0A0608

function SkiaVignette() {
  return (
    <>
      {/* cardVignette — radial, transparente al centro, oscuro a los bordes. */}
      <Rect x={0} y={0} width={W} height={H}>
        <RadialGradient
          c={vec(W / 2, H / 2)}
          r={W * 0.75}
          colors={[`rgba(${BG},0)`, `rgba(${BG},0.14)`, `rgba(${BG},0.45)`, `rgba(${BG},0.85)`]}
          positions={[0, 0.4, 0.7, 1]}
        />
      </Rect>
      {/* cardEdgeFade — lineal vertical, disuelve sup/inf en el fondo. */}
      <Rect x={0} y={0} width={W} height={H}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, H)}
          colors={[
            `rgba(${BG},1)`,
            `rgba(${BG},0.85)`,
            `rgba(${BG},0.45)`,
            `rgba(${BG},0)`,
            `rgba(${BG},0)`,
            `rgba(${BG},0.45)`,
            `rgba(${BG},0.85)`,
            `rgba(${BG},1)`,
          ]}
          positions={[0, 0.06, 0.14, 0.24, 0.76, 0.86, 0.94, 1]}
        />
      </Rect>
    </>
  )
}

/* ── Deep field — 16 micro-stars, drift 6× lento (parallax) ──────────── */
function SkiaDeepField({ drift }: { drift: SharedValue<number> }) {
  const transform = useDerivedValue(() => {
    const a = drift.value * 2 * Math.PI * 0.15
    return [{ translateX: Math.sin(a) * 4 }, { translateY: Math.cos(a) * 3 }]
  })
  return (
    <Group transform={transform}>
      {DEEP_STARS.map((s, i) => (
        <Circle key={`d-${i}`} cx={s.x} cy={s.y} r={s.r} color={CREAM} opacity={s.op} />
      ))}
    </Group>
  )
}

/* ── Ambient field — 30 estrellas en 5 buckets que titilan sobre `t` ─── */
function SkiaAmbientField({ t, drift }: { t: SharedValue<number>; drift: SharedValue<number> }) {
  const buckets = useMemo(() => buildAmbientField(), [])
  return (
    <>
      {buckets.map((stars, bucketIdx) => (
        <SkiaAmbientBucket
          key={bucketIdx}
          stars={stars}
          bucketIdx={bucketIdx}
          t={t}
          drift={drift}
        />
      ))}
    </>
  )
}

function SkiaAmbientBucket({
  stars,
  bucketIdx,
  t,
  drift,
}: {
  stars: AmbientStar[]
  bucketIdx: number
  t: SharedValue<number>
  drift: SharedValue<number>
}) {
  const phase = bucketIdx / AMBIENT_BUCKET_COUNT
  const b = BUCKET_DRIFT[bucketIdx % BUCKET_DRIFT.length]!
  // Capturar primitivos fuera del worklet (no acceder al array dentro).
  const bAx = b.ax
  const bAy = b.ay
  const bPhase = b.phase
  const opacity = useDerivedValue(() => {
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return 0.35 + 0.65 * wave
  })
  const transform = useDerivedValue(() => {
    const a = (drift.value + bPhase) * 2 * Math.PI
    return [{ translateX: Math.sin(a) * bAx }, { translateY: Math.cos(a) * bAy }]
  })
  return (
    <Group opacity={opacity} transform={transform}>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} color={CREAM} opacity={s.baseOp * 3} />
      ))}
    </Group>
  )
}

/* ── Shooting star — racha rara (~7% del ciclo) cruzando el lienzo ───── */
function SkiaShootingStar({
  t,
  cycleDiv,
  phase,
  startY,
  endY,
  active = 0.07,
}: {
  t: SharedValue<number>
  cycleDiv: number
  phase: number
  startY: number
  endY: number
  active?: number
}) {
  const startX = -20
  const endX = W + 20
  // La cola es un vector FIJO (el ángulo de viaje no cambia) → path estático,
  // calculado UNA vez, relativo al origen; el Group lo traslada a la cabeza.
  // Cabeza y cola comparten el MISMO transform → nunca se desincronizan.
  const hyp = Math.hypot(endX - startX, endY - startY)
  const dx = (endX - startX) / hyp
  const dy = (endY - startY) / hyp
  const tailLen = 26
  const trailPath = `M${(-dx * tailLen).toFixed(2)},${(-dy * tailLen).toFixed(2)}L0,0`

  const transform = useDerivedValue(() => {
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return [{ translateX: -9999 }, { translateY: -9999 }]
    const local = cycle / active
    return [
      { translateX: startX + (endX - startX) * local },
      { translateY: startY + (endY - startY) * local },
    ]
  })
  const headOpacity = useDerivedValue(() => {
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return 0
    const local = cycle / active
    if (local < 0.15) return local / 0.15
    if (local > 0.7) return 1 - (local - 0.7) / 0.3
    return 1
  })
  const trailOpacity = useDerivedValue(() => headOpacity.value * 0.6)
  return (
    <>
      <Group transform={transform} opacity={trailOpacity}>
        <Path path={trailPath} color={WHITE} style="stroke" strokeWidth={1.4} strokeCap="round" />
      </Group>
      <Group transform={transform} opacity={headOpacity}>
        <Circle cx={0} cy={0} r={2.2} color={WHITE} />
      </Group>
    </>
  )
}

/* ── Ambient glow — wash magenta estático (12 elipses concéntricas) ──── */
function SkiaAmbientGlow({ cx, cy }: { cx: number; cy: number }) {
  return (
    <Group>
      {Array.from({ length: AMBIENT_LAYERS }).map((_, i) => {
        const tt = i / (AMBIENT_LAYERS - 1)
        const rx = AMBIENT_RX_MAX - (AMBIENT_RX_MAX - AMBIENT_RX_MIN) * tt
        const ry = rx / AMBIENT_ASPECT
        return (
          <Oval
            key={i}
            x={cx - rx}
            y={cy - ry}
            width={rx * 2}
            height={ry * 2}
            color={colors.magenta}
            opacity={AMBIENT_PER_LAYER_ALPHA}
          />
        )
      })}
    </Group>
  )
}

/* ── Nebula — 4 parches de elipses apiladas que derivan sobre `drift` ── */
function SkiaNebula({ ax, ay, drift }: { ax: number; ay: number; drift: SharedValue<number> }) {
  const cx = W / 2
  const cy = H / 2
  const wx = cx + (ax - cx) * 0.6
  const wy = cy + (ay - cy) * 0.6
  const ccx = cx - (wx - cx)
  const ccy = cy - (wy - cy)
  const bx = cx + 60
  const by = cy - 40

  const warmT = useDerivedValue(() => {
    const a = drift.value * 2 * Math.PI
    return [{ translateX: Math.sin(a) * 22 }, { translateY: Math.cos(a) * 14 }]
  })
  const warmOpacity = useDerivedValue(
    () => 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.7)),
  )
  const coolT = useDerivedValue(() => {
    const a = drift.value * 2 * Math.PI + Math.PI * 0.7
    return [{ translateX: Math.sin(a) * 18 }, { translateY: Math.cos(a) * 24 }]
  })
  const coolOpacity = useDerivedValue(
    () => 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.45 + Math.PI * 0.4)),
  )
  const deepT = useDerivedValue(() => {
    const a = drift.value * 2 * Math.PI + Math.PI * 1.3
    return [{ translateX: Math.sin(a) * 10 }, { translateY: Math.cos(a) * 8 }]
  })
  const deepOpacity = useDerivedValue(
    () => 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.55 + Math.PI * 1.1)),
  )
  const bronzeT = useDerivedValue(() => {
    const a = drift.value * 2 * Math.PI + Math.PI * 0.35
    return [{ translateX: Math.sin(a) * 16 }, { translateY: Math.cos(a) * 12 }]
  })
  const bronzeOpacity = useDerivedValue(
    () => 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.85 + Math.PI * 0.6)),
  )

  return (
    <Group>
      <Group transform={warmT} opacity={warmOpacity}>
        {nebulaLayers(wx, wy, 195, 140, 0.78, 0.018, 0.04, NEBULA_WARM)}
      </Group>
      <Group transform={coolT} opacity={coolOpacity}>
        {nebulaLayers(ccx, ccy, 165, 115, 1.18, 0.013, 0.025, NEBULA_COOL)}
      </Group>
      <Group transform={deepT} opacity={deepOpacity}>
        {nebulaLayers(cx, cy, 130, 95, 0.92, 0.014, 0.035, NEBULA_DEEP)}
      </Group>
      <Group transform={bronzeT} opacity={bronzeOpacity}>
        {nebulaLayers(bx, by, 110, 75, 1.05, 0.009, 0.018, NEBULA_BRONZE)}
      </Group>
    </Group>
  )
}

function nebulaLayers(
  cx: number,
  cy: number,
  rxBase: number,
  rxRange: number,
  ryRatio: number,
  opBase: number,
  opRange: number,
  fill: string,
) {
  return Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
    const tt = i / (NEBULA_LAYERS - 1)
    const rx = rxBase - rxRange * tt
    const ry = rx * ryRatio
    const op = opBase + tt * opRange
    return (
      <Oval
        key={i}
        x={cx - rx}
        y={cy - ry}
        width={rx * 2}
        height={ry * 2}
        color={fill}
        opacity={op}
      />
    )
  })
}

/* ── Cosmic dust — 7 motas que suben lento meciéndose ───────────────── */
function SkiaCosmicDust({ t }: { t: SharedValue<number> }) {
  return (
    <>
      {DUST.map((p, i) => {
        const baseX = p.x * W
        return (
          <SkiaDustMote
            key={i}
            baseX={baseX}
            period={p.period}
            phase={p.phase}
            sway={p.sway}
            r={p.r}
            baseOpacity={p.opacity}
            t={t}
          />
        )
      })}
    </>
  )
}

function SkiaDustMote({
  baseX,
  period,
  phase,
  sway,
  r,
  baseOpacity,
  t,
}: {
  baseX: number
  period: number
  phase: number
  sway: number
  r: number
  baseOpacity: number
  t: SharedValue<number>
}) {
  const transform = useDerivedValue(() => {
    const u = (t.value / period + phase) % 1
    const y = H + 20 - u * (H + 40)
    const x = baseX + Math.sin(u * Math.PI * 2) * sway
    return [{ translateX: x }, { translateY: y }]
  })
  const opacity = useDerivedValue(() => {
    const u = (t.value / period + phase) % 1
    let op = baseOpacity
    if (u < 0.12) op *= u / 0.12
    else if (u > 0.88) op *= 1 - (u - 0.88) / 0.12
    return op
  })
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={r} color={CREAM_HOT} />
    </Group>
  )
}

/* ── Field stars — las padding stars encendidas (titilan) ───────────── */
function SkiaFieldStars({
  fieldStars,
  litKeys,
  t,
}: {
  fieldStars: readonly { x: number; y: number }[]
  litKeys: Set<string>
  t: SharedValue<number>
}) {
  return (
    <>
      {fieldStars.map((fs, n) =>
        litKeys.has(`field-${n}`) ? <SkiaFieldStar key={n} fs={fs} n={n} t={t} /> : null,
      )}
    </>
  )
}

function SkiaFieldStar({
  fs,
  n,
  t,
}: {
  fs: { x: number; y: number }
  n: number
  t: SharedValue<number>
}) {
  const cx = PAD + fs.x * (W - 2 * PAD)
  const cy = PAD + fs.y * (H - 2 * PAD)
  const phase = (n * 0.21) % 1
  const opacity = useDerivedValue(() => {
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return 0.4 + 0.2 * wave
  })
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={4} color={colors.magenta} opacity={0.18} />
      <Circle cx={cx} cy={cy} r={1.6} color={colors.magenta} />
      <Circle cx={cx} cy={cy} r={0.7} color="#FBD7E3" opacity={0.9} />
    </Group>
  )
}

import { Fragment, memo, useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors, typography } from '@/theme'

import type { Finding } from '../findings'

/*
 * OBJETOS DE CONSTELACIÓN de Órbita · Mes — cada hallazgo se DIBUJA como una
 * carta celeste (cartografía de una relación), no como un bloque de texto.
 * Lenguaje visual (illustrator-specialist):
 *
 *   · RelationConstellation  →  "A ↔ déficit": dos nodos-estrella ✦ (dimensión
 *     A y déficit) unidos por un arco hairline. El arco ES la línea del tiempo:
 *     los días que coincidieron son puntos encendidos sobre él, y una señal de
 *     luz VIAJA de A → déficit (la dirección de la relación). MISMO objeto para
 *     agua→déficit y entreno→déficit; sólo cambia el color/label del nodo A.
 *
 *   · DeficitBraceletConstellation  →  "N de M días en déficit": un arco de M
 *     estrellas, N ya encendidas (magenta), el resto latentes (contorno). La
 *     última encendida lleva núcleo blanco-caliente (el borde que avanza).
 *
 *   · WeekStripConstellation  →  "un día pesa más": 7 estrellas (L–D) a ALTURA
 *     proporcional a sus kcal — la silueta del cielo de la semana; el día
 *     destacado sube y brilla.
 *
 * Reglas de perf/estabilidad del repo respetadas:
 *   · Sólo se anima opacidad / escala / posición / radio. NUNCA color (crash
 *     conocido de gradientes animados).
 *   · Sin rotate en transform-array (bug Android). Los ✦ usan `rotation` prop.
 *   · Los loops se lanzan en useEffect y se cancelan en unmount (cancelAnimation).
 *   · Toda la geometría comparte la firma `fourPointStarPath` del emblema.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/* Bézier cuadrática — el arco que une los dos nodos y sostiene los días. */
const P0 = { x: 42, y: 56 }
const CTRL = { x: 120, y: 40 }
const P1 = { x: 198, y: 56 }
const ARC_D = `M${P0.x} ${P0.y} Q${CTRL.x} ${CTRL.y} ${P1.x} ${P1.y}`

function quadPoint(t: number) {
  const u = 1 - t
  return {
    x: u * u * P0.x + 2 * u * t * CTRL.x + t * t * P1.x,
    y: u * u * P0.y + 2 * u * t * CTRL.y + t * t * P1.y,
  }
}

/* ────────────────────────────────────────────────────────────────────────
 * 1 · OBJETO GENÉRICO  ·  A ↔ déficit
 * viewBox 240×100. Nodo A izq (color dimensión) · déficit der (magenta, norte).
 * ──────────────────────────────────────────────────────────────────────── */

export type RelationDay = 'strong' | 'on' | 'off'

export const RelationConstellation = memo(function RelationConstellation({
  colorA,
  labelA,
  days,
  width = 300,
}: {
  colorA: string
  labelA: string
  /** patrón de días (misma semántica que dotTimeline): strong = coincidió. */
  days: RelationDay[]
  width?: number
}) {
  const height = (width * 100) / 240

  // Respiración de los nodos — desfasada entre A y déficit (asimetría viva).
  const breathA = useSharedValue(0)
  const breathN = useSharedValue(0)
  // Señal que viaja A → déficit (la dirección de la relación).
  const travel = useSharedValue(0)

  useEffect(() => {
    breathA.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    breathN.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, true),
    )
    travel.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(breathA)
      cancelAnimation(breathN)
      cancelAnimation(travel)
    }
  }, [breathA, breathN, travel])

  // Nodo A: ✦ color dimensión, latido suave.
  const aStarProps = useAnimatedProps(() => ({ fillOpacity: 0.82 + breathA.value * 0.18 }))
  const aHaloProps = useAnimatedProps(() => ({ r: 12 + breathA.value * 2.5 }))
  // Nodo déficit: ✦ magenta, latido + halo bloom (el cue "está vivo", el norte).
  const nStarProps = useAnimatedProps(() => ({ fillOpacity: 0.85 + breathN.value * 0.15 }))
  const nHaloProps = useAnimatedProps(() => ({ r: 13 + breathN.value * 3 }))
  // Señal viajera.
  const signalProps = useAnimatedProps(() => {
    'worklet'
    const t = travel.value
    const u = 1 - t
    const x = u * u * P0.x + 2 * u * t * CTRL.x + t * t * P1.x
    const y = u * u * P0.y + 2 * u * t * CTRL.y + t * t * P1.y
    // Se desvanece en los extremos: nace en A, muere en déficit.
    const fade = Math.min(t / 0.14, (1 - t) / 0.14, 1)
    return { cx: x, cy: y, opacity: Math.max(0, fade) }
  })

  const aId = `rc-a-${colorA.replace('#', '')}`

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height} viewBox="0 0 240 100" pointerEvents="none">
        <Defs>
          <RadialGradient id={aId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colorA} stopOpacity={0.32} />
            <Stop offset="0.5" stopColor={colorA} stopOpacity={0.1} />
            <Stop offset="1" stopColor={colorA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="rc-n" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.4} />
            <Stop offset="0.5" stopColor={colors.magenta} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Arco conector — hairline. Es la línea del tiempo de la relación. */}
        <Path d={ARC_D} stroke={colors.hairlineStrong} strokeWidth={1} fill="none" />

        {/* Glint celeste en el ápice (la firma ✦, en vez de la lunita decorativa). */}
        <Path d={fourPointStarPath(CTRL.x, CTRL.y + 2, 2.6)} fill={colors.leche} opacity={0.42} />

        {/* Días sobre el arco: strong = encendido (magenta), on = tenue. */}
        {days.slice(0, 11).map((d, i, arr) => {
          if (d === 'off') return null
          const t = (i + 1) / (arr.length + 1)
          const p = quadPoint(t)
          const strong = d === 'strong'
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={strong ? 2.4 : 1.5}
              fill={strong ? colors.magentaHot : colors.niebla}
              opacity={strong ? 0.95 : 0.5}
            />
          )
        })}

        {/* Señal viajera A → déficit. */}
        <AnimatedCircle animatedProps={signalProps} r={2} fill={colors.leche} />

        {/* NODO A (dimensión). */}
        <AnimatedCircle cx={32} cy={56} animatedProps={aHaloProps} fill={`url(#${aId})`} />
        <AnimatedPath d={fourPointStarPath(32, 56, 6.4)} fill={colorA} animatedProps={aStarProps} />
        <Path
          d={fourPointStarPath(32, 56, 3.4)}
          fill={colorA}
          rotation={45}
          originX={32}
          originY={56}
          opacity={0.85}
        />

        {/* NODO DÉFICIT (norte). Un punto más grande + núcleo blanco-caliente. */}
        <AnimatedCircle cx={208} cy={56} animatedProps={nHaloProps} fill="url(#rc-n)" />
        <AnimatedPath
          d={fourPointStarPath(208, 56, 7.4)}
          fill={colors.magenta}
          animatedProps={nStarProps}
        />
        <Path
          d={fourPointStarPath(208, 56, 3.9)}
          fill={colors.magentaHot}
          rotation={45}
          originX={208}
          originY={56}
          opacity={0.9}
        />
        <Circle cx={208} cy={55.4} r={1.4} fill={colors.oroLeche} opacity={0.95} />
      </Svg>

      {/* Labels bajo cada nodo — Hanken uppercase (identidad, no serif). */}
      <View style={styles.labelRow}>
        <Text style={[styles.nodeLabel, { color: colorA }]}>{labelA}</Text>
        <Text style={[styles.nodeLabel, styles.nodeLabelRight]}>DÉFICIT</Text>
      </View>
    </View>
  )
})

/* ────────────────────────────────────────────────────────────────────────
 * 2 · DÉFICIT-RESUMEN  ·  N de M (una sola dimensión, no relación)
 * Arco de M estrellas; N encendidas magenta, resto latentes. La última
 * encendida lleva núcleo — el borde que avanza.
 * ──────────────────────────────────────────────────────────────────────── */

const DB_AX = { x: 30, y: 62 }
const DB_AC = { x: 120, y: 20 }
const DB_AP = { x: 210, y: 62 }
const dbAt = (t: number) => {
  const u = 1 - t
  return {
    x: u * u * DB_AX.x + 2 * u * t * DB_AC.x + t * t * DB_AP.x,
    y: u * u * DB_AX.y + 2 * u * t * DB_AC.y + t * t * DB_AP.y,
  }
}

export const DeficitBraceletConstellation = memo(function DeficitBraceletConstellation({
  lit,
  total,
  width = 300,
}: {
  lit: number
  total: number
  width?: number
}) {
  const m = Math.max(1, Math.min(total, 31))
  const n = Math.max(0, Math.min(lit, m))
  const height = (width * 96) / 240

  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(pulse)
  }, [pulse])
  const headHalo = useAnimatedProps(() => ({
    r: 7 + pulse.value * 3,
    opacity: 0.5 - pulse.value * 0.28,
  }))

  const head = n > 0 ? dbAt(m === 1 ? 0.5 : (n - 1) / (m - 1)) : null

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height} viewBox="0 0 240 96" pointerEvents="none">
        <Defs>
          <RadialGradient id="db-head" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.45} />
            <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {Array.from({ length: m }).map((_, i) => {
          const t = m === 1 ? 0.5 : i / (m - 1)
          const p = dbAt(t)
          const isLit = i < n
          const isHead = i === n - 1
          if (!isLit) {
            // Latente — contorno ✦ (misma estrella esperando encenderse).
            return (
              <Path
                key={i}
                d={fourPointStarPath(p.x, p.y, 2.6)}
                fill="none"
                stroke={colors.niebla}
                strokeWidth={0.9}
                strokeLinejoin="round"
                opacity={0.45}
              />
            )
          }
          return (
            <Path
              key={i}
              d={fourPointStarPath(p.x, p.y, isHead ? 4 : 3)}
              fill={isHead ? colors.magentaHot : colors.magenta}
              opacity={isHead ? 1 : 0.9}
            />
          )
        })}

        {/* Borde que avanza — halo + núcleo en la última encendida. */}
        {head ? (
          <>
            <AnimatedCircle cx={head.x} cy={head.y} animatedProps={headHalo} fill="url(#db-head)" />
            <Circle cx={head.x} cy={head.y - 0.4} r={1.2} fill={colors.oroLeche} opacity={0.95} />
          </>
        ) : null}
      </Svg>
    </View>
  )
})

/* ────────────────────────────────────────────────────────────────────────
 * 3 · SEMANA  ·  un día pesa más (viernes → kcal)
 * 7 estrellas L–D a altura ∝ kcal. El día destacado sube y brilla.
 * ──────────────────────────────────────────────────────────────────────── */

type WeekBar = { label: string; value: number; highlight?: boolean }

export const WeekStripConstellation = memo(function WeekStripConstellation({
  bars,
  tint = colors.oroSoft,
  width = 300,
}: {
  bars: WeekBar[]
  /** color del día destacado (kcal → oro cálido por defecto). */
  tint?: string
  width?: number
}) {
  const height = (width * 110) / 240
  const max = Math.max(1, ...bars.map((b) => b.value))
  const n = bars.length || 7
  const left = 24
  const right = 216
  const span = right - left
  const topY = 26 // estrella más alta
  const baseY = 78 // más baja
  const x = (i: number) => left + (span * i) / (n - 1)
  const y = (v: number) => baseY - (baseY - topY) * (v / max)

  const twinkle = useSharedValue(0)
  useEffect(() => {
    twinkle.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(twinkle)
  }, [twinkle])
  const hiHalo = useAnimatedProps(() => ({ r: 11 + twinkle.value * 3 }))

  // Silueta hairline que une las estrellas (la línea del cielo de la semana).
  const skyline = bars
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(b.value).toFixed(1)}`)
    .join(' ')

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height} viewBox="0 0 240 110" pointerEvents="none">
        <Defs>
          <RadialGradient id="ws-hi" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.4} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Path d={skyline} stroke={colors.hairline} strokeWidth={1} fill="none" />

        {bars.map((b, i) => {
          const cx = x(i)
          const cy = y(b.value)
          if (b.highlight) {
            return (
              <Fragment key={i}>
                <AnimatedCircle cx={cx} cy={cy} animatedProps={hiHalo} fill="url(#ws-hi)" />
                <Path d={fourPointStarPath(cx, cy, 5.4)} fill={tint} />
                <Circle cx={cx} cy={cy - 0.4} r={1.2} fill={colors.oroLeche} opacity={0.9} />
              </Fragment>
            )
          }
          return <Circle key={i} cx={cx} cy={cy} r={2.3} fill={colors.bone} opacity={0.42} />
        })}

        {/* Etiquetas L–D alineadas a la X de cada estrella (SVG text). */}
        {bars.map((b, i) => (
          <SvgText
            key={`l${i}`}
            x={x(i)}
            y={100}
            fill={b.highlight ? tint : colors.niebla}
            fontSize={8}
            fontFamily={typography.uiBold}
            textAnchor="middle"
            opacity={b.highlight ? 0.95 : 0.6}
          >
            {b.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
})

/* ────────────────────────────────────────────────────────────────────────
 * ROUTER · el objeto-constelación que corresponde a un hallazgo.
 * Compartido por la antesala (cards) y el chat guiado (visual de apertura).
 * ──────────────────────────────────────────────────────────────────────── */

const CONSTELLATION_ACCENT: Record<string, string> = {
  'water-deficit': colors.signal.agua,
  'training-deficit': colors.signal.entreno,
  'deficit-summary': colors.magenta,
  'weekday-calories': colors.oroSoft,
}

/** El acento (color del nodo A) de un hallazgo. */
export function constellationAccent(f: Finding): string {
  return CONSTELLATION_ACCENT[f.id] ?? colors.magenta
}

/** Enruta un hallazgo a su objeto-constelación, leyendo `finding.charts`. */
export function FindingConstellation({ finding, width }: { finding: Finding; width: number }) {
  const chart = finding.charts[0]
  const accent = constellationAccent(finding)

  if (finding.id === 'water-deficit' || finding.id === 'training-deficit') {
    const days = chart?.kind === 'dotTimeline' ? (chart.dots as RelationDay[]) : []
    return (
      <RelationConstellation
        colorA={accent}
        labelA={finding.id === 'water-deficit' ? 'AGUA' : 'ENTRENO'}
        days={days}
        width={width}
      />
    )
  }
  if (finding.id === 'deficit-summary') {
    const dots = chart?.kind === 'dotTimeline' ? chart.dots : []
    const lit = dots.filter((d) => d === 'strong').length
    return <DeficitBraceletConstellation lit={lit} total={dots.length} width={width} />
  }
  if (finding.id === 'weekday-calories' && chart?.kind === 'weekdayBars') {
    return <WeekStripConstellation bars={chart.bars} width={width} />
  }
  return null
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: -6,
    // Aproxima los labels a la posición X de cada nodo (nodo A ~13%, déficit ~87%).
    paddingHorizontal: '9%',
  },
  nodeLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
  },
  nodeLabelRight: { color: colors.magentaHot },
})

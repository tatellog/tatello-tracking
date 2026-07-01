import { useEffect, useId, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg'

import BodyVect from '@/assets/icons/body-vect.svg'
import FoodVect from '@/assets/icons/food-vect.svg'
import MoonVect from '@/assets/icons/moon-vect.svg'
import ProteinVect from '@/assets/icons/protein-vect.svg'
import WaterVect from '@/assets/icons/water-vect.svg'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

/*
 * "Tu patrón dominante" (Órbita · Mes) — el asterismo de las señales que más se
 * acompañaron en los días en déficit. No es la "fórmula" radial de WinningCombo:
 * aquí el DÉFICIT es el norte (estrella-guía oro, en el vértice superior) y los
 * hábitos lo acompañan abajo. Las estrellas son DECORATIVAS (vivas por el glint):
 * el patrón es UNA sola cosa, así que la TARJETA entera abre su único detalle. No
 * se tocan por separado para no prometer detalles distintos que no existen (todas
 * las señales del combo están en el 100% de esos días → repetirían el mismo dato).
 *
 * Gramática Stelar: hilos y halos magenta, campo de estrellas tenue al fondo,
 * glint vivo (parpadeo de opacidad, pausable). El glifo de cada señal es de la
 * familia warm-gold (sin iconografía de gimnasio, línea roja del manifiesto); la
 * identidad de dimensión la lleva el halo de color, no el glifo. Las líneas son
 * NEUTRAS (no flechas): describen co-ocurrencia, nunca causa.
 *
 * Perf / Android release: SVG estático; solo se anima opacidad (glint) y escala
 * (press), nunca un path. La estrella-norte rota con props rotation/originX/
 * originY (no array transform → bug del APK Android). El glint se pausa fuera de
 * foco y con reduced-motion.
 */

export type PatternNode = { key: string; label: string; role?: 'deficit' | 'signal' }

const LENS = 52 // diámetro de la lente tappable (touch target ≥ 44)
const NODE_W = 96 // ancho de la caja nodo (lente + etiqueta de 2 líneas)
const HALO_R = 30 // halo de color de la dimensión
const GLYPH = 28
const FOOD_GOLD = '#ECDE96' // food-vect usa currentColor; no cruza el <Svg> anidado

/** El color del halo de cada nodo = el de su dimensión (mismo criterio que el
 *  resto de Órbita). Déficit = oro: es el norte de la app, no una dimensión. */
const NODE_COLOR: Record<string, string> = {
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  comida: colors.dimension.alimento,
  proteina: colors.signal.proteina,
  agua: colors.signal.agua,
  deficit: colors.oro,
}
const nodeColor = (key: string): string => NODE_COLOR[key] ?? colors.magenta
const isDeficit = (n: PatternNode): boolean =>
  n.role === 'deficit' || (n.role === undefined && n.key === 'deficit')

// El norte (déficit) corona arriba; los hábitos lo acompañan en un arco bajo.
// Posiciones asimétricas a propósito (la imperfección elegante del brief): nunca
// un triángulo equilátero ni una fila horizontal.
const DEFICIT_POS = { fx: 0.5, fy: 0.17 }
const HABIT_ARC: Record<number, { fx: number; fy: number }[]> = {
  1: [{ fx: 0.5, fy: 0.74 }],
  2: [
    { fx: 0.25, fy: 0.7 },
    { fx: 0.75, fy: 0.74 },
  ],
  3: [
    { fx: 0.17, fy: 0.62 },
    { fx: 0.5, fy: 0.8 },
    { fx: 0.83, fy: 0.64 },
  ],
  4: [
    { fx: 0.13, fy: 0.54 },
    { fx: 0.37, fy: 0.82 },
    { fx: 0.64, fy: 0.8 },
    { fx: 0.88, fy: 0.52 },
  ],
}
const heightFor = (habits: number): number => (habits >= 4 ? 256 : habits === 3 ? 234 : 210)

const AnimatedG = Animated.createAnimatedComponent(G)

/** Estrella de 4 púas con espigas finas (un destello, no una cruz). */
function sparklePath(cx: number, cy: number, outer: number, innerRatio: number): string {
  const inner = outer * innerRatio
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** Estrella-norte del déficit: oro, glint a 45° + un fino anillo de órbita que la
 *  distingue de cualquier estrella suelta. Es LUZ, no una placa ilustrada. */
function DeficitNorthStar({ size = 28 }: { size?: number }) {
  const c = 16
  const r = 6.4
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Circle cx={c} cy={c} r={11} stroke={colors.oroHairline} strokeWidth={0.8} fill="none" />
      <Path d={fourPointStarPath(c, c, r)} fill={colors.oro} />
      <Path
        d={fourPointStarPath(c, c, r * 0.5)}
        fill={colors.oroLight}
        rotation={45}
        originX={c}
        originY={c}
        opacity={0.9}
      />
      <Circle cx={c} cy={c} r={1.2} fill={colors.oroLeche} />
    </Svg>
  )
}

/** El glifo warm-gold de cada señal. La identidad de dimensión vive en el halo,
 *  no aquí (todos pintan en oro cálido). Déficit → la estrella-norte. */
function SignalGlyph({ keyName }: { keyName: string }) {
  switch (keyName) {
    case 'cuerpo':
      return <BodyVect width={GLYPH} height={GLYPH} preserveAspectRatio="xMidYMid meet" />
    case 'sueno':
      return <MoonVect width={GLYPH} height={GLYPH} preserveAspectRatio="xMidYMid meet" />
    case 'comida':
      return (
        <FoodVect
          width={GLYPH}
          height={GLYPH}
          color={FOOD_GOLD}
          preserveAspectRatio="xMidYMid meet"
        />
      )
    case 'proteina':
      return <ProteinVect width={GLYPH} height={GLYPH} preserveAspectRatio="xMidYMid meet" />
    case 'agua':
      return <WaterVect width={GLYPH} height={GLYPH} preserveAspectRatio="xMidYMid meet" />
    default:
      return <DeficitNorthStar size={GLYPH} />
  }
}

/** El destello de una estrella: un sparkle blanco cuyo brillo parpadea. Una sola
 *  fuente (`tw`) lo alimenta; `phase` lo desfasa. Con `tw` quieto queda en un
 *  brillo fijo, nunca negro. */
function Glint({
  x,
  y,
  size,
  phase,
  tw,
}: {
  x: number
  y: number
  size: number
  phase: number
  tw: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    const s = 0.5 + 0.5 * Math.sin((tw.value + phase) * Math.PI * 2)
    return { opacity: 0.12 + 0.7 * s * s }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={sparklePath(x, y, size, 0.06)} fill="#FFFFFF" />
      <Circle cx={x} cy={y} r={size * 0.22} fill="#FFFFFF" />
    </AnimatedG>
  )
}

// Campo de estrellas tenue al fondo (profundidad). Posiciones fijas.
const FIELD = [
  { fx: 0.12, fy: 0.18, r: 0.9, op: 0.16 },
  { fx: 0.86, fy: 0.14, r: 0.8, op: 0.14 },
  { fx: 0.5, fy: 0.48, r: 0.6, op: 0.1 },
  { fx: 0.18, fy: 0.86, r: 1.0, op: 0.16 },
  { fx: 0.9, fy: 0.78, r: 0.7, op: 0.12 },
  { fx: 0.66, fy: 0.92, r: 0.6, op: 0.1 },
] as const

const GLINT_PHASE = [0, 0.31, 0.62, 0.18, 0.5]

/* Una "estrella" del asterismo: el glifo de la señal dentro de una lente hairline
 * + su etiqueta. Decorativa: la tarjeta entera abre el único detalle del patrón,
 * así que el nodo no es tappable por separado. */
function PatternNodeView({ node, x, y }: { node: PatternNode; x: number; y: number }) {
  const def = isDeficit(node)
  return (
    <View style={[styles.node, { left: x - NODE_W / 2, top: y - LENS / 2, width: NODE_W }]}>
      <View style={[styles.lens, def && styles.lensDeficit]}>
        <SignalGlyph keyName={node.key} />
      </View>
      <Text numberOfLines={2} style={[styles.label, def && styles.labelDeficit]}>
        {node.label}
      </Text>
    </View>
  )
}

export function PatternConstellation({ nodes }: { nodes: PatternNode[] }) {
  // El déficit (norte) corona; los hábitos lo acompañan abajo, hasta 4.
  const deficitNode = nodes.find(isDeficit)
  const habitNodes = nodes.filter((n) => !isDeficit(n)).slice(0, 4)
  const ordered = deficitNode ? [deficitNode, ...habitNodes] : habitNodes
  const M = habitNodes.length
  const arc = HABIT_ARC[Math.min(Math.max(M, 1), 4)] ?? HABIT_ARC[2] ?? []
  const pos: { fx: number; fy: number }[] = deficitNode
    ? [DEFICIT_POS, ...arc.slice(0, M)]
    : arc.slice(0, M)
  const H = heightFor(M)

  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const gidBase = `pat-${useId().replace(/:/g, '')}`

  const tw = useSharedValue(0)
  const active = useScreenActive()
  const reduced = useReducedMotion() ?? false
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(tw)
      tw.value = 0
      return
    }
    tw.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(tw)
  }, [active, reduced, tw])

  const px = (i: number): number => (pos[i]?.fx ?? 0.5) * w
  const py = (i: number): number => (pos[i]?.fy ?? 0.5) * H

  // Hilos: del norte a cada hábito + hábitos adyacentes (cierra el asterismo).
  // Las aristas que tocan el déficit pesan un poco más (el norte "jala"); todas
  // NEUTRAS, sin flechas (co-ocurrencia, nunca causa).
  const edges: [number, number][] = []
  if (deficitNode) {
    for (let h = 1; h <= M; h++) edges.push([0, h])
    for (let h = 1; h < M; h++) edges.push([h, h + 1])
  } else {
    for (let h = 0; h < M - 1; h++) edges.push([h, h + 1])
  }

  return (
    <View
      style={[styles.composition, { height: H }]}
      onLayout={onLayout}
      accessible={false}
      pointerEvents="none"
    >
      {w > 0 ? (
        <Animated.View entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill}>
          <Svg width={w} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              {ordered.map((s, i) => (
                <RadialGradient key={`g-${i}`} id={`${gidBase}-${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={nodeColor(s.key)} stopOpacity={0.22} />
                  <Stop offset="55%" stopColor={nodeColor(s.key)} stopOpacity={0.08} />
                  <Stop offset="100%" stopColor={nodeColor(s.key)} stopOpacity={0} />
                </RadialGradient>
              ))}
            </Defs>

            {/* Campo de estrellas tenue — profundidad. */}
            {FIELD.map((f, i) => (
              <Circle
                key={`f-${i}`}
                cx={f.fx * w}
                cy={f.fy * H}
                r={f.r}
                fill={colors.leche}
                opacity={f.op}
              />
            ))}

            {/* Hilos de la coincidencia. */}
            {edges.map(([a, b], i) => {
              const hot = isDeficit(ordered[a]!) || isDeficit(ordered[b]!)
              return (
                <Line
                  key={`e-${i}`}
                  x1={px(a)}
                  y1={py(a)}
                  x2={px(b)}
                  y2={py(b)}
                  stroke={colors.magenta}
                  strokeWidth={hot ? 1 : 0.8}
                  strokeOpacity={hot ? 0.5 : 0.3}
                />
              )
            })}

            {/* Halos de color por nodo + glint vivo al borde. */}
            {ordered.map((s, i) => (
              <G key={`h-${s.key}-${i}`}>
                <Circle cx={px(i)} cy={py(i)} r={HALO_R} fill={`url(#${gidBase}-${i})`} />
                <Glint
                  x={px(i) + LENS * 0.3}
                  y={py(i) - LENS * 0.3}
                  size={4.6}
                  phase={GLINT_PHASE[i % GLINT_PHASE.length] ?? 0}
                  tw={tw}
                />
              </G>
            ))}
          </Svg>

          {/* Las estrellas (decorativas): una lente por nodo. */}
          {ordered.map((s, i) => (
            <PatternNodeView key={`n-${s.key}-${i}`} node={s} x={px(i)} y={py(i)} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  composition: {
    marginTop: 8,
    position: 'relative',
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
  },
  lens: {
    width: LENS,
    height: LENS,
    borderRadius: LENS / 2,
    borderWidth: StyleSheet.hairlineWidth * 1.4,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.lecheTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensDeficit: {
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  label: {
    marginTop: 9,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.leche,
    maxWidth: NODE_W,
  },
  labelDeficit: {
    color: colors.oroSoft,
  },
})

import { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { PatternRevealCosmos } from './PatternRevealCosmos'

/*
 * PatternConstellationReveal — la revelación de un patrón con el MISMO marco del
 * modal de Órbita·Mes (cosmos de fondo, texto abajo en voz de coach, cerrar),
 * pero en el lugar de la life-line va la ANIMACIÓN DE CONSTELACIÓN (nodos
 * conectados que se encienden en secuencia mientras el hilo se dibuja). Se ajusta
 * al centro de la pantalla, donde vivía la línea.
 *
 * Un `progress` 0→1 one-shot dibuja el hilo (strokeDashoffset) y enciende los
 * nodos escalonados; el header (último) remata con destellos. Reduce-motion:
 * progress=1 (figura completa) + texto, sin animación.
 */

const MAGENTA = '#E91E63'
const VB_W = 310
const VB_H = 150

type Node = { x: number; y: number; s: number }

// Figura ascendente: el patrón "se eleva" del origen tenue al destino radiante.
const NODES: Node[] = [
  { x: 34, y: 124, s: 0.72 },
  { x: 98, y: 100, s: 0.9 },
  { x: 160, y: 74, s: 1.0 },
  { x: 222, y: 48, s: 1.15 },
  { x: 276, y: 26, s: 1.35 },
]

const FIELD_STARS: { x: number; y: number; r: number; op: number }[] = [
  { x: 60, y: 38, r: 0.7, op: 0.34 },
  { x: 112, y: 28, r: 0.5, op: 0.24 },
  { x: 38, y: 66, r: 0.6, op: 0.3 },
  { x: 200, y: 122, r: 0.8, op: 0.4 },
  { x: 250, y: 104, r: 0.55, op: 0.26 },
  { x: 150, y: 136, r: 0.6, op: 0.32 },
  { x: 286, y: 72, r: 0.5, op: 0.22 },
  { x: 20, y: 108, r: 0.6, op: 0.3 },
]

/* Curva suave por los nodos (Catmull-Rom → Bézier) + longitud para el draw-on. */
function buildPath(nodes: Node[]): { d: string; len: number } {
  const p = nodes
  const n = p.length
  const t = 0.5
  let d = `M ${p[0]!.x} ${p[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t * 2
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t * 2
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t * 2
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t * 2
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  let euclid = 0
  for (let i = 1; i < n; i++) euclid += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y)
  return { d, len: euclid * 1.08 }
}

const { d: PATH_D, len: PATH_LEN } = buildPath(NODES)

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

/* Un nodo de la figura — flare compacto que se enciende (escalonado). */
function RevealNode({
  node,
  appearAt,
  progress,
  header,
}: {
  node: Node
  appearAt: number
  progress: SharedValue<number>
  header: boolean
}) {
  const props = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [appearAt, appearAt + 0.18], [0, 1], 'clamp'),
  }))
  const s = node.s
  const { x, y } = node
  return (
    <AnimatedG animatedProps={props}>
      <Circle cx={x} cy={y} r={11 * s} fill="url(#pcr-aura)" />
      {header ? (
        <>
          <Ellipse
            cx={x}
            cy={y}
            rx={8 * s}
            ry={0.9}
            fill="url(#pcr-streak)"
            opacity={0.32}
            rotation={45}
            originX={x}
            originY={y}
          />
          <Ellipse
            cx={x}
            cy={y}
            rx={8 * s}
            ry={0.9}
            fill="url(#pcr-streak)"
            opacity={0.32}
            rotation={-45}
            originX={x}
            originY={y}
          />
        </>
      ) : null}
      <Ellipse cx={x} cy={y} rx={10 * s} ry={1.1 * s} fill="url(#pcr-streak)" opacity={0.72} />
      <Ellipse cx={x} cy={y} rx={1 * s} ry={7 * s} fill="url(#pcr-streak)" opacity={0.5} />
      <Circle cx={x} cy={y} r={5 * s} fill="url(#pcr-bloom)" />
      <Circle cx={x} cy={y} r={2.5 * s} fill={MAGENTA} />
      <Circle cx={x} cy={y} r={1.1 * s} fill="#FFFFFF" opacity={0.95} />
    </AnimatedG>
  )
}

const SEQ_MS = 2600

export function PatternConstellationReveal({
  phrase,
  countLine,
  takeaway,
  onClose,
}: {
  /** La frase del patrón (observación, voz de coach). */
  phrase: string
  /** Prueba opcional ("Coincidieron 7 días..."). */
  countLine?: string
  /** Cierre útil opcional. */
  takeaway?: string
  onClose: () => void
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion() ?? false

  const progress = useSharedValue(reduced ? 1 : 0)
  useEffect(() => {
    if (reduced) {
      // Si reduced-motion se enciende a mitad de vuelo: dejar la figura COMPLETA
      // (no congelada a medias) para que coincida con el texto ya visible.
      progress.value = 1
      return
    }
    progress.value = withTiming(1, { duration: SEQ_MS, easing: Easing.inOut(Easing.cubic) })
    return () => cancelAnimation(progress)
  }, [reduced, progress])

  // El hilo se dibuja (strokeDashoffset len→0) mientras avanza el progress.
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0.05, 0.85], [PATH_LEN, 0], 'clamp'),
    opacity: interpolate(progress.value, [0, 0.1], [0, 1], 'clamp'),
  }))

  const line1Style = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.value, [0.5, 0.66], [0, 1], 'clamp'),
  }))
  const line2Style = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(progress.value, [0.78, 0.92], [0, 1], 'clamp'),
    transform: [
      { translateY: reduced ? 0 : interpolate(progress.value, [0.78, 0.92], [8, 0], 'clamp') },
    ],
  }))

  // La figura se dibuja a ~1.5× su viewBox, centrada donde vivía la línea.
  const figW = Math.min(width - 40, 360)
  const figH = (figW * VB_H) / VB_W

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <PatternRevealCosmos width={width} height={height} style={StyleSheet.absoluteFill} />
        <View style={styles.dim} pointerEvents="none" />

        {/* La constelación, centrada (en el lugar de la life-line). */}
        <View style={[StyleSheet.absoluteFill, styles.figCenter]} pointerEvents="none">
          <Svg width={figW} height={figH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <Defs>
              <RadialGradient id="pcr-aura" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.4} />
                <Stop offset="45%" stopColor={MAGENTA} stopOpacity={0.16} />
                <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="pcr-bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.92} />
                <Stop offset="35%" stopColor="#FFE9D6" stopOpacity={0.5} />
                <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="pcr-streak" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
              <SvgLinearGradient id="pcr-line" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.5} />
                <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0.95} />
              </SvgLinearGradient>
            </Defs>

            {FIELD_STARS.map((st, i) => (
              <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#FBD7E3" opacity={st.op} />
            ))}

            <AnimatedPath
              d={PATH_D}
              stroke="url(#pcr-line)"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={PATH_LEN}
              animatedProps={lineProps}
            />

            {NODES.map((node, i) => (
              <RevealNode
                key={i}
                node={node}
                appearAt={0.12 + i * 0.15}
                progress={progress}
                header={i === NODES.length - 1}
              />
            ))}
          </Svg>
        </View>

        {/* La evidencia, abajo (mismo tratamiento que el modal de Mes). */}
        <View style={[styles.textWrap, { bottom: insets.bottom + 56 }]} pointerEvents="none">
          <Animated.Text style={[styles.phrase, line1Style]}>{phrase}</Animated.Text>
          {countLine || takeaway ? (
            <Animated.View style={line2Style}>
              {countLine ? <Text style={styles.count}>{countLine}</Text> : null}
              {takeaway ? <Text style={styles.takeaway}>{takeaway}</Text> : null}
            </Animated.View>
          ) : null}
        </View>

        <Pressable
          onPress={onClose}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 6, 8, 0.55)',
  },
  figCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  phrase: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    color: colors.leche,
  },
  count: {
    marginTop: 20,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  takeaway: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.oroLeche,
  },
  close: {
    position: 'absolute',
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  closeX: {
    fontFamily: typography.uiMedium,
    fontSize: 16,
    color: colors.niebla,
  },
})

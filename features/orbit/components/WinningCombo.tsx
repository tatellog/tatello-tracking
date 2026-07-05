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

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

import type { WinningCombo as WinningComboData } from '../month-built'

/*
 * "Lo que más coincidió en tus días en déficit" — la co-ocurrencia más
 * frecuente de la usuaria, como una constelación: una estrella-núcleo (el
 * resultado) y las señales que más coincidieron irradiando hacia ella. Voz
 * Observadora: describe co-ocurrencia, nunca causa.
 *
 * El asterismo + sus etiquetas se CENTRAN como una unidad (flex row centrado),
 * no pegados al borde. Gramática de constelación de Stelar: líneas y halo
 * magenta, núcleo blanco; cada nodo toma el color de su dimensión. Profundidad
 * por capas (campo de estrellas tenue al fondo + halos dobles por estrella) y
 * brillo (flare en cruz + parpadeo suave, pausado fuera de pantalla / reduced
 * motion). Lógica en `winningCombo` (month-built.ts).
 */

const ROW = 54 // alto generoso por señal (mucho espacio negativo)
const CLUSTER_W = 82 // ancho del asterismo (la caja de estrellas, sin etiquetas)
const CORE_X = 16
// Los nodos viven cerca del borde derecho del cluster (junto a sus etiquetas) y
// se escalonan en X para romper la simetría especular (con 2 señales, dos hilos
// iguales formaban un "<" mecánico).
const NODE_DX = [0, 9, 4, 12]
const nodeX = (i: number): number => CLUSTER_W - 20 - (NODE_DX[i % NODE_DX.length] ?? 0)

/** El color de cada nodo = el de su dimensión (mismo criterio que el resto de
 *  Órbita), para que la fórmula conserve el código de color de la pantalla. */
const NODE_COLOR: Record<string, string> = {
  cuerpo: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  comida: colors.dimension.alimento,
  proteina: colors.signal.proteina,
  agua: colors.signal.agua,
}
const nodeColor = (key: string): string => NODE_COLOR[key] ?? colors.magenta

// Campo de estrellas tenue al fondo (profundidad / parálaje). Posiciones fijas
// (fracciones del lienzo) para no re-aleatorizar en cada render.
const FIELD = [
  { fx: 0.08, fy: 0.3, r: 1.0, op: 0.18 },
  { fx: 0.2, fy: 0.72, r: 0.7, op: 0.12 },
  { fx: 0.6, fy: 0.16, r: 0.8, op: 0.14 },
  { fx: 0.78, fy: 0.54, r: 1.1, op: 0.2 },
  { fx: 0.9, fy: 0.3, r: 0.7, op: 0.12 },
  { fx: 0.5, fy: 0.86, r: 0.6, op: 0.1 },
  { fx: 0.7, fy: 0.88, r: 0.9, op: 0.16 },
  { fx: 0.34, fy: 0.1, r: 0.7, op: 0.12 },
] as const

const AnimatedG = Animated.createAnimatedComponent(G)

/** Una estrella de 4 puntas con espigas FINAS y largas (waist delgado) — un
 *  destello, no una cruz dura. `inner` controla qué tan afilado. */
function sparklePath(cx: number, cy: number, outer: number, innerRatio: number): string {
  const inner = outer * innerRatio
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** El destello de una estrella: un sparkle blanco de espigas finas cuyo brillo
 *  PARPADEA (opacidad 0→1, no un punto imperceptible). Una sola fuente (`tw`,
 *  0→1 en bucle) alimenta a todas; `phase` las desfasa para que no titilen al
 *  unísono. Con `tw` quieto (off-screen / reduced motion) queda en un brillo
 *  fijo por estrella, nunca negro. Reemplaza la vieja cruz "+" y el punto. */
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
    // sin → [0,1], al cuadrado para que pase más tiempo tenue y el brillo "salte".
    const s = 0.5 + 0.5 * Math.sin((tw.value + phase) * Math.PI * 2)
    return { opacity: 0.15 + 0.8 * s * s }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {/* Espiga larga y fina (el rayo del destello). */}
      <Path d={sparklePath(x, y, size, 0.06)} fill="#FFFFFF" />
      {/* Núcleo brillante compacto (el corazón del brillo). */}
      <Circle cx={x} cy={y} r={size * 0.22} fill="#FFFFFF" />
    </AnimatedG>
  )
}

export function WinningCombo({ data }: { data: WinningComboData }) {
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent): void => {
    const next = e.nativeEvent.layout.width
    setW((p) => (Math.abs(p - next) < 1 ? p : next))
  }
  const n = data.signals.length
  const H = ROW * n
  const coreY = H / 2
  const nodeY = (i: number): number => ROW * i + ROW / 2

  // Id único del gradiente por instancia (si algún día hay dos combos en
  // pantalla, no comparten el mismo id en el documento SVG nativo).
  const gid = `combo-core-${useId().replace(/:/g, '')}`

  // Parpadeo: un reloj 0→1 en bucle, pausado fuera de pantalla / reduced motion.
  const tw = useSharedValue(0)
  const active = useScreenActive()
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(tw)
      tw.value = 0
      return
    }
    tw.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(tw)
  }, [active, reduced, tw])

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Lo que más coincidió en tus días en déficit</Text>

      {/* Para lector de pantalla: la constelación + sus etiquetas se leen como
          UNA unidad (sin esto, recorre cada señal suelta sin contexto). */}
      <View
        style={[styles.composition, { height: H }]}
        onLayout={onLayout}
        accessible
        accessibilityLabel={`Lo que más coincidió en tus días en déficit: ${data.signals
          .map((s) => s.label)
          .join(' y ')}.`}
      >
        {/* Capa de profundidad: campo de estrellas tenue, a todo el ancho. */}
        {w > 0 ? (
          <Svg width={w} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
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
          </Svg>
        ) : null}

        {/* El asterismo + etiquetas, CENTRADOS como una unidad. */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerRow}>
          <View style={{ width: CLUSTER_W, height: H }}>
            <Svg width={CLUSTER_W} height={H} pointerEvents="none">
              <Defs>
                <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.5} />
                  <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.15} />
                  <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
                </RadialGradient>
              </Defs>

              {/* Hilos: del núcleo a cada señal (la co-ocurrencia trazada). */}
              {data.signals.map((s, i) => (
                <Line
                  key={`l-${s.key}`}
                  x1={CORE_X}
                  y1={coreY}
                  x2={nodeX(i)}
                  y2={nodeY(i)}
                  stroke={colors.magenta}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              ))}

              {/* Halos dobles por nodo (profundidad): un velo amplio + un brillo
                  cercano, ambos en el color de la dimensión. */}
              {data.signals.map((s, i) => {
                const c = nodeColor(s.key)
                return (
                  <G key={`h-${s.key}`}>
                    <Circle cx={nodeX(i)} cy={nodeY(i)} r={13} fill={c} opacity={0.09} />
                    <Circle cx={nodeX(i)} cy={nodeY(i)} r={7} fill={c} opacity={0.2} />
                  </G>
                )
              })}

              {/* El núcleo: halo magenta + estrella blanca + destello que parpadea. */}
              <Circle cx={CORE_X} cy={coreY} r={14} fill={`url(#${gid})`} />
              <Path d={fourPointStarPath(CORE_X, coreY, 5.5)} fill={colors.leche} />
              <Glint x={CORE_X} y={coreY} size={13} phase={0} tw={tw} />

              {/* Cada señal: estrella teñida con su dimensión + destello que parpadea. */}
              {data.signals.map((s, i) => {
                const c = nodeColor(s.key)
                return (
                  <G key={`n-${s.key}`}>
                    <Path d={fourPointStarPath(nodeX(i), nodeY(i), 5.2)} fill={c} />
                    <Glint x={nodeX(i)} y={nodeY(i)} size={11} phase={(i + 1) * 0.27} tw={tw} />
                  </G>
                )
              })}
            </Svg>
          </View>

          {/* Etiquetas, una por fila, alineadas con su estrella. */}
          <View style={styles.labelsCol}>
            {data.signals.map((s) => (
              <View key={s.key} style={[styles.label, { height: ROW }]}>
                <Text style={styles.labelText}>{s.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* El hallazgo, en UNA relación (no dos cifras sueltas): cuántas veces
          coincidió y, de esas, cuántas terminaron en déficit. Observacional, sin
          causa. Cuando todas terminaron en déficit, la frase lo dice directo. */}
      <View style={styles.count}>
        {data.deficits >= data.occurrences ? (
          <Text style={styles.countLine}>
            Las <Text style={styles.countNum}>{data.occurrences}</Text> veces que coincidió,
            terminaste en déficit.
          </Text>
        ) : (
          <Text style={styles.countLine}>
            Coincidió <Text style={styles.countNum}>{data.occurrences}</Text> veces. En{' '}
            <Text style={styles.countNum}>{data.deficits}</Text> de ellas terminaste en déficit.
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 30,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginLeft: 2,
  },
  composition: {
    marginTop: 22,
    position: 'relative',
  },
  // El asterismo + etiquetas se centran como un bloque (no pegados al borde).
  centerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelsCol: {
    marginLeft: 12,
  },
  label: {
    justifyContent: 'center',
  },
  // Etiquetas de señal = DATOS (no voz de coach): Hanken upright, no serif italic.
  labelText: {
    fontFamily: typography.uiMedium,
    fontSize: 16.5,
    lineHeight: 22,
    color: colors.leche,
  },
  count: {
    marginTop: 26,
    paddingLeft: 2,
  },
  countLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.anchor,
    lineHeight: 26,
    color: colors.bone,
  },
  countNum: {
    fontFamily: typography.uiBold,
    fontStyle: 'normal',
    fontSize: typography.sizes.headingLg,
    color: colors.oroSoft,
    fontVariant: ['tabular-nums'],
  },
})

import { useEffect, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg'

import { nextPhaseInfo, PHASE_LABEL, type CyclePhase } from '@/features/cycle/phase'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

const AnimatedLine = Animated.createAnimatedComponent(Line)

const PHASE_SEQUENCE: CyclePhase[] = ['menstrual', 'folicular', 'ovulatoria', 'lutea']

const TIMELINE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Período',
  folicular: 'Primera\nmitad',
  ovulatoria: 'Mitad',
  lutea: 'Semana\nantes',
}

// Estrella de 4 puntas — el glifo "punto de luz" de la marca (mismo que
// WeekStrip / StelarIcon). NO es decoración astrológica: es fisiología hecha
// luz, no horóscopo.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

// Fraseo suave, nunca determinista. "unos" = estimado, nunca pronóstico.
const agoPhrase = (n: number) => (n <= 1 ? 'hace 1 día' : `hace unos ${n} días`)
const inPhrase = (n: number) => (n <= 1 ? 'pronto' : `en unos ${n} días`)

// Sub contextual SIN el día (el día vive en el kicker magenta del hero).
export function phaseHeroSub(phase: CyclePhase, day: number): string {
  switch (phase) {
    case 'menstrual':
      return 'Estás en tu período'
    case 'folicular':
      return `Tu período terminó ${agoPhrase(day - 5)}`
    case 'ovulatoria':
      return 'El punto medio de tu ciclo'
    case 'lutea':
      return 'La semana antes de tu período'
  }
}

export function nextMilestoneLine(day: number, length: number): string {
  const next = nextPhaseInfo(day, length)
  return `Próximo · ${PHASE_LABEL[next.phase].toLowerCase()} ${inPhrase(next.days)}`
}

// Centro vertical del nodo dentro del timeline: tag HOY (14) + medio dotWrap (11).
const NODE_CY = 25

// Estrella de HOY: estrella + bloom en capas que respira. Gated en
// useScreenActive + reduced motion — descansa estática. Bloom = círculos
// concéntricos (truco de CycleRing; evita el bug de RadialGradient+alpha en iOS).
function TodayStar({ accent }: { accent: string }) {
  const active = useScreenActive()
  const reduce = useReducedMotion()
  const breath = useSharedValue(0.5)
  useEffect(() => {
    if (reduce || !active) {
      cancelAnimation(breath)
      breath.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [active, reduce, breath])

  const style = useAnimatedStyle(() => ({
    opacity: 0.85 + breath.value * 0.15,
    transform: [{ scale: 0.94 + breath.value * 0.12 }],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.todayStar, style]}>
      <Svg width={36} height={36} viewBox="0 0 36 36" style={styles.todayBloom}>
        <Circle cx={18} cy={18} r={15} fill={accent} opacity={0.06} />
        <Circle cx={18} cy={18} r={10} fill={accent} opacity={0.1} />
        <Circle cx={18} cy={18} r={6} fill={accent} opacity={0.18} />
      </Svg>
      <Svg width={20} height={20} viewBox="0 0 24 24" style={styles.todayGlyph}>
        <Path d={STAR_PATH} fill={accent} />
        <Circle cx={12} cy={12} r={1.7} fill={colors.leche} />
      </Svg>
    </Animated.View>
  )
}

/* El viaje: cuatro nodos sobre una vía. Futuro punteado (ruta no recorrida),
 * recorrido en silver-blue con gradiente (luz que viaja hasta hoy). HOY es una
 * estrella con bloom; el pasado, estrellitas en reposo; el futuro, apenas un
 * anillo. NO es barra de progreso-a-meta: es posición en un ciclo natural. */
export function CycleTimeline({ phase }: { phase: CyclePhase }) {
  const current = PHASE_SEQUENCE.indexOf(phase)
  // El marcador de HOY (estrella + label) es magenta: el color-identidad del
  // ciclo, no depende de la fase.
  const accent = colors.magenta
  const reduce = useReducedMotion()
  const [w, setW] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)
  const cx = (i: number) => ((2 * i + 1) / 8) * w

  // La vía recorrida se DIBUJA izquierda→derecha hasta hoy al entrar (un solo
  // trazo calmo, nunca celebratorio). Reduced motion → aparece completa.
  const draw = useSharedValue(0)
  useEffect(() => {
    if (w <= 0) return
    if (reduce) {
      draw.value = 1
      return
    }
    draw.value = 0
    draw.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) })
  }, [w, current, reduce, draw])

  // Math inline en el worklet (sin llamar a cx(): un helper JS dentro de un
  // worklet crasha el APK release).
  const recorridoProps = useAnimatedProps(() => {
    const x0 = (1 / 8) * w
    const xc = ((2 * current + 1) / 8) * w
    return { x2: x0 + (xc - x0) * draw.value }
  })

  return (
    <View style={styles.timeline} onLayout={onLayout}>
      {w > 0 ? (
        <Svg width={w} height={40} style={styles.track} pointerEvents="none">
          <Line
            x1={cx(0)}
            y1={NODE_CY}
            x2={cx(3)}
            y2={NODE_CY}
            stroke={colors.bruma}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray="1.5 5"
          />
          {current > 0 ? (
            <>
              <Defs>
                <LinearGradient
                  id="cycleRecorrido"
                  gradientUnits="userSpaceOnUse"
                  x1={cx(0)}
                  y1={NODE_CY}
                  x2={cx(current)}
                  y2={NODE_CY}
                >
                  <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity={0.9} />
                </LinearGradient>
              </Defs>
              <AnimatedLine
                x1={cx(0)}
                y1={NODE_CY}
                y2={NODE_CY}
                animatedProps={recorridoProps}
                stroke="url(#cycleRecorrido)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      <View style={styles.nodeRow}>
        {PHASE_SEQUENCE.map((p, i) => {
          const state = i < current ? 'done' : i === current ? 'today' : 'future'
          return (
            <Animated.View
              key={p}
              entering={FadeIn.duration(360).delay(120 + i * 110)}
              style={styles.nodeCol}
            >
              <Text
                style={[
                  styles.todayTag,
                  state !== 'today' ? styles.todayTagHidden : { color: accent },
                ]}
              >
                HOY
              </Text>
              <View style={styles.dotWrap}>
                {state === 'today' ? (
                  <TodayStar accent={accent} />
                ) : state === 'done' ? (
                  <Svg width={13} height={13} viewBox="0 0 24 24">
                    <Path d={STAR_PATH} fill={colors.leche} opacity={0.55} />
                  </Svg>
                ) : (
                  <View style={styles.dotFuture} />
                )}
              </View>
              <Text
                style={[styles.nodeLabel, state === 'today' && styles.nodeLabelToday]}
                numberOfLines={2}
              >
                {TIMELINE_LABEL[p]}
              </Text>
            </Animated.View>
          )
        })}
      </View>
    </View>
  )
}

/* Hero — la fase en la que estás (titular) + la línea "dónde estoy hoy".
 * `align` deja a Hoy alinear a la izquierda y a Progreso centrar. */
export function CyclePhaseHero({
  phase,
  day,
  length,
  align = 'left',
}: {
  phase: CyclePhase
  day: number
  length: number
  align?: 'left' | 'center'
}) {
  return (
    <View>
      <Text style={[styles.heroKicker, { textAlign: align }]}>{`Día ${day} de ${length}`}</Text>
      <Text style={[styles.heroPhase, { textAlign: align }]}>{PHASE_LABEL[phase]}</Text>
      <Text style={[styles.heroSub, { textAlign: align }]}>{phaseHeroSub(phase, day)}</Text>
    </View>
  )
}

/* El próximo hito, centrado, con un punto dorado de hito. */
export function CycleNextMilestone({ day, length }: { day: number; length: number }) {
  return (
    <View style={styles.proximoRow}>
      <View style={styles.proximoDot} />
      <Text style={styles.proximoText}>{nextMilestoneLine(day, length)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Kicker — el día es el dato ancla, en magenta (color-identidad del ciclo),
  // sobre el titular.
  heroKicker: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.magenta,
    marginBottom: 5,
  },
  heroPhase: {
    fontFamily: typography.displaySemi,
    fontSize: 24,
    color: colors.leche,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  heroSub: {
    marginTop: 4,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  timeline: { marginTop: 20, position: 'relative' },
  track: { position: 'absolute', top: 0, left: 0 },
  nodeRow: { flexDirection: 'row' },
  nodeCol: { flex: 1, alignItems: 'center' },
  todayTag: {
    height: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  todayTagHidden: { opacity: 0 },
  dotWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todayStar: { position: 'absolute', top: -7, left: -7, width: 36, height: 36 },
  todayBloom: { position: 'absolute', top: 0, left: 0 },
  todayGlyph: { position: 'absolute', top: 8, left: 8 },
  dotFuture: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: colors.bruma,
    backgroundColor: 'transparent',
    opacity: 0.7,
  },
  nodeLabel: {
    marginTop: 8,
    minHeight: 26,
    fontFamily: typography.ui,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    textAlign: 'center',
    lineHeight: 13,
  },
  nodeLabelToday: { color: colors.leche, fontFamily: typography.uiSemi },
  proximoRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  proximoDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.magenta },
  proximoText: { fontFamily: typography.ui, fontSize: typography.sizes.label, color: colors.bone },
})

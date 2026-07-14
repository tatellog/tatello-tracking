import { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { colors, typography } from '@/theme'

import { useBodyCheckins, useMeasurements } from '../hooks'
import { mergeWeightSeries, recoveryFact, smoothWeightPoints } from '../logic'

/*
 * "Tu transformación · Tu camino" (F2 · Cuerpo, mockup dueña) — la PORTADA del
 * segmento (brief UI polish: "este fue tu viaje", no "perdiste peso"), con UNA
 * sola ancla (benchmark: tres verdades de peso rompían la definición):
 *
 * - CON rebote (recoveryFact): el arco y los números van del PICO a hoy
 *   (72.1 → 67.1) y la frase serif narra exactamente eso.
 * - SIN rebote: primera marca → hoy con su delta (la única historia).
 *
 * El arco es TRAYECTORIA, no decoración: se dibuja al entrar (1100 ms,
 * easeOutCubic), una estrella recorre el camino, tres partículas se encienden
 * a su paso y la estrella final respira con un glow suave. Todo Reanimated
 * animatedProps sobre SVG (mismo patrón probado del TrajectoryChart); la
 * matemática del bezier vive INLINE en los worklets (regla del repo: helpers
 * de JS plano dentro de worklets truenan el release build).
 *
 * Peso SUAVIZADO (media 7d). Peso inicial atenuado; el final domina (46pt).
 * La ventana corta (30 días) vive SOLO en el chip "CAMBIO · 30 DÍAS" de abajo.
 */

const ARC_W = 300
const ARC_H = 104
// Extremos y control del arco (quadratic bezier).
const P0X = 16
const P0Y = ARC_H - 14
const CX = ARC_W / 2
const CY = -ARC_H * 0.52
const P1X = ARC_W - 16
const P1Y = ARC_H - 14

/** Punto del bezier cuadrático en t (JS puro, fuera de worklets). */
const bezier = (t: number): [number, number] => {
  const mt = 1 - t
  return [
    mt * mt * P0X + 2 * mt * t * CX + t * t * P1X,
    mt * mt * P0Y + 2 * mt * t * CY + t * t * P1Y,
  ]
}

// Longitud del arco (numérica, 32 segmentos): alimenta el stroke-dash del draw.
const ARC_LEN = (() => {
  let len = 0
  let [px, py] = bezier(0)
  for (let i = 1; i <= 32; i += 1) {
    const [x, y] = bezier(i / 32)
    len += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  return len
})()

// Partículas que se encienden al paso de la estrella viajera.
const SPARK_TS = [0.28, 0.52, 0.76] as const
const SPARKS = SPARK_TS.map((t) => {
  const [x, y] = bezier(t)
  return { t, x, y }
})

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function TransformationHero() {
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()

  const hero = useMemo(() => {
    // UNA sola serie (app + coach): arranca en tu primera medición real.
    const fused = mergeWeightSeries(measurements.data ?? [], checkins.data ?? [])
    const smoothed = smoothWeightPoints(fused)
    const first = smoothed[0]
    const last = smoothed[smoothed.length - 1]
    if (!first || !last || smoothed.length < 2) return null
    const daysSince = Math.max(0, Math.round((Date.now() - last.t) / 86400000))
    // La historia de recuperación (pico → hoy): narra lo recorrido, nunca lo
    // que falta (cero countdown). Cuando existe, ES el ancla del hero.
    const recovery = recoveryFact(smoothed)
    const from = recovery ? recovery.peakKg : first.weight
    const deltaKg = Number((last.weight - from).toFixed(1))
    return { from, to: last.weight, deltaKg, count: smoothed.length, daysSince, recovery }
  }, [measurements.data, checkins.data])

  // Draw del arco + estrella viajera (0 → 1). Se re-dibuja SOLO si cambia el
  // ancla (from/to) — con el objeto `hero` en deps, cada refetch reiniciaba
  // el dibujo aunque los números fueran los mismos (reanimated-guardian).
  const hasHero = hero != null
  const draw = useSharedValue(0)
  useEffect(() => {
    if (!hasHero) return
    draw.value = 0
    draw.value = withDelay(250, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }))
  }, [hero?.from, hero?.to, hasHero, draw])

  // Respiración del glow de la estrella final (lenta, elegante). Cancelar al
  // desmontar: el patrón del repo para todo loop infinito (WeekStrip et al).
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LEN * (1 - draw.value),
  }))
  // La estrella que recorre el camino: bezier inline (worklet-safe) y se
  // funde al llegar a la estrella final.
  const cometProps = useAnimatedProps(() => {
    const t = draw.value
    const mt = 1 - t
    return {
      cx: mt * mt * P0X + 2 * mt * t * CX + t * t * P1X,
      cy: mt * mt * P0Y + 2 * mt * t * CY + t * t * P1Y,
      opacity: interpolate(t, [0, 0.06, 0.92, 1], [0, 0.9, 0.9, 0]),
    }
  })
  const spark0 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [SPARK_TS[0], SPARK_TS[0] + 0.12], [0, 0.55]),
  }))
  const spark1 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [SPARK_TS[1], SPARK_TS[1] + 0.12], [0, 0.55]),
  }))
  const spark2 = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [SPARK_TS[2], SPARK_TS[2] + 0.12], [0, 0.55]),
  }))
  const sparkProps = [spark0, spark1, spark2]
  // Glow final: aparece cuando el trazo llega y luego respira.
  const glowProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.85, 1], [0, 0.4]) + breath.value * 0.25,
  }))
  const endStarProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.8, 1], [0.35, 1]),
  }))

  if (!hero) return null

  const sign = hero.deltaKg > 0 ? '+' : hero.deltaKg < 0 ? '−' : ''
  const lastLabel =
    hero.daysSince === 0
      ? 'hoy'
      : hero.daysSince === 1
        ? 'hace 1 día'
        : `hace ${hero.daysSince} días`

  return (
    <Animated.View
      entering={FadeInDown.duration(520).easing(Easing.out(Easing.cubic))}
      style={styles.wrap}
    >
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu transformación
      </EyebrowLabel>
      <Text style={styles.sub}>{hero.recovery ? 'Tu camino, desde el pico' : 'Tu camino'}</Text>

      {/* El arco dorado — trayectoria, no decoración: se dibuja de la primera
          estrella a la de hoy, con la viajera recorriéndolo. */}
      <View style={styles.arcWrap}>
        <Svg width="100%" height={ARC_H} viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
          <AnimatedPath
            d={`M ${P0X} ${P0Y} Q ${CX} ${CY} ${P1X} ${P1Y}`}
            stroke={colors.oroHairline}
            strokeWidth={1.1}
            fill="none"
            strokeDasharray={ARC_LEN}
            animatedProps={arcProps}
          />
          {/* Partículas que la viajera va encendiendo. */}
          {SPARKS.map((s, i) => (
            <AnimatedPath
              key={s.t}
              d={fourPointStarPath(s.x, s.y, 2.6)}
              fill={colors.oroSoft}
              animatedProps={sparkProps[i]}
            />
          ))}
          {/* Punto de partida: presente pero atenuado. */}
          <Circle cx={P0X} cy={P0Y} r={7} fill={colors.oroGlow} opacity={0.5} />
          <Path d={fourPointStarPath(P0X, P0Y, 3.8)} fill={colors.oroSoft} opacity={0.8} />
          {/* La viajera. */}
          <AnimatedCircle r={3} fill={colors.oroLeche} animatedProps={cometProps} />
          {/* Estrella final: glow respirando + brillo pleno al aterrizar. */}
          <AnimatedCircle
            cx={P1X}
            cy={P1Y}
            r={13}
            fill={colors.oroGlow}
            animatedProps={glowProps}
          />
          <AnimatedPath
            d={fourPointStarPath(P1X, P1Y, 5.8)}
            fill={colors.oroLeche}
            animatedProps={endStarProps}
          />
        </Svg>
      </View>

      <View style={styles.numbersRow}>
        <Text style={styles.from}>{hero.from.toFixed(1)} kg</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.to}>{hero.to.toFixed(1)}</Text>
        <Text style={styles.toUnit}>kg</Text>
      </View>
      {hero.deltaKg !== 0 ? (
        <Text style={styles.delta}>
          {sign}
          {Math.abs(hero.deltaKg).toFixed(1)} kg
        </Text>
      ) : null}

      {/* La historia de recuperación, en voz de coach: nombra el rebote sin
          drama y narra EXACTAMENTE lo que el arco dibuja (misma ancla).
          Desaparece (no regaña) si la tendencia se invierte. */}
      {hero.recovery ? (
        <Text style={styles.recovery}>
          Subiste hasta {hero.recovery.peakKg.toFixed(1)} kg. Desde ahí, ya bajaste{' '}
          {hero.recovery.droppedKg.toFixed(1)}.
        </Text>
      ) : null}

      {/* "Registros de peso", no "mediciones": la tabla llama mediciones a los
          check-ins y este conteo incluye los pesajes de la app. */}
      <Text style={styles.meta}>
        {hero.count} {hero.count === 1 ? 'registro' : 'registros'} de peso · último {lastLabel}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Portada: aire arriba, los números centrados bajo el arco.
  wrap: { alignItems: 'center', paddingTop: 16 },
  eyebrow: { alignSelf: 'flex-start', marginBottom: 2 },
  sub: {
    alignSelf: 'flex-start',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 14,
  },
  arcWrap: { width: '100%' },
  numbersRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  // Inicial atenuado: el viaje importa más que el punto de partida.
  from: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
    opacity: 0.85,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.title, color: colors.oro },
  // El HOY domina la portada (46pt, con un halo de luz sutil).
  to: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    color: colors.leche,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  toUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  // Delta en ORO (sin juicio): el cambio como hecho.
  delta: {
    marginTop: 6,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // La frase de recuperación — voz del coach, centrada bajo el delta.
  recovery: {
    marginTop: 16,
    paddingHorizontal: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
    textAlign: 'center',
  },
  meta: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})

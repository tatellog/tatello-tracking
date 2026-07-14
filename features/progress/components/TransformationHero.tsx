import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { colors, typography } from '@/theme'

import { useBodyCheckins, useMeasurements } from '../hooks'
import { mergeWeightSeries, recoveryFact, smoothWeightPoints } from '../logic'

/*
 * "Tu transformación · Tu camino" (F2 · Cuerpo, mockup dueña) — el hero del
 * segmento con UNA sola ancla (benchmark: tres verdades de peso en la misma
 * pantalla rompían la definición de la métrica):
 *
 * - CON rebote (recoveryFact): el arco y los números van del PICO a hoy
 *   (72.1 → 67.1) y la frase serif narra exactamente eso. El delta desde el
 *   inicio del tracking desaparece: era la cifra que menos historia contaba
 *   y la más visible.
 * - SIN rebote: primera marca → hoy con su delta (la única historia).
 *
 * Peso SUAVIZADO (media 7d): el titular es la trayectoria, nunca el ruido de
 * báscula de una mañana. Delta en oro sin juicio. Se gana su lugar con ≥2
 * mediciones — con menos, el empty state de "Tu cuerpo" hace su trabajo.
 * La ventana corta (30 días) vive SOLO en el chip "CAMBIO · 30 DÍAS" de abajo.
 */

const ARC_W = 300
const ARC_H = 64

export function TransformationHero() {
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()

  const hero = useMemo(() => {
    // UNA sola serie (app + coach): "desde que comenzaste" es HONESTO — arranca
    // en tu primera medición real, no en la primera que marcaste en la app.
    // (target-user: dos verdades en la misma pantalla rompían toda la confianza.)
    const fused = mergeWeightSeries(measurements.data ?? [], checkins.data ?? [])
    const smoothed = smoothWeightPoints(fused)
    const first = smoothed[0]
    const last = smoothed[smoothed.length - 1]
    if (!first || !last || smoothed.length < 2) return null
    const daysSince = Math.max(0, Math.round((Date.now() - last.t) / 86400000))
    // La historia de recuperación (pico → hoy, sobre la serie suavizada): la
    // lectura que la usuaria pidió con sus propios datos. Narra lo recorrido,
    // nunca lo que falta (cero countdown). Cuando existe, ES el ancla del
    // hero: arco, números y frase cuentan lo mismo.
    const recovery = recoveryFact(smoothed)
    const from = recovery ? recovery.peakKg : first.weight
    const deltaKg = Number((last.weight - from).toFixed(1))
    return {
      from,
      to: last.weight,
      deltaKg,
      count: smoothed.length,
      daysSince,
      recovery,
    }
  }, [measurements.data, checkins.data])

  if (!hero) return null

  const sign = hero.deltaKg > 0 ? '+' : hero.deltaKg < 0 ? '−' : ''
  const lastLabel =
    hero.daysSince === 0
      ? 'hoy'
      : hero.daysSince === 1
        ? 'hace 1 día'
        : `hace ${hero.daysSince} días`

  return (
    <Animated.View entering={FadeIn.duration(360)} style={styles.wrap}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu transformación
      </EyebrowLabel>
      {/* Ventana canónica larga ("Tu camino"); "desde que comenzaste" mentía
          cuando el ancla es el pico del rebote. */}
      <Text style={styles.sub}>{hero.recovery ? 'Tu camino, desde el pico' : 'Tu camino'}</Text>

      {/* El arco dorado: de tu primera estrella a la de hoy. Estático (cero
          animación nueva · cero riesgo de perf). */}
      <View style={styles.arcWrap}>
        <Svg width="100%" height={ARC_H} viewBox={`0 0 ${ARC_W} ${ARC_H}`}>
          <Path
            d={`M 18 ${ARC_H - 10} Q ${ARC_W / 2} ${-ARC_H * 0.55} ${ARC_W - 18} ${ARC_H - 10}`}
            stroke={colors.oroHairline}
            strokeWidth={1.4}
            fill="none"
          />
          <Circle cx={18} cy={ARC_H - 10} r={6} fill={colors.oroGlow} />
          <Path d={fourPointStarPath(18, ARC_H - 10, 4)} fill={colors.oroSoft} />
          <Circle cx={ARC_W - 18} cy={ARC_H - 10} r={8} fill={colors.oroGlow} />
          <Path d={fourPointStarPath(ARC_W - 18, ARC_H - 10, 5.2)} fill={colors.oroLeche} />
        </Svg>
      </View>

      <View style={styles.numbersRow}>
        <Text style={styles.from}>{hero.from.toFixed(1)} kg</Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.to}>{hero.to.toFixed(1)} kg</Text>
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
          check-ins (4) y este conteo incluye los pesajes de la app (9). Cada
          palabra nombra UNA cosa (uxui: 9 vs 4 no cuadraba). */}
      <Text style={styles.meta}>
        {hero.count} {hero.count === 1 ? 'registro' : 'registros'} de peso · último {lastLabel}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  eyebrow: { alignSelf: 'flex-start', marginBottom: 2 },
  sub: {
    alignSelf: 'flex-start',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 6,
  },
  arcWrap: { width: '100%', marginTop: 2 },
  numbersRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  from: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.title, color: colors.oro },
  to: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.leche,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  // Delta en ORO (sin juicio): el cambio como hecho.
  delta: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // La frase de recuperación — voz del coach, centrada bajo el delta.
  recovery: {
    marginTop: 10,
    paddingHorizontal: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.leche,
    textAlign: 'center',
  },
  meta: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})

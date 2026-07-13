import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { colors, typography } from '@/theme'

import { useBodyCheckins } from '../hooks'

/*
 * Historial de mediciones (F3 · mockup dueña) — el timeline horizontal: cada
 * check-in es una ESTRELLA con su fecha y sus métricas clave. La colección
 * emocional estilo Apple Awards: no castiga ausencias (6 mediciones en 6 meses
 * son 6 estrellas, no "te saltaste 20 semanas"). La primera lleva "Inicio".
 * Se gana su lugar con ≥2 check-ins.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function CheckinTimeline() {
  const { data } = useBodyCheckins()
  const checkins = useMemo(() => data ?? [], [data])
  if (checkins.length < 2) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(160)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Historial de mediciones
      </EyebrowLabel>
      <Text style={styles.sub}>Tu evolución completa</Text>

      <ScrollView
        horizontal
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.rail}>
          {checkins.map((c, i) => (
            <View key={c.id} style={styles.node}>
              {/* La estrella-punto + el hilo hacia el siguiente. */}
              <View style={styles.starRow}>
                <Svg width={22} height={22} viewBox="0 0 22 22">
                  <Path
                    d={fourPointStarPath(11, 11, i === checkins.length - 1 ? 7 : 5.5)}
                    fill={i === checkins.length - 1 ? colors.oroLeche : colors.oroSoft}
                  />
                </Svg>
                {i < checkins.length - 1 ? (
                  <Svg width={92} height={22} viewBox="0 0 92 22">
                    <Line
                      x1={2}
                      y1={11}
                      x2={90}
                      y2={11}
                      stroke={colors.oroHairline}
                      strokeWidth={1.2}
                    />
                  </Svg>
                ) : null}
              </View>
              <Text style={styles.date}>{fmtDay(c.measured_on)}</Text>
              {i === 0 ? <Text style={styles.badge}>Inicio</Text> : null}
              <View style={styles.metrics}>
                {c.weight_kg != null ? (
                  <Text style={styles.metric}>{c.weight_kg.toFixed(1)} kg</Text>
                ) : null}
                {c.body_fat_pct != null ? (
                  <Text style={styles.metric}>{c.body_fat_pct.toFixed(1)} %</Text>
                ) : null}
                {c.muscle_kg != null ? (
                  <Text style={styles.metric}>{c.muscle_kg.toFixed(1)} kg músc.</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 14,
  },
  rail: { flexDirection: 'row', paddingRight: 12 },
  node: { width: 112 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  date: {
    marginTop: 8,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    marginTop: 2,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.magentaHot,
  },
  metrics: { marginTop: 4, gap: 1 },
  metric: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
})

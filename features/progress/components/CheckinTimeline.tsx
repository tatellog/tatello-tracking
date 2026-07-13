import { useMemo } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { PROGRESS_EVENTS } from '../constants'
import { useBodyCheckins, usePhotoTimeline } from '../hooks'
import { photoAt } from '../logic'

/*
 * Historial de mediciones (F3 + fusión benchmark) — cada check-in es una
 * ESTRELLA con su mini-foto (si ese día tiene) y sus métricas clave. Colección
 * estilo Apple Awards: no castiga ausencias. La primera lleva "Inicio".
 *
 * TAP en un punto → el COMPARADOR se preselecciona con esa fecha (vs la última):
 * la fusión que mató la pantalla "detalle de medición" (un grid de una fecha
 * sola no responde "¿qué cambió?"). Se gana su lugar con ≥2 check-ins.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

export function CheckinTimeline({ onPick }: { onPick?: (day: string) => void }) {
  const { data } = useBodyCheckins()
  const photosQ = usePhotoTimeline()
  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data])
  const checkins = useMemo(() => data ?? [], [data])
  if (checkins.length < 2) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(160)}>
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Historial de mediciones
      </EyebrowLabel>
      <Text style={styles.sub}>Tu evolución completa · toca una para compararla</Text>

      <ScrollView
        horizontal
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.rail}>
          {checkins.map((c, i) => {
            // Mini-foto del día (frontal primero; cualquier ángulo si no hay).
            const thumb =
              photoAt(photos, 'front', c.measured_on) ??
              photoAt(photos, 'back', c.measured_on) ??
              photoAt(photos, 'side_right', c.measured_on) ??
              photoAt(photos, 'side_left', c.measured_on)
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  onPick?.(c.measured_on)
                  track(PROGRESS_EVENTS.compare, { kind: 'timeline' })
                }}
                accessibilityRole="button"
                accessibilityLabel={`Comparar la medición del ${fmtDay(c.measured_on)}`}
                style={({ pressed }) => [styles.node, pressed && { opacity: 0.7 }]}
              >
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
                {thumb?.signed_url ? (
                  <View style={styles.thumb}>
                    <Image
                      source={{ uri: thumb.signed_url }}
                      style={styles.thumbImg}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
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
              </Pressable>
            )
          })}
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
  thumb: {
    marginTop: 8,
    width: 44,
    height: 62,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
  },
  thumbImg: { width: 44, height: 62 },
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

import { useRouter } from 'expo-router'
import { useMemo, useRef } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'

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
  const router = useRouter()
  const railRef = useRef<ScrollView>(null)
  const { data } = useBodyCheckins()
  const photosQ = usePhotoTimeline()
  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data])
  const checkins = useMemo(() => data ?? [], [data])
  if (checkins.length < 2) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(160)}>
      <View style={styles.divider} />
      <View style={styles.headerRow}>
        <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
          Historial de mediciones
        </EyebrowLabel>
        {/* La tabla del coach (decisión dueña): todos los números, sin frases. */}
        <Pressable
          onPress={() => {
            router.push('/progress-table')
            track(PROGRESS_EVENTS.body, { kind: 'table' })
          }}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel="Ver la tabla completa de mediciones"
        >
          <Text style={styles.tableLink}>Ver tabla completa →</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>Tu evolución completa · toca una y compárala abajo</Text>

      {/* Arranca en la medición MÁS RECIENTE (la que buscas primero): antes el
          riel abría en "Inicio" y el último nodo salía rebanado al borde, que
          se leía como bug. El peek parcial queda del lado del pasado. */}
      <ScrollView
        ref={railRef}
        horizontal
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
        onContentSizeChange={() => railRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.rail}>
          {checkins.map((c, i) => {
            // Mini-foto del día (frontal primero; cualquier ángulo si no hay).
            const thumb =
              photoAt(photos, 'front', c.measured_on) ??
              photoAt(photos, 'back', c.measured_on) ??
              photoAt(photos, 'side_right', c.measured_on) ??
              photoAt(photos, 'side_left', c.measured_on)
            const isLast = i === checkins.length - 1
            return (
              /* Cada medición = un capítulo: reveal escalonado de izq a der. */
              <Animated.View key={c.id} entering={FadeIn.duration(420).delay(i * 60)}>
                <Pressable
                  onPress={() => {
                    onPick?.(c.measured_on)
                    track(PROGRESS_EVENTS.compare, { kind: 'timeline' })
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Comparar la medición del ${fmtDay(c.measured_on)}`}
                  style={({ pressed }) => [styles.node, pressed && { opacity: 0.7 }]}
                >
                  {/* La estrella-punto + el hilo hacia el siguiente. El capítulo
                      más reciente lleva glow. */}
                  <View style={styles.starRow}>
                    <Svg width={22} height={22} viewBox="0 0 22 22">
                      {isLast ? <Circle cx={11} cy={11} r={10} fill={colors.oroGlow} /> : null}
                      <Path
                        d={fourPointStarPath(11, 11, isLast ? 7 : 5.5)}
                        fill={isLast ? colors.oroLeche : colors.oroSoft}
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
                  {/* Tres datos por capítulo, nada más (brief): fecha arriba,
                      peso y grasa aquí. */}
                  <View style={styles.metrics}>
                    {c.weight_kg != null ? (
                      <Text style={styles.metric}>{c.weight_kg.toFixed(1)} kg</Text>
                    ) : null}
                    {c.body_fat_pct != null ? (
                      <Text style={styles.metric}>{c.body_fat_pct.toFixed(1)} % grasa</Text>
                    ) : null}
                  </View>
                </Pressable>
              </Animated.View>
            )
          })}
        </View>
      </ScrollView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // El espacio ES el separador (brief): sin hairline, solo aire.
  divider: { height: 0, marginVertical: 38 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: { marginBottom: 2 },
  tableLink: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    color: colors.oroLight,
  },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 14,
  },
  // El padding va en el contentContainer del ScrollView (en el View interno no
  // aplicaba al final del scroll y el último nodo se cortaba).
  railContent: { paddingRight: 32 },
  rail: { flexDirection: 'row' },
  node: { minWidth: 112, paddingRight: 6 },
  starRow: { flexDirection: 'row', alignItems: 'center' },
  // Foto ligeramente elevada (brief: cada capítulo con su retrato).
  thumb: {
    marginTop: 8,
    width: 48,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  thumbImg: { width: 48, height: 68 },
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

import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { Sparkline } from '@/features/progress/components/Sparkline'
import { useGatedCompositionSeries, useMeasurements } from '@/features/progress/hooks'
import {
  checkinSeries,
  mergeWeightSeries,
  smoothWeightPoints,
  type SeriesPoint,
} from '@/features/progress/logic'
import { METRIC_CONFIG, METRIC_KEYS, type MetricKey } from '@/features/progress/metric-config'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Composición corporal (Epic 08 · F1) — la pregunta: "¿de qué está hecho mi
 * cambio?". Seis cards (valor actual + variación primera→última + sparkline),
 * cada una abre su detalle. El IMC vive AQUÍ (pantalla secundaria) y no en el
 * tab: respeta la decisión "IMC nunca protagonista" y el brief a la vez.
 * UN CTA primario: la medición completa (lo que alimenta todo esto).
 */

const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

export default function BodyCompositionScreen() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const { series, isPending, checkins } = useGatedCompositionSeries()

  const byKey = useMemo<Record<MetricKey, SeriesPoint[]>>(() => {
    const weightSerie = smoothWeightPoints(
      mergeWeightSeries(measurements.data ?? [], checkins.data ?? []),
    ).map((p) => ({ day: new Date(p.t).toISOString().slice(0, 10), value: p.weight }))
    return {
      peso: weightSerie,
      grasa: series.body_fat_pct,
      musculo: series.muscle_kg,
      agua: series.water_pct,
      visceral: checkinSeries(checkins.data ?? [], 'visceral_fat_index'),
      imc: checkinSeries(checkins.data ?? [], 'bmi'),
    }
  }, [measurements.data, checkins.data, series])

  const cards = METRIC_KEYS.map((key) => ({ key, serie: byKey[key] })).filter(
    (c) => c.serie.length > 0,
  )
  const lastDay = useMemo(
    () =>
      Object.values(byKey)
        .flat()
        .reduce<string | null>((acc, p) => (acc == null || p.day > acc ? p.day : acc), null),
    [byKey],
  )
  const loading = isPending || measurements.isPending

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Composición corporal</Text>
            <Text style={styles.sub}>De qué está hecho tu cambio</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.skeleton}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={styles.skeletonCard} />
            ))}
          </View>
        ) : cards.length === 0 ? (
          <View>
            <Text style={styles.empty}>Aún no hay mediciones de composición que mostrar.</Text>
            <View style={styles.emptyCta}>
              <PrimaryCta label="Medición completa" onPress={() => router.push('/log-checkin')} />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {lastDay ? (
              <Text style={styles.dateCaption}>
                Última medición · {lastDay.slice(8, 10)}/{lastDay.slice(5, 7)}/{lastDay.slice(0, 4)}
              </Text>
            ) : null}

            <View style={styles.grid}>
              {cards.map((c, i) => {
                const cfg = METRIC_CONFIG[c.key]
                const first = c.serie[0]!
                const last = c.serie[c.serie.length - 1]!
                const delta =
                  c.serie.length > 1 ? Number((last.value - first.value).toFixed(1)) : null
                return (
                  <Animated.View
                    key={c.key}
                    entering={FadeIn.duration(400).delay(i * 60)}
                    style={styles.gridItem}
                  >
                    <Pressable
                      onPress={() =>
                        // Peso ya tiene su pantalla-pregunta (/weight-trend);
                        // las demás van al detalle parametrizado.
                        c.key === 'peso'
                          ? router.push('/weight-trend')
                          : router.push({ pathname: '/metric/[key]', params: { key: c.key } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Ver el detalle de ${cfg.label}`}
                      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
                    >
                      <View style={styles.cardHead}>
                        <Text style={[styles.cardLabel, { color: cfg.hue }]}>{cfg.label}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                      <Text style={styles.cardValue}>{fmtVal(last.value, cfg.unit)}</Text>
                      {delta != null && delta !== 0 ? (
                        <Text style={[styles.cardDelta, { color: cfg.hue }]}>
                          {delta > 0 ? '+' : '−'}
                          {fmtVal(Math.abs(delta), cfg.unit)}
                        </Text>
                      ) : (
                        <Text style={styles.cardDeltaMuted}>
                          {c.serie.length === 1 ? 'primera medición' : 'sin cambio'}
                        </Text>
                      )}
                      {c.serie.length > 1 ? (
                        <Sparkline data={c.serie.map((p) => p.value)} hue={cfg.hue} />
                      ) : null}
                    </Pressable>
                  </Animated.View>
                )
              })}
            </View>

            <Text style={styles.note}>
              De tus mediciones y salud conectada. Evidencia, no veredicto.
            </Text>

            <View style={styles.ctaWrap}>
              <PrimaryCta label="Medición completa" onPress={() => router.push('/log-checkin')} />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  skeleton: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCard: {
    flexGrow: 1,
    flexBasis: '47%',
    height: 110,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    opacity: 0.6,
  },
  empty: {
    marginTop: 30,
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  emptyCta: { marginTop: 22, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  dateCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.niebla,
    marginBottom: 14,
    fontVariant: ['tabular-nums'],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { flexGrow: 1, flexBasis: '47%' },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.niebla,
  },
  cardValue: {
    marginTop: 6,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  cardDelta: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    fontVariant: ['tabular-nums'],
  },
  cardDeltaMuted: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  note: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  ctaWrap: { marginTop: 28 },
})

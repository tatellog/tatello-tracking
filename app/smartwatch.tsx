import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { WatchGlyph } from '@/features/wearables/components/WatchGlyph'
import {
  averageSteps,
  formatCount,
  lastSevenSteps,
  stepsOfDay,
  waterOfDay,
  workoutLineText,
  workoutsOfDay,
} from '@/features/wearables/health-summary'
import {
  useAppleHealthConnection,
  useHealthSummary,
  useLatestWearableWeight,
  useScaleConnection,
  useWearableSleepNights,
} from '@/features/wearables/hooks'
import { formatSleepShort, relativeSyncLabel } from '@/features/wearables/recovery'
import { addDaysIso } from '@/features/wearables/sleep-detail'
import { todayInTimezone, userTimezone } from '@/lib/time'
import { colors, radius, typography } from '@/theme'

/*
 * Tu smartwatch · todo lo que trajo el reloj y la báscula en un solo lugar
 * (dueña 29 sep 2026: "todo lo que venga del reloj lleva el ícono y hay una
 * sección que abre el detalle"). La abre la fila de Hoy y cualquier ícono del
 * reloj de la app. Muestra lo de hoy (sueño, entrenos por sesión, pasos, agua),
 * los pasos de la semana y la última lectura de la báscula. Es procedencia, no
 * metas: sin calificar la noche, sin meta de pasos, lo manual siempre gana.
 */
export default function SmartwatchScreen() {
  return (
    <ErrorBoundary screen="smartwatch">
      <SmartwatchBody />
    </ErrorBoundary>
  )
}

const BAR_MAX = 64

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]}`
}

function SmartwatchBody() {
  const router = useRouter()
  const tz = userTimezone()
  const today = todayInTimezone(tz)
  const from = addDaysIso(today, -6)

  const conn = useAppleHealthConnection()
  const scale = useScaleConnection()
  const summary = useHealthSummary(from, today)
  const nights = useWearableSleepNights(today, today)
  const weight = useLatestWearableWeight(scale.enabled === true)

  const sync = relativeSyncLabel(conn.lastSyncAt, new Date())
  const night = nights.data?.find((n) => n.sleep_date === today) ?? null
  const data = summary.data ?? { workouts: [], steps: [], water: [] }
  const workouts = workoutsOfDay(data.workouts, today, tz)
  const waterMl = waterOfDay(data, today)
  const steps = stepsOfDay(data, today)
  const bars = lastSevenSteps(data, today)
  const avg = averageSteps(bars)
  const barScale = Math.max(1, ...bars.map((b) => b.steps ?? 0))

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Tu smartwatch</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.source}>
            <WatchGlyph color={colors.niebla} size={13} />
            <Text style={styles.sourceText}>
              {conn.connected === false
                ? 'Tu reloj no está conectado'
                : `Tu reloj y tu báscula${sync ? ` · sincronizado ${sync}` : ''}`}
            </Text>
          </View>

          {conn.connected === false ? (
            <Pressable
              onPress={() => router.push('/connections')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>Conecta tu reloj</Text>
              <Text style={styles.muted}>
                Anota tu entreno, tu sueño, tus pasos y tu agua por ti. Nada sale de tu cuenta.
              </Text>
              <Text style={styles.cta}>Conectar ›</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.kicker}>HOY</Text>

              {/* Sueño: abre su detalle con etapas. */}
              <Pressable
                onPress={() => router.push('/sleep')}
                accessibilityRole="button"
                accessibilityLabel={
                  night
                    ? `Dormiste ${formatSleepShort(night.asleep_minutes)}. Ver tu sueño.`
                    : 'Ver tu sueño'
                }
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.cardTitle}>Sueño</Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
                {night ? (
                  <Text style={styles.value}>
                    {formatSleepShort(night.asleep_minutes)}
                    <Text style={styles.valueUnit}> anoche</Text>
                  </Text>
                ) : (
                  <Text style={styles.muted}>Todavía no llega el sueño de anoche.</Text>
                )}
              </Pressable>

              {/* Entrenos: cada sesión (en Hoy solo se ve el total). */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Entrenos</Text>
                {workouts.length > 0 ? (
                  <View style={styles.list}>
                    {workouts.map((w) => (
                      <Text key={w.key} style={styles.listItem}>
                        {workoutLineText(w)}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>Hoy no llegó ningún entreno.</Text>
                )}
              </View>

              {/* Pasos: el de hoy (dueña 29 sep 2026 lo pidió aquí, en el
                  detalle; en Hoy sigue sin contador) y la semana. Sin meta. */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pasos</Text>
                {steps != null ? (
                  <Text style={styles.value}>
                    {formatCount(steps)}
                    <Text style={styles.valueUnit}> hoy</Text>
                  </Text>
                ) : (
                  <Text style={styles.muted}>Todavía no llegan los pasos de hoy.</Text>
                )}
                {bars.some((b) => b.steps != null) ? (
                  <>
                    <View style={styles.bars}>
                      {bars.map((b) => (
                        <View key={b.day} style={styles.barCol}>
                          <View style={styles.barTrack}>
                            {b.steps != null && b.steps > 0 ? (
                              <View
                                style={[
                                  styles.bar,
                                  { height: Math.max(6, (b.steps / barScale) * BAR_MAX) },
                                  b.selected && styles.barOn,
                                ]}
                              />
                            ) : (
                              <View style={styles.barEmpty} />
                            )}
                          </View>
                          <Text style={[styles.barDay, b.selected && styles.barDayOn]}>
                            {b.initial}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {avg != null ? (
                      <Text style={styles.foot}>
                        Promedio de la semana:{' '}
                        <Text style={styles.footStrong}>{formatCount(avg)} pasos</Text>
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>

              {/* Agua: lo que otras apps o el reloj escriben en Salud. */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Agua</Text>
                {waterMl != null ? (
                  <Text style={styles.value}>
                    {formatCount(waterMl)}
                    <Text style={styles.valueUnit}> mL hoy</Text>
                  </Text>
                ) : (
                  <Text style={styles.muted}>Hoy no llegó agua desde Salud.</Text>
                )}
              </View>
            </>
          )}

          {/* La báscula vive en Salud también: su última lectura y su pantalla. */}
          <Text style={styles.kicker}>TU BÁSCULA</Text>
          <Pressable
            onPress={() => router.push('/scale')}
            accessibilityRole="button"
            accessibilityLabel="Abrir tu báscula"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.rowHead}>
              <Text style={styles.cardTitle}>Peso</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            {scale.enabled && weight.data ? (
              <Text style={styles.value}>
                {weight.data.weight_kg.toFixed(1).replace('.', ',')}
                <Text style={styles.valueUnit}> kg · {shortDate(weight.data.day_date)}</Text>
              </Text>
            ) : (
              <Text style={styles.muted}>
                {scale.enabled ? 'Todavía no llega ninguna lectura.' : 'Conecta tu báscula.'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.note}>
            Lo que anotas a mano siempre gana sobre lo de tu smartwatch.
          </Text>
          <Pressable
            onPress={() => router.push('/connections')}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.manage}
          >
            <Text style={styles.manageText}>Administrar conexión ›</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  source: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  kicker: {
    marginTop: 26,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 1.2,
    color: colors.niebla,
  },
  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  pressed: { opacity: 0.8 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.heading,
    color: colors.niebla,
  },
  value: {
    marginTop: 8,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displayMd,
    letterSpacing: -0.6,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  valueUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0,
    color: colors.bone,
  },
  muted: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  cta: {
    marginTop: 12,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  list: { marginTop: 10, gap: 8 },
  listItem: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  bars: { marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 5, backgroundColor: colors.bruma },
  barOn: { backgroundColor: colors.signal.entreno },
  barEmpty: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.hairline },
  barDay: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barDayOn: { color: colors.leche, fontFamily: typography.uiSemi },
  foot: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  footStrong: { fontFamily: typography.uiSemi, color: colors.leche },
  note: {
    marginTop: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  manage: { marginTop: 10, alignSelf: 'flex-start' },
  manageText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
})

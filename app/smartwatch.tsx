import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { comboTodayHighlight } from '@/features/orbit/combo-facts'
import { useStrongDay } from '@/features/orbit/strong-day'
import { SkyBackground } from '@/features/tabs/components'
import { WatchGlyph } from '@/features/wearables/components/WatchGlyph'
import {
  averageSteps,
  formatCount,
  lastSevenSteps,
  stepsOfDay,
  waterOfDay,
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
 * Tu smartwatch · lo que trajo el reloj que le importa a tu proceso (dueña
 * 30 sep 2026: "me gusta más cómo lo presenta Apple, solo lo importante").
 *
 * Anatomía de tarjeta tomada de Salud (categoría con ícono y color arriba a la
 * izquierda, hora del dato arriba a la derecha, valor grande con unidad chica,
 * mini barras a la derecha), con la paleta tenue de Stelar. Solo los tres datos
 * que alimentan "Tu día fuerte": sueño, entreno y pasos. Arriba, la frase del
 * motor (no IA, sin ✦) que conecta el dato con SU día fuerte y lleva a
 * Descubre. Lo que no llegó se dice en una línea al pie, sin tarjetas vacías.
 * Las kcal del entreno van chicas: procedencia, nunca "comida ganada" (spec
 * wearables: sin eat-back). El peso no se muestra aquí: la báscula es una fila
 * que abre su pantalla.
 */
export default function SmartwatchScreen() {
  return (
    <ErrorBoundary screen="smartwatch">
      <SmartwatchBody />
    </ErrorBoundary>
  )
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MINI_MAX = 30

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
  const strong = useStrongDay()

  const sync = relativeSyncLabel(conn.lastSyncAt, new Date())
  const night = nights.data?.find((n) => n.sleep_date === today) ?? null
  const data = summary.data ?? { workouts: [], steps: [], water: [] }
  const workouts = workoutsOfDay(data.workouts, today, tz)
  const totalMin = workouts.reduce((a, w) => a + (w.minutes ?? 0), 0)
  const kcal = workouts.reduce((a, w) => a + (w.kcal ?? 0), 0)
  const lastWorkout = workouts[workouts.length - 1] ?? null
  const steps = stepsOfDay(data, today)
  const waterMl = waterOfDay(data, today)
  const bars = lastSevenSteps(data, today)
  const avg = averageSteps(bars)
  const barScale = Math.max(1, ...bars.map((b) => b.steps ?? 0))
  const highlight = strong.combo ? comboTodayHighlight(strong.today) : null

  // Lo que no llegó, en una línea (sin tarjetas vacías).
  const missing = [
    night ? null : 'sueño de anoche',
    workouts.length > 0 ? null : 'entrenos',
    steps != null ? null : 'pasos',
  ].filter((x): x is string => x != null)

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
            <WatchGlyph color={colors.bone} size={13} />
            <Text style={styles.sourceText}>
              {conn.connected === false
                ? 'Tu reloj no está conectado'
                : `Reloj y báscula${sync ? ` · sincronizado ${sync}` : ''}`}
            </Text>
          </View>

          {conn.connected === false ? (
            <Pressable
              onPress={() => router.push('/connections')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.highlightText}>
                Conecta tu reloj y anota tu entreno, tu sueño y tus pasos por ti.
              </Text>
              <Text style={styles.highlightLink}>Conectar ›</Text>
            </Pressable>
          ) : (
            <>
              {/* La frase del motor: tu dato conectado con tu día fuerte. */}
              {highlight ? (
                <Pressable
                  onPress={() => router.push('/orbit')}
                  accessibilityRole="button"
                  accessibilityLabel={`${highlight} Ver tu día fuerte.`}
                  style={({ pressed }) => [
                    styles.card,
                    styles.highlight,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.highlightText}>{highlight}</Text>
                  <Text style={styles.highlightLink}>Ver tu día fuerte ›</Text>
                </Pressable>
              ) : null}

              {night ? (
                <HealthCard
                  glyph="☾"
                  label="Sueño"
                  tint={colors.dimension.sueno}
                  when="anoche"
                  onPress={() => router.push('/sleep')}
                >
                  <Text style={styles.value}>{formatSleepShort(night.asleep_minutes)}</Text>
                </HealthCard>
              ) : null}

              {lastWorkout ? (
                <HealthCard
                  glyph="✦"
                  label="Entreno"
                  tint={colors.signal.entreno}
                  when={lastWorkout.time}
                >
                  <Text style={styles.value}>
                    {totalMin > 0 ? totalMin : workouts.length}
                    <Text style={styles.unit}>
                      {totalMin > 0 ? ' min' : workouts.length === 1 ? ' sesión' : ' sesiones'}
                      {'  '}
                      {workouts.map((w) => w.label.toLowerCase()).join(' + ')}
                    </Text>
                  </Text>
                  <View style={styles.provenance}>
                    <WatchGlyph color={colors.bone} size={11} />
                    <Text style={styles.provenanceText}>
                      {`desde tu reloj${kcal > 0 ? ` · ~${formatCount(kcal)} kcal` : ''}`}
                    </Text>
                  </View>
                </HealthCard>
              ) : null}

              {steps != null ? (
                <HealthCard glyph="•" label="Pasos" tint={colors.leche} when="hoy">
                  <View style={styles.valueRow}>
                    <Text style={styles.value}>
                      {formatCount(steps)}
                      <Text style={styles.unit}> pasos</Text>
                    </Text>
                    <View style={styles.mini} accessible={false}>
                      {bars.map((b) => (
                        <View
                          key={b.day}
                          style={[
                            styles.miniBar,
                            {
                              height: Math.max(3, ((b.steps ?? 0) / barScale) * MINI_MAX),
                            },
                            b.selected && styles.miniBarToday,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                  {avg != null ? (
                    <Text style={styles.caption}>{`Tu semana: ${formatCount(avg)} al día`}</Text>
                  ) : null}
                </HealthCard>
              ) : null}

              {waterMl != null ? (
                <Text
                  style={styles.line}
                >{`Agua desde Salud: ${formatCount(waterMl)} mL hoy`}</Text>
              ) : null}
            </>
          )}

          {/* La báscula: una fila que abre su pantalla; el número vive allá. */}
          <Pressable
            onPress={() => router.push('/scale')}
            hitSlop={6}
            accessibilityRole="button"
            style={({ pressed }) => [styles.rowLink, pressed && styles.pressed]}
          >
            <Text style={styles.rowLinkText}>
              {scale.enabled && weight.data
                ? `Báscula · última lectura ${shortDate(weight.data.day_date)}`
                : 'Báscula · conectar'}
            </Text>
            <Text style={styles.rowLinkChevron}>›</Text>
          </Pressable>

          <View style={styles.foot}>
            {conn.connected !== false && missing.length > 0 ? (
              <Text style={styles.footText}>{`Todavía no llega: ${missing.join(', ')}.`}</Text>
            ) : null}
            <Text style={styles.footText}>Lo que anotas a mano siempre gana.</Text>
            <Pressable
              onPress={() => router.push('/connections')}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.manage}
            >
              <Text style={styles.manageText}>Administrar conexión ›</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/* La tarjeta al estilo Salud: categoría con ícono y color arriba a la
 * izquierda, cuándo llegó el dato arriba a la derecha, el valor debajo. */
function HealthCard({
  glyph,
  label,
  tint,
  when,
  onPress,
  children,
}: {
  glyph: string
  label: string
  tint: string
  when: string
  onPress?: () => void
  children: ReactNode
}) {
  const head = (
    <View style={styles.cardHead}>
      <Text style={[styles.cardLabel, { color: tint }]}>{`${glyph}  ${label}`}</Text>
      <Text style={styles.cardWhen}>
        {when}
        {onPress ? '  ›' : ''}
      </Text>
    </View>
  )
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {head}
      {children}
    </Pressable>
  ) : (
    <View style={styles.card}>
      {head}
      {children}
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
  source: { marginTop: 4, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  card: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.cardLg,
    backgroundColor: colors.bgCard,
  },
  pressed: { opacity: 0.8 },
  highlight: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.oroHairline },
  highlightText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.leche,
  },
  highlightLink: {
    marginTop: 10,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardLabel: { fontFamily: typography.uiSemi, fontSize: typography.sizes.bodyLarge },
  cardWhen: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  value: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -0.8,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0,
    color: colors.bone,
  },
  provenance: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  provenanceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: MINI_MAX,
    marginBottom: 8,
  },
  miniBar: { width: 6, borderRadius: 2, backgroundColor: colors.bruma },
  miniBarToday: { backgroundColor: colors.leche },
  caption: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  line: {
    marginTop: 14,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  rowLink: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.cardLg,
    backgroundColor: colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLinkText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  rowLinkChevron: { fontSize: typography.sizes.heading, color: colors.bone },
  foot: { marginTop: 22, gap: 6 },
  footText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  manage: { marginTop: 8, alignSelf: 'flex-start' },
  manageText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
})

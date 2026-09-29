import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useBriefContext } from '@/features/brief/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { sleepDeficitLink } from '@/features/orbit/sleep-link'
import { SkyBackground } from '@/features/tabs/components'
import { WatchMark } from '@/features/wearables/components/WatchMark'
import { useWearableSleepNights } from '@/features/wearables/hooks'
import { formatSleepShort } from '@/features/wearables/recovery'
import {
  addDaysIso,
  barLabel,
  clockTime,
  lastSevenNights,
  stageSegments,
  usualSleep,
  type StageKey,
} from '@/features/wearables/sleep-detail'
import { todayInTimezone, userTimezone } from '@/lib/time'
import { colors, radius, typography } from '@/theme'

/*
 * Tu sueño — el detalle que abre la fila "Dormiste 7 h 21" de Hoy.
 *
 * En Stelar el sueño no es una meta propia: alimenta el déficit. Por eso la
 * pantalla va de lo concreto (la noche, sus etapas, tus últimas 7) a lo que
 * importa (cómo se conecta con tus días en déficit, con el camino a
 * Descubre). Sin calificación de la noche ni metas de horas.
 */
export default function SleepScreen() {
  return (
    <ErrorBoundary screen="sueno">
      <SleepBody />
    </ErrorBoundary>
  )
}

const STAGE_COLOR: Record<StageKey, string> = {
  deep: colors.sleepStage.deep,
  core: colors.sleepStage.core,
  rem: colors.sleepStage.rem,
  awake: colors.sleepStage.awake,
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[(m ?? 1) - 1]}`
}

const BAR_MAX = 72

function SleepBody() {
  const router = useRouter()
  const tz = userTimezone()
  const params = useLocalSearchParams<{ date?: string }>()
  const today = todayInTimezone(tz)
  const date = typeof params.date === 'string' && params.date ? params.date : today
  const isToday = date === today

  const nights = useWearableSleepNights(addDaysIso(date, -6), date)
  const history = useSignalsHistory(90)
  const brief = useBriefContext()

  const minutesByDay = new Map<string, number>()
  for (const s of history.data ?? []) {
    if (s.day && s.sleep_minutes != null) minutesByDay.set(s.day, s.sleep_minutes)
  }
  const night = nights.data?.find((n) => n.sleep_date === date) ?? null
  const minutes = minutesByDay.get(date) ?? night?.asleep_minutes ?? null
  // Si la noche que manda es la manual, el reloj no la describe.
  const watchDescribes = night != null && night.asleep_minutes === minutes
  const stages = watchDescribes ? stageSegments(night) : null

  const bars = lastSevenNights(date, minutesByDay)
  const usual = usualSleep([...minutesByDay.values()])
  const barScale = Math.max(600, ...bars.map((b) => b.minutes ?? 0))
  const link = sleepDeficitLink(history.data ?? [], brief.data?.targets?.calories ?? null)

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
          <Text style={styles.title}>Tu sueño</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── La noche ── */}
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>
              {isToday ? 'ANOCHE' : `LA NOCHE DEL ${dayLabel(date).toUpperCase()}`}
            </Text>
            {watchDescribes ? (
              <View style={styles.source}>
                <WatchMark past={!isToday} size={12} inline={false} />
                <Text style={styles.sourceText}>de tu smartwatch</Text>
              </View>
            ) : null}
          </View>
          {minutes != null ? (
            <>
              <Text style={styles.hero}>
                {formatSleepShort(minutes)}
                <Text style={styles.heroUnit}> de sueño</Text>
              </Text>
              {watchDescribes && night.bedtime_at && night.wake_at ? (
                <Text style={styles.window}>
                  {clockTime(night.bedtime_at, tz)} a {clockTime(night.wake_at, tz)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.empty}>Todavía no hay sueño de esta noche.</Text>
          )}

          {/* ── Etapas ── */}
          {minutes != null ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cómo fue la noche</Text>
              {stages ? (
                <>
                  <View style={styles.stageBar}>
                    {stages
                      .filter((s) => s.minutes > 0)
                      .map((s) => (
                        <View
                          key={s.key}
                          style={{ flex: s.share, backgroundColor: STAGE_COLOR[s.key] }}
                        />
                      ))}
                  </View>
                  <View style={styles.stageList}>
                    {stages.map((s) => (
                      <View key={s.key} style={styles.stageRow}>
                        <View style={[styles.stageDot, { backgroundColor: STAGE_COLOR[s.key] }]} />
                        <Text style={styles.stageLabel}>{s.label}</Text>
                        <Text style={styles.stageValue}>{formatSleepShort(s.minutes)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.muted}>
                  {watchDescribes
                    ? 'Tu reloj no mandó las etapas de esta noche.'
                    : 'Las etapas aparecen cuando la noche llega de tu reloj.'}
                </Text>
              )}
            </View>
          ) : null}

          {/* ── Últimas 7 noches ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tus últimas 7 noches</Text>
            <View style={styles.bars}>
              {bars.map((b) => (
                <View key={b.day} style={styles.barCol}>
                  <Text style={[styles.barValue, b.selected && styles.barValueOn]}>
                    {b.minutes != null ? barLabel(b.minutes) : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    {b.minutes != null ? (
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(6, (b.minutes / barScale) * BAR_MAX) },
                          b.selected && styles.barOn,
                        ]}
                      />
                    ) : (
                      <View style={styles.barEmpty} />
                    )}
                  </View>
                  <Text style={[styles.barDay, b.selected && styles.barDayOn]}>{b.initial}</Text>
                </View>
              ))}
            </View>
            {usual != null ? (
              <Text style={styles.usual}>
                Lo normal para ti: <Text style={styles.usualStrong}>{formatSleepShort(usual)}</Text>
              </Text>
            ) : null}
          </View>

          {/* ── Lo que importa: sueño ↔ déficit ── */}
          {link ? (
            <Pressable
              onPress={() => router.push('/orbit')}
              accessibilityRole="button"
              accessibilityLabel={`${link.headline} Abrir Descubre.`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.linkHeadline}>{link.headline}</Text>
              <Text style={styles.linkEvidence}>
                {link.good.deficit} de {link.good.days} tras dormir 7 h o más · {link.short.deficit}{' '}
                de {link.short.days} tras noches más cortas
              </Text>
              <Text style={styles.linkCta}>Descubre ›</Text>
            </Pressable>
          ) : null}
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
  kickerRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 1.2,
    color: colors.niebla,
  },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sourceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  hero: {
    marginTop: 8,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.statHero,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    letterSpacing: 0,
    color: colors.bone,
  },
  window: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  card: {
    marginTop: 18,
    padding: 18,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  pressed: { opacity: 0.8 },
  cardTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  muted: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  stageBar: {
    marginTop: 14,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2,
  },
  stageList: { marginTop: 14, gap: 10 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  stageValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  bars: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  barValueOn: { color: colors.leche, fontFamily: typography.uiSemi },
  barTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 5, backgroundColor: colors.bruma },
  barOn: { backgroundColor: colors.dimension.sueno },
  barEmpty: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.hairline },
  barDay: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barDayOn: { color: colors.leche, fontFamily: typography.uiSemi },
  usual: {
    marginTop: 14,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  usualStrong: { fontFamily: typography.uiSemi, color: colors.leche },
  linkHeadline: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.leche,
  },
  linkEvidence: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  linkCta: {
    marginTop: 12,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
})

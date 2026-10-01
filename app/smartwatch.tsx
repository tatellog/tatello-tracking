import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useMacroTargets } from '@/features/macros/hooks'
import { comboTodayHighlight } from '@/features/orbit/combo-facts'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { useStrongDay } from '@/features/orbit/strong-day'
import { SkyBackground } from '@/features/tabs/components'
import { MoonGlyph } from '@/features/tabs/components/check-in-glyphs'
import { WatchGlyph } from '@/features/wearables/components/WatchGlyph'
import { WorkoutHero } from '@/features/wearables/components/WorkoutHero'
import {
  averageSteps,
  formatCount,
  lastSevenSteps,
  localDayOf,
  stepsOfDay,
  waterOfDay,
} from '@/features/wearables/health-summary'
import {
  useAppleHealthConnection,
  useHealthSummary,
  useLatestWearableWeight,
  useScaleConnection,
  useWearableSleepNights,
} from '@/features/wearables/hooks'
import { formatSleepShort, relativeSyncLabel } from '@/features/wearables/recovery'
import { addDaysIso, stageSegments, type StageKey } from '@/features/wearables/sleep-detail'
import {
  formatMinutes,
  movementWeek,
  todayWorkout,
  trainingDeficitBridge,
  WORKOUT_NAME,
} from '@/features/wearables/workout-insights'
import { todayInTimezone, userTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Tu smartwatch · lo que el reloj dice de tu proceso (dueña 30 sep 2026: "más
 * estilo, más de mi ejercicio, que Stelar sea el source of truth de mi peso,
 * solo lo relevante, que enganche").
 *
 * Jerarquía: el ENTRENO es el hero (WorkoutHero: anillo contra tu promedio,
 * tu marca, tu semana en una línea). Debajo, "Lo que mueve tu peso": el
 * puente reloj → déficit (de TUS datos, solo si hay evidencia), tu día
 * fuerte y la proteína en días de fuerza. Sueño y pasos bajan a dos tiles con
 * el tinte de su dimensión. La báscula es una fila (el número vive en su
 * pantalla). Sin IA ni ✦ aquí: todo es el motor. Kcal del reloj solo como
 * procedencia (spec wearables: nunca eat-back).
 */
export default function SmartwatchScreen() {
  return (
    <ErrorBoundary screen="smartwatch">
      <SmartwatchBody />
    </ErrorBoundary>
  )
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MINI_MAX = 30
const SUENO = colors.dimension.sueno
const STAGE_COLOR: Record<StageKey, string> = {
  deep: colors.sleepStage.deep,
  core: colors.sleepStage.core,
  rem: colors.sleepStage.rem,
  awake: colors.sleepStage.awake,
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]}`
}

function SmartwatchBody() {
  const router = useRouter()
  const tz = userTimezone()
  const today = todayInTimezone(tz)

  const conn = useAppleHealthConnection()
  const scale = useScaleConnection()
  const summary = useHealthSummary(addDaysIso(today, -89), today)
  const nights = useWearableSleepNights(today, today)
  const weight = useLatestWearableWeight(scale.enabled === true)
  const strong = useStrongDay()
  const history = useSignalsHistory(90)
  const targets = useMacroTargets().data

  const sync = relativeSyncLabel(conn.lastSyncAt, new Date())
  const night = nights.data?.find((n) => n.sleep_date === today) ?? null
  const stages = night ? stageSegments(night) : null
  const data = summary.data ?? { workouts: [], steps: [], water: [] }
  const workout = todayWorkout(data.workouts, today, tz)
  const week = movementWeek(data.workouts, today, tz)
  const last = [...data.workouts]
    .filter((w) => localDayOf(w.started_at, tz) < today)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0]
  const lastWorkout = last
    ? `${DOW[new Date(`${localDayOf(last.started_at, tz)}T12:00:00Z`).getUTCDay()]}, ${(
        WORKOUT_NAME[last.workout_type ?? ''] ?? 'entreno'
      ).toLowerCase()} ${formatMinutes(last.duration_min ?? 0)}`
    : null

  const steps = stepsOfDay(data, today)
  const waterMl = waterOfDay(data, today)
  const bars = lastSevenSteps(data, today)
  const avg = averageSteps(bars)
  const barScale = Math.max(1, ...bars.map((b) => b.steps ?? 0), avg ?? 0)

  // Lo que mueve tu peso: el puente con el déficit, tu día fuerte y la
  // proteína en días de fuerza (recomposición: que lo que bajes sea grasa).
  const signals = history.data ?? []
  const bridge = trainingDeficitBridge(signals, targets?.calories ?? null, workout?.type ?? null)
  const strongLine = strong.combo ? comboTodayHighlight(strong.today) : null
  const todaySig = signals.find((s) => s.day === today)
  const proteinTarget = targets?.protein_g ?? null
  const protein = todaySig?.protein_g != null ? Math.round(todaySig.protein_g) : 0
  const showProtein = workout?.type === 'fuerza' && proteinTarget != null && proteinTarget > 0

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
              style={({ pressed }) => [styles.plain, pressed && styles.pressed]}
            >
              <Text style={styles.bigLine}>
                Conecta tu reloj y anota tu entreno, tu sueño y tus pasos por ti.
              </Text>
              <Text style={styles.link}>Conectar ›</Text>
            </Pressable>
          ) : summary.isLoading ? (
            <View style={styles.skeleton} />
          ) : (
            <>
              <WorkoutHero
                workout={workout}
                week={week}
                lastWorkout={lastWorkout}
                tz={tz}
                onOpenMonth={() => router.push('/orbit')}
              />

              {bridge || strongLine || showProtein ? (
                <Animated.View entering={FadeInDown.duration(320).delay(90)}>
                  <Text style={styles.section}>Lo que mueve tu peso</Text>
                  <View style={[styles.plain, styles.moves]}>
                    {bridge ? <Text style={styles.bigLine}>{bridge}</Text> : null}
                    {strongLine ? (
                      <Pressable
                        onPress={() => router.push('/orbit')}
                        accessibilityRole="button"
                        style={({ pressed }) => [pressed && styles.pressed]}
                      >
                        <Text style={bridge ? styles.line : styles.bigLine}>{strongLine}</Text>
                        <Text style={styles.link}>Ver tu día fuerte ›</Text>
                      </Pressable>
                    ) : null}
                    {showProtein ? (
                      <View style={styles.proteinRow}>
                        <View style={styles.proteinText}>
                          <Text style={styles.line}>
                            Proteína hoy{'  '}
                            <Text
                              style={styles.lineStrong}
                            >{`${protein} de ${proteinTarget} g`}</Text>
                          </Text>
                          <View style={styles.proteinTrack}>
                            <View
                              style={[
                                styles.proteinFill,
                                { width: `${Math.min(100, (protein / proteinTarget) * 100)}%` },
                              ]}
                            />
                          </View>
                        </View>
                        {protein < proteinTarget ? (
                          <Pressable
                            onPress={() => router.push('/meals')}
                            hitSlop={8}
                            accessibilityRole="button"
                          >
                            <Text style={styles.link}>Registrar ›</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
              ) : null}

              {/* Sueño y pasos: dos tiles con el tinte de su dimensión. */}
              <Animated.View entering={FadeInDown.duration(320).delay(150)} style={styles.tiles}>
                <Tile tint={SUENO} onPress={() => router.push('/sleep')}>
                  <View style={styles.tileHead}>
                    <MoonGlyph color={SUENO} size={14} />
                    <Text style={[styles.tileLabel, { color: SUENO }]}>Sueño</Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                  <Text style={styles.tileValue}>
                    {night ? formatSleepShort(night.asleep_minutes) : '—'}
                  </Text>
                  {stages ? (
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
                  ) : null}
                  <Text style={styles.tileCaption}>{night ? 'anoche' : 'todavía no llega'}</Text>
                </Tile>
                <Tile tint={colors.leche}>
                  <View style={styles.tileHead}>
                    <View style={styles.stepsDot} />
                    <Text style={[styles.tileLabel, { color: colors.leche }]}>Pasos</Text>
                  </View>
                  <Text style={styles.tileValue}>{steps != null ? formatCount(steps) : '—'}</Text>
                  <View style={styles.mini}>
                    {avg != null ? (
                      <View
                        style={[styles.avgLine, { bottom: (avg / barScale) * MINI_MAX }]}
                        pointerEvents="none"
                      />
                    ) : null}
                    {bars.map((b) => (
                      <View
                        key={b.day}
                        style={[
                          styles.miniBar,
                          { height: Math.max(3, ((b.steps ?? 0) / barScale) * MINI_MAX) },
                          b.selected && styles.miniBarToday,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.tileCaption}>
                    {avg != null ? `tu semana: ${formatCount(avg)} al día` : 'hoy'}
                  </Text>
                </Tile>
              </Animated.View>

              {waterMl != null ? (
                <Text
                  style={styles.water}
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
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.foot}>
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

/* Tile con el tinte de su dimensión (gradiente tenue, sin borde duro). */
function Tile({
  tint,
  onPress,
  children,
}: {
  tint: string
  onPress?: () => void
  children: ReactNode
}) {
  const body = (
    <LinearGradient
      colors={[`${tint}1F`, `${tint}08`, colors.bgCard]}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.tile}
    >
      {children}
    </LinearGradient>
  )
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.tileWrap}>{body}</View>
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
  source: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  skeleton: { marginTop: 14, height: 300, borderRadius: 24, backgroundColor: colors.bgCard },
  pressed: { transform: [{ scale: 0.98 }] },
  section: {
    marginTop: 24,
    marginBottom: 10,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  plain: {
    marginTop: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  moves: { marginTop: 0, gap: 14 },
  bigLine: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.leche,
  },
  line: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 20,
    color: colors.bone,
  },
  lineStrong: { fontFamily: typography.uiSemi, color: colors.leche },
  link: {
    marginTop: 8,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  proteinRow: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  proteinText: { flex: 1, gap: 8 },
  proteinTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  proteinFill: { height: '100%', borderRadius: 3, backgroundColor: colors.signal.proteina },
  tiles: { marginTop: 14, flexDirection: 'row', gap: 12 },
  tileWrap: { flex: 1 },
  tile: { flex: 1, padding: 16, borderRadius: 20, minHeight: 150, gap: 8 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { flex: 1, fontFamily: typography.uiSemi, fontSize: typography.sizes.body },
  tileValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displayMd,
    letterSpacing: -0.6,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  tileCaption: {
    marginTop: 'auto',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  stageBar: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  stepsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.leche },
  mini: {
    height: MINI_MAX,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.bone,
    opacity: 0.6,
  },
  miniBar: { width: 7, borderRadius: 2, backgroundColor: colors.bruma },
  miniBarToday: { backgroundColor: colors.leche },
  water: {
    marginTop: 14,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  rowLink: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
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
  chevron: { fontSize: typography.sizes.heading, color: colors.bone },
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

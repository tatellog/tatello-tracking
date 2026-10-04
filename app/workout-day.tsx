import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkyBackground } from '@/features/tabs/components'
import { WorkoutSessionCard } from '@/features/wearables/components/WorkoutHero'
import { useHealthSummary } from '@/features/wearables/hooks'
import { addDaysIso } from '@/features/wearables/sleep-detail'
import { workoutOfDay } from '@/features/wearables/workout-insights'
import { todayInTimezone, userTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * El entreno de UN día (dueña 3 oct 2026): lo que abre la fila "Entrenaste"
 * de Hoy. Cada sesión que trajo el reloj (Bici, Fuerza, Cardio mixto…) con su
 * ícono, hora, minutos y kcal. Es la misma tarjeta del hero de Tu smartwatch y
 * del detalle de Descubre: un entreno se ve igual sea de hoy o de un día
 * pasado. Los 90 días previos solo alimentan "tu promedio" y "tu marca".
 */
export default function WorkoutDayScreen() {
  return (
    <ErrorBoundary screen="entreno-dia">
      <WorkoutDayBody />
    </ErrorBoundary>
  )
}

const ENTRENO = colors.dimension.mente

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

function WorkoutDayBody() {
  const router = useRouter()
  const tz = userTimezone()
  const params = useLocalSearchParams<{ date?: string }>()
  const today = todayInTimezone(tz)
  const date = typeof params.date === 'string' && params.date ? params.date : today
  const isToday = date === today

  const summary = useHealthSummary(addDaysIso(date, -89), date)
  const workout = summary.data ? workoutOfDay(summary.data.workouts, date, tz) : null

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
          <Text style={styles.title}>Tu entreno</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.date}>{isToday ? 'Hoy' : dayLabel(date)}</Text>
          {workout ? (
            <Animated.View entering={FadeInDown.duration(320)}>
              <LinearGradient
                colors={[`${ENTRENO}2E`, `${ENTRENO}0A`, colors.bgCard]}
                locations={[0, 0.45, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.card}
              >
                <WorkoutSessionCard workout={workout} tz={tz} />
              </LinearGradient>
            </Animated.View>
          ) : summary.isLoading ? null : (
            <Text style={styles.empty}>Ese día tu reloj no trajo entrenos.</Text>
          )}
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
  date: {
    marginTop: 4,
    marginBottom: 12,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${ENTRENO}40`,
  },
  empty: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})

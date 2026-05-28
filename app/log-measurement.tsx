import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { PrimaryCta } from '@/components/PrimaryCta'
import { StarLoader } from '@/components/StarLoader'
import { useAddMeasurement, useMeasurements } from '@/features/progress/hooks'
import { toWeightPoints } from '@/features/progress/logic'
import { SkyBackground } from '@/features/tabs/components'
import { WeightWheel } from '@/features/tabs/components/WeightWheel'
import { colors, typography } from '@/theme'

const DEFAULT_WEIGHT = 70

/*
 * Log a new weight reading — the same two-wheel picker the quick-log
 * uses, not a typed form. The wheels start at the latest weight so a
 * new reading is a small scroll, not one from scratch. The timestamp
 * defaults to "now"; the user weighs in the moment they open this.
 */
export default function LogMeasurementScreen() {
  const router = useRouter()
  const addMeasurement = useAddMeasurement()
  const measurementsQuery = useMeasurements(90)

  const latestWeight = useMemo(() => {
    const pts = toWeightPoints(measurementsQuery.data ?? [])
    return pts.length > 0 ? (pts[pts.length - 1]?.weight ?? null) : null
  }, [measurementsQuery.data])

  const save = (kg: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    addMeasurement.mutate(
      { weight_kg: Math.round(kg * 10) / 10, measured_at: new Date().toISOString() },
      {
        onSuccess: () => {
          Toast.show({ type: 'success', text1: 'Peso registrado' })
          router.back()
        },
        onError: (err) => {
          Toast.show({
            type: 'error',
            text1: 'No pudimos guardar',
            text2: err instanceof Error ? err.message : 'Intenta de nuevo.',
          })
        },
      },
    )
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Tu peso actual</Text>
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

        {measurementsQuery.isLoading ? (
          <View style={styles.center}>
            <StarLoader size={40} />
          </View>
        ) : (
          <WeightEntry
            initialKg={latestWeight ?? DEFAULT_WEIGHT}
            saving={addMeasurement.isPending}
            onSave={save}
          />
        )}
      </SafeAreaView>
    </View>
  )
}

/* The wheel + CTA — split out so it mounts only once the latest weight
 * is known, since WeightWheel reads its start position once at mount. */
function WeightEntry({
  initialKg,
  saving,
  onSave,
}: {
  initialKg: number
  saving: boolean
  onSave: (kg: number) => void
}) {
  const [kg, setKg] = useState(initialKg)
  return (
    <View style={styles.entry}>
      <View style={styles.wheelWrap}>
        <WeightWheel value={kg} onChange={setKg} />
      </View>
      <PrimaryCta
        label="Registrar peso"
        onPress={() => onSave(kg)}
        loading={saving}
        loadingLabel="Guardando…"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entry: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  wheelWrap: {
    marginBottom: 28,
  },
})

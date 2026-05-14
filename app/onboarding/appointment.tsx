import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  PhotoPlaceholder,
  StepHeader,
  Timeline28,
  useCountUp,
  WizardLayout,
} from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const WEEKDAY_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const
const MONTH_ES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
] as const

export default function AppointmentScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [advancing, setAdvancing] = useState(false)

  const name = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  const counterValue = useCountUp('28', { duration: 1400, startDelay: 400, decimals: 0 })

  const { weekday, day, month } = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 28)
    return {
      weekday: WEEKDAY_ES[d.getDay()] ?? 'DOM',
      day: d.getDate(),
      month: MONTH_ES[d.getMonth()] ?? 'ENE',
    }
  }, [])

  const handleStart = async () => {
    setAdvancing(true)
    try {
      await updateProfile.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
      })
    } catch {
      // Día 1 re-fetches the profile on mount, so a transient patch
      // failure doesn't strand the user on the appointment screen.
    }
    router.replace('/onboarding/day-one')
  }

  return (
    <WizardLayout
      step={5}
      canContinue
      loading={advancing}
      onContinue={handleStart}
      continueLabel="Empezar mi día 1 →"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <StepHeader eyebrow="Tu cita" eyebrowColor="magenta" question="" />

        <Text style={styles.megaNumber}>{counterValue}</Text>
        <Text style={styles.caption}>días para tu primera comparativa.</Text>

        <View style={styles.timelineWrap}>
          <Timeline28 />
        </View>

        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>NOS VEMOS</Text>
          <Text style={styles.dateValue}>
            {weekday} <Text style={styles.dateDay}>{day}</Text> {month}
          </Text>
        </View>

        <View style={styles.previewRow}>
          <PhotoPlaceholder prefix="Día 1" caption={'tu foto\nde hoy'} />
          <PhotoPlaceholder prefix="Día 28" caption={'tu foto\nen 4 semanas'} />
        </View>

        <Text style={styles.poet}>
          {name}, vuelves a esta pantalla.{'\n'}Verás{' '}
          <Text style={styles.poetAccent}>lo que cambió</Text>.
        </Text>
      </ScrollView>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  megaNumber: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: 80,
    lineHeight: 68,
    color: colors.magenta,
    letterSpacing: -4,
  },
  caption: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.bone,
    lineHeight: 20,
  },
  timelineWrap: {
    marginTop: 18,
  },
  dateBlock: {
    marginTop: 18,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.bruma,
  },
  dateLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 2.2,
  },
  dateValue: {
    marginTop: 2,
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  dateDay: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    color: colors.magenta,
  },
  previewRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  poet: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.bone,
  },
  poetAccent: {
    color: colors.magenta,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
  },
})

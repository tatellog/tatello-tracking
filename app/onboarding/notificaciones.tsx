import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { SelectableCard, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { type NotificationWindow } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const OPTIONS: readonly {
  value: NotificationWindow
  label: string
  description: string
}[] = [
  {
    value: 'morning',
    label: 'En la mañana',
    description: 'Para arrancar el día con tu lectura',
  },
  {
    value: 'midday',
    label: 'Al mediodía',
    description: 'Un check-in en la mitad del día',
  },
  {
    value: 'evening',
    label: 'Antes de dormir',
    description: 'Para cerrar el día con Stelar',
  },
  {
    value: 'not_yet',
    label: 'Aún no',
    description: 'Lo activas cuando quieras desde Ajustes',
  },
]

/*
 * Step 10 — notification warmup. The classic pattern: ask the user
 * WHEN they want to hear from Stelar before firing the iOS native
 * permission prompt. By the time the OS dialog lands, the user has
 * already mentally consented; permission grant rates go up 2-3x vs
 * a cold prompt at app open.
 *
 * The 'not_yet' option is a real value, not a skip — it means the
 * user said no for now, which the future re-ask logic uses to surface
 * a soft nudge later. Picking morning/midday/evening fires the iOS
 * permission prompt right away.
 *
 * The actual scheduling of the recurring local notification will
 * land later (needs profile.timezone + the engine's daily-reading
 * output). For now we just capture the preference and the OS
 * permission token — the wiring upstream is the next deliverable.
 */
export default function NotificacionesScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [window, setWindow] = useState<NotificationWindow | null>(
    (profile?.notification_window as NotificationWindow | null) ?? null,
  )
  const [requestingPermission, setRequestingPermission] = useState(false)

  const firstName = (profile?.display_name ?? '').trim().split(' ')[0] || ''
  const eyebrow = firstName ? `Cuando quieras · ${firstName}` : 'Cuando quieras'

  const canContinue = window !== null

  const handleContinue = async () => {
    if (!canContinue || !window) return
    setRequestingPermission(true)
    try {
      // Only fire the OS prompt when the user actually wants
      // notifications. `not_yet` saves the preference + skips the
      // ask — Stelar will surface a soft re-ask later, not now.
      if (window !== 'not_yet') {
        const settings = await Notifications.getPermissionsAsync()
        if (settings.status !== 'granted' && settings.canAskAgain) {
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          })
        }
      }
      await updateProfile.mutateAsync({ notification_window: window })
      router.push('/onboarding/leyendo')
    } catch (err) {
      // Permission errors are not blocking — we save the preference
      // either way so the user reaches reveal and Settings can
      // resurface the ask. The console is enough for now.
      console.warn('notification permission flow:', err)
      try {
        await updateProfile.mutateAsync({ notification_window: window })
      } catch {
        // Soft failure on the profile patch; reveal re-fetches.
      }
      router.push('/onboarding/leyendo')
    } finally {
      setRequestingPermission(false)
    }
  }

  return (
    <WizardLayout
      step={11}
      totalSteps={12}
      canContinue={canContinue}
      loading={requestingPermission || updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow={eyebrow}
          eyebrowColor="magenta"
          question="¿Cuándo quieres tu lectura del día?"
          questionEmphasis="lectura"
          hint="Una vez al día, en el momento que tú elijas. Puedes cambiarlo después."
        />

        <View style={styles.optionsBlock}>
          {OPTIONS.map((opt) => (
            <SelectableCard
              key={opt.value}
              variant="row"
              label={opt.label}
              description={opt.description}
              selected={window === opt.value}
              onPress={() => setWindow(opt.value)}
            />
          ))}
        </View>

        <Text style={styles.foot}>Stelar te toca una vez al día. Tú eliges cuándo.</Text>
      </ScrollView>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  optionsBlock: {
    marginTop: 28,
    gap: 10,
  },
  foot: {
    marginTop: 22,
    fontFamily: typography.uiMedium,
    fontSize: 11,
    lineHeight: 16,
    color: colors.niebla,
    textAlign: 'center',
  },
})

import { useLocalSearchParams, useRouter } from 'expo-router'
import { Linking, Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { colors, duration, spacing, typography } from '@/theme'

import { AuthScreenLayout } from './components/AuthScreenLayout'
import { SubmitButton } from './components/SubmitButton'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const SUPPORT_EMAIL = 'hola@stelar.app'

/*
 * Password recovery during the beta. Automated reset emails aren't live
 * yet, so we DON'T promise a link we can't send — recovery is personal
 * for now: one honest screen pointing to support. When email is wired up
 * (supabase confirm-email + reset template), bring back the email field
 * and call requestPasswordReset from features/auth/api.
 */
export default function ResetScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const trimmedEmail = (params.email ?? '').trim()

  return (
    <AuthScreenLayout anchorPulseOnce>
      <Animated.View entering={enter(80)} style={styles.headerBlock}>
        <Text style={styles.headline}>¿No puedes entrar?</Text>
      </Animated.View>

      <Animated.View entering={enter(160)} style={styles.body}>
        {/* Voice moment — Cormorant italic is allowed here. */}
        <Text style={styles.serifBody}>
          Por ahora te ayudo a entrar de forma personal. Escríbeme y lo resolvemos juntas.
        </Text>
        <Pressable
          hitSlop={12}
          style={styles.linkTap}
          accessibilityRole="link"
          accessibilityLabel={`Escribir a ${SUPPORT_EMAIL}`}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        >
          <Text style={styles.mailto}>{SUPPORT_EMAIL}</Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={enter(240)} style={styles.form}>
        <SubmitButton
          label="Volver a iniciar sesión"
          submittingLabel="Volver a iniciar sesión"
          canSubmit
          isSubmitting={false}
          onPress={() => router.replace({ pathname: '/auth', params: { email: trimmedEmail } })}
        />
      </Animated.View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing.sm },
  form: { gap: spacing.md },
  body: { gap: spacing.md },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  serifBody: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    lineHeight: typography.sizes.headingLg * typography.lineHeight.statement,
  },
  mailto: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oro,
  },
  linkTap: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
})

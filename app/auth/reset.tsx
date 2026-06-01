import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { requestPasswordReset } from '@/features/auth/api'
import { colors, duration, spacing, typography } from '@/theme'

import { AuthScreenLayout } from './components/AuthScreenLayout'
import { Field } from './components/Field'
import { SubmitButton } from './components/SubmitButton'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const SUPPORT_EMAIL = 'hola@stelar.app'
const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export default function ResetScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const trimmedEmail = email.trim()
  const canSubmit = isEmailValid(trimmedEmail) && !submitting

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)
    const result = await requestPasswordReset(trimmedEmail)
    setSubmitting(false)
    if (result.ok) {
      setSent(true)
    } else {
      setErrorMessage(result.message)
    }
  }

  if (sent) {
    return (
      <AuthScreenLayout anchorPulseOnce>
        <Animated.View entering={enter(80)} style={styles.headerBlock}>
          <Text style={styles.meta}>STELAR</Text>
          <Text style={styles.headline}>Revisa tu correo</Text>
        </Animated.View>

        <Animated.View entering={enter(160)} style={styles.sentBody}>
          {/* Voice moment — Cormorant italic is allowed here. */}
          <Text style={styles.serifBody}>
            Aún estoy activando los correos de recuperación. Mientras tanto, escríbeme y te ayudo
            a entrar.
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
          <Pressable
            hitSlop={12}
            style={styles.linkTap}
            accessibilityRole="link"
            onPress={() => {
              setSent(false)
              setErrorMessage(null)
            }}
          >
            <Text style={styles.linkMuted}>¿No llegó? Intentar de nuevo</Text>
          </Pressable>
        </Animated.View>
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout>
      <Animated.View entering={enter(80)} style={styles.headerBlock}>
        <Text style={styles.meta}>STELAR</Text>
        <Text style={styles.headline}>Restablecer contraseña</Text>
        <Text style={styles.editorial}>
          Escribe tu correo y te enviamos un enlace para crear una nueva contraseña.
        </Text>
      </Animated.View>

      <View style={styles.form}>
        <Animated.View entering={enter(160)}>
          <Field
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            icon="mail"
            accessibilityLabel="Correo electrónico"
            disabled={submitting}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
          />
        </Animated.View>

        {errorMessage ? (
          <Animated.View entering={enter(0)}>
            <Text style={styles.error}>{errorMessage}</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(220)}>
          <SubmitButton
            label="Enviar enlace"
            submittingLabel="Enviando…"
            canSubmit={canSubmit}
            isSubmitting={submitting}
            onPress={onSubmit}
          />
        </Animated.View>
      </View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing.sm },
  form: { gap: spacing.md },
  sentBody: { gap: spacing.md },
  meta: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.oro,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
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
  error: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
  },
  linkTap: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  linkMuted: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})

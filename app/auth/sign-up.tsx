import { Feather } from '@expo/vector-icons'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { signUp } from '@/features/auth/api'
import { colors, duration, spacing, typography } from '@/theme'

import { AuthScreenLayout } from './components/AuthScreenLayout'
import { Field } from './components/Field'
import { SubmitButton } from './components/SubmitButton'

const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

const MIN_PASSWORD = 6
const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

export default function SignUpScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ email?: string }>()
  const [email, setEmail] = useState(params.email ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailExists, setEmailExists] = useState(false)

  const trimmedEmail = email.trim()
  const passwordsMatch = confirm.length > 0 && password === confirm
  const canSubmit =
    isEmailValid(trimmedEmail) && password.length >= MIN_PASSWORD && passwordsMatch && !submitting

  // Match feedback only appears once the user has left the confirm field.
  const showMatch = confirmTouched && confirm.length > 0

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage(null)
    setEmailExists(false)
    // On ok:true we do NOT navigate — RouteGuard reacts to the session.
    const result = await signUp(trimmedEmail, password)
    if (!result.ok) {
      setErrorMessage(result.message)
      setEmailExists(result.code === 'email_exists')
      setSubmitting(false)
    }
  }

  return (
    <AuthScreenLayout>
      <Animated.View entering={enter(80)} style={styles.headerBlock}>
        <Text style={styles.headline}>Crea tu cuenta</Text>
        <Text style={styles.editorial}>
          Solo tu cuenta por ahora. Lo demás lo vemos juntas.
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
            returnKeyType="next"
          />
        </Animated.View>

        <Animated.View entering={enter(220)}>
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 6 caracteres"
            icon="lock"
            accessibilityLabel="Contraseña"
            disabled={submitting}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="next"
            trailing={
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.niebla} />
              </Pressable>
            }
          />
        </Animated.View>

        <Animated.View entering={enter(280)} style={styles.confirmBlock}>
          <Field
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirma tu contraseña"
            icon="lock"
            accessibilityLabel="Confirmar contraseña"
            disabled={submitting}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onBlur={() => setConfirmTouched(true)}
            onSubmitEditing={onSubmit}
          />
          {showMatch ? (
            <Text style={passwordsMatch ? styles.matchOk : styles.matchError}>
              {passwordsMatch ? 'Coinciden' : 'Aún no coinciden.'}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={enter(320)}>
          <SubmitButton
            label="Crear cuenta"
            submittingLabel="Creando tu cuenta…"
            canSubmit={canSubmit}
            isSubmitting={submitting}
            onPress={onSubmit}
          />
        </Animated.View>

        {/* Error below the button so it never shifts under the finger. */}
        {errorMessage ? (
          <Animated.View entering={enter(0)} style={styles.errorBlock}>
            <Text style={styles.error}>{errorMessage}</Text>
            {emailExists ? (
              <Pressable
                hitSlop={12}
                style={styles.linkTap}
                accessibilityRole="link"
                onPress={() =>
                  router.push({ pathname: '/auth', params: { email: trimmedEmail } })
                }
              >
                <Text style={styles.link}>Iniciar sesión</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={enter(380)} style={styles.links}>
        <Link href={{ pathname: '/auth', params: { email: trimmedEmail } }} asChild>
          <Pressable hitSlop={12} style={styles.linkTap} accessibilityRole="link">
            <Text style={styles.link}>Ya tengo cuenta</Text>
          </Pressable>
        </Link>
      </Animated.View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  headerBlock: { gap: spacing.sm },
  form: { gap: spacing.md },
  confirmBlock: { gap: spacing.xs },
  errorBlock: { gap: spacing.xs },
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
  matchOk: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.feedbackSuccess,
    paddingLeft: spacing.xs,
  },
  matchError: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
    paddingLeft: spacing.xs,
  },
  error: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
  },
  links: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  linkTap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
})
